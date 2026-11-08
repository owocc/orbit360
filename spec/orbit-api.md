# OrbitEngine API v1

`OrbitEngine` 是纯状态机。输入是配置、指针/陀螺仪事件和调用方传入的 `dtMs`；输出是 `EngineSnapshot`。引擎不读取时钟、不绘制、不访问平台 API。

## 1. 配置

缺省配置：

```json
{
  "title": "",
  "video": {
    "displayScale": 1,
    "portraitScale": 1.25,
    "fit": "contain",
    "width": 1280,
    "height": 720
  },
  "orbit": {
    "axis": "x",
    "spanDeg": 360,
    "direction": "cw",
    "minAngle": -180,
    "maxAngle": 180
  },
  "drag": {
    "degPerPx": 0.42,
    "invert": false,
    "inertia": true,
    "inertiaMs": 110
  },
  "motion": { "smoothMs": 62 },
  "auto": {
    "enabled": false,
    "dir": "cw",
    "degPerSec": 36,
    "idleDelayMs": 2200,
    "rampInMs": 700,
    "rampOutMs": 280
  },
  "gyro": {
    "gain": 1,
    "invert": false,
    "smooth": true,
    "smoothMs": 80
  },
  "mouseFollow": { "enabled": false, "degPerPx": 0.3 }
}
```

合并顺序（后者覆盖前者）：

```text
DEFAULTS <- 场景配置（meta 顶层配置键） <- 用户配置
```

场景配置中的 `defaults.auto` 先合并进场景 `auto`，再参与上述顺序。对象递归合并，数组整体替换。

配置键白名单：`title`、`video`、`orbit`、`drag`、`motion`、`auto`、`gyro`、`mouseFollow`、`defaults`、`quality`。

## 2. 角度

- 角度单位为度，向右/向下拖动为正。
- `minAngle = -180` 且 `maxAngle = 180` 视为整圈：角度归一化到 `[-180, 180)`。
- 否则 `limited = true`：角度钳制到 `[minAngle, maxAngle]`，差值不做环绕。
- `direction` 只影响帧索引，不影响 `angle` 数值。
- `spanDeg` 是帧序列覆盖的角度，钳制在 `(0, 360]`。

## 3. 帧映射

```text
dirSign = direction === "ccw" ? -1 : 1
a = wrapSigned(angle * dirSign)
degPerFrame = spanDeg / max(1, frameCount)

spanDeg >= 360:
  frameIndex = mod(roundHalfUp(mod(a, 360) / degPerFrame), frameCount)

spanDeg < 360:
  t = (a + spanDeg / 2) / spanDeg
  frameIndex = clamp(roundHalfUp(t * (frameCount - 1)), 0, frameCount - 1)
```

`roundHalfUp(x) = floor(x + 0.5)`，与 JavaScript `Math.round` 一致。

多图层映射：

```text
layerFrameIndex =
  layer.frameCount === frameCount
    ? frameIndex
    : mod(floor(frameIndex * layer.frameCount / frameCount), layer.frameCount)
```

`frameCount = max(videos[].frameCount)`。

## 4. 操作

```text
load(bundle)
setConfig(partial)
setAngle(angle, immediate = false)
rotateBy(deg)
pointerDown(x, y, timeMs)
pointerMove(x, y, timeMs)
pointerUp(timeMs)
gyro({ heading, timeMs })
advance(dtMs)
pause()
resume()
reset(angle = 0)
unload()
destroy()
getSnapshot()
```

### 时间

引擎维护单调的 `now`，初始为 0。

- `advance(dtMs)`：`dt = clamp(dtMs, 0, 64)`，`now += dt`。
- 带 `timeMs` 的事件先把 `now` 更新为 `max(now, timeMs)`。
- `pause()` 后 `advance` 不改变状态，`now` 不前进。
- `resume()` 不补偿暂停期间的时间。
- `pointerMove` 的速度计算使用事件时间差 `dt = max(timeMs - lastPointerTime, 1)`，与 `advance` 无关。
- 任何用户操作（`setAngle`、`rotateBy`、指针、陀螺仪、`setConfig`）都把 `lastActivity = now`。

### 指针

```text
pointerDown: dragging = true; velocity = 0; lastPointer = (x, y, timeMs)
pointerMove:
  if !dragging: return
  dx = x - lastX; dy = y - lastY
  dt = max(timeMs - lastPointerTime, 1)
  px = axis === "y" ? dy : dx
  deg = px * drag.degPerPx * (drag.invert ? -1 : 1)
  targetAngle = normalize(targetAngle + deg)
  inst = dt > 90 ? 0 : deg / dt
  velocity = 0.6 * inst + 0.4 * velocity
pointerUp:
  if !dragging: return
  dragging = false
  if timeMs - lastPointerTime > 90: velocity = 0
  velocity = clamp(velocity, -0.55, 0.55)
```

### advance

```text
if destroyed or paused: return

if !dragging && drag.inertia && !gyroActive && abs(velocity) > 0.0005:
  targetAngle = normalize(targetAngle + velocity * dt)
  velocity *= exp(-dt / drag.inertiaMs)
else:
  velocity = 0

autoWeight += (want - autoWeight) * (1 - exp(-dt / autoTau))
where want = auto.state !== "off" && !gyroActive && !dragging && now - lastActivity > auto.idleDelayMs
      autoTau = want ? auto.rampInMs : (dragging ? 120 : auto.rampOutMs)
if want == 0 && autoWeight < 0.004: autoWeight = 0
if autoWeight > 0:
  targetAngle = normalize(targetAngle + autoDir * auto.degPerSec * autoWeight * dt / 1000)

delta = limited ? targetAngle - angle : shortDelta(angle, targetAngle)
angle += delta * (1 - exp(-dt / motion.smoothMs))
angle = limited ? clamp(angle, min, max) : mod(angle, 360)
if abs(angleDelta(angle, targetAngle)) < 0.0005: angle = targetAngle
```

`autoDir = auto.dir === "ccw" ? -1 : 1`；`auto.state = auto.enabled ? auto.dir : "off"`。

### 陀螺仪

`gyro(sample)` 的 `heading` 是设备航向角（度）。第一次采样建立参考：

```text
gyroRef = heading
gyroBase = targetAngle
```

后续采样：

```text
gain = gyro.gain * (gyro.invert ? -1 : 1) * (drag.invert ? -1 : 1)
delta = shortDelta(gyroRef, heading) * gain
raw = normalize(gyroBase - delta)
if gyro.smooth:
  dt = clamp(timeMs - lastGyroTime, 1, 120)
  targetAngle = normalize(targetAngle + angleDelta(targetAngle, raw) * (1 - exp(-dt / gyro.smoothMs)))
else:
  targetAngle = raw
```

拖动期间陀螺仪采样只更新 `seen`，不改变角度。

### 生命周期

| 操作           | 语义                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load(bundle)` | 重设 bundle、帧数、图层、场景配置；`angle = targetAngle = normalize(initialAngle)`；`velocity = 0`；`dragging = false`；`autoWeight = 0`；`ready = true` |
| `setConfig`    | 合并配置并重新计算限制；若 `limited` 则钳制当前角度                                                                                                      |
| `pause`        | 冻结 `advance`，快照 `paused = true`                                                                                                                     |
| `resume`       | 恢复 `advance`，不重置时间基准                                                                                                                           |
| `reset(angle)` | `angle = targetAngle = normalize(angle)`；清速度、陀螺仪参考；保留配置                                                                                   |
| `unload`       | 清空 bundle、帧数、图层和角度；保留配置；`ready = false`                                                                                                 |
| `destroy`      | 标记 destroyed；之后所有操作和 `advance` 都无效果；快照仍可读                                                                                            |
| 重复 `load`    | 后一次完全覆盖前一次，不合并旧 bundle 状态                                                                                                               |

## 5. 事件轨迹

conformance 用 `{ type, ... }` 事件描述上述操作。`expect` 中的字段按 `render-snapshot.md` 比较。浮点容差 `1e-6`，整数、布尔、枚举精确比较。
