# @orbit360/javascript

ORB3（`.orb`）场景包解析器与 Canvas 渲染客户端。零依赖，浏览器 / Node 通用。

## 安装

```bash
npm install @orbit360/javascript
```

## ORB3 解析器

```js
const OrbBundle = require("@orbit360/javascript");

const orb = await OrbBundle.fromBlob(file); // File / Blob
orb.meta; // 场景 meta
orb.frameEntry(videoIndex, frameIndex); // { video, length, offset }
orb.frameBlob(videoIndex, frameIndex); // 该帧 Blob

const whole = OrbBundle.parse(arrayBuffer); // 必须传入完整文件
```

浏览器或打包环境使用 ESM 入口：

```html
<script type="module">
  import OrbBundle from "node_modules/@orbit360/javascript/dist/index.mjs";
</script>
```

解析器只接受 ORB3/v1（Header `0x00010002`，`meta.version = 1.2`）。其他版本返回
`ORB_UNSUPPORTED_VERSION`，不存在 ZIP 或旧格式探测。完整校验规则、错误码和
conformance cases 见仓库根 `spec/`、`fixtures/`、`conformance/`。

## Web client

渲染核心（Canvas、帧切换、拖拽、惯性、自动环绕、鼠标跟随、陀螺仪、布局），
不包含任何 UI。所有控制项通过 API 配置，状态通过 API 和事件读取。
页面不可见的实例自动暂停渲染。

```js
import { Orbit360Client } from "@orbit360/javascript/web-client";

const client = new Orbit360Client(document.querySelector("canvas"), {
  container: document.querySelector("#stage"), // 尺寸参考元素
  input: document.querySelector("#stage"), // 指针事件元素
  autoStartGyro: true, // 移动端自动申请陀螺仪
  config: {
    auto: { enabled: true, dir: "cw", degPerSec: 36 },
    video: { fit: "contain" },
  },
});

await client.load("assets/maid/scene.orb");

client.setAutoSpeed(20);
client.setGyroConfig({ gain: 1.4 });
client.setInvert(false);
client.setFit("cover");

console.log(client.getAngle(), client.getState());
```

浏览器全局版本（npm 包内的 IIFE 构建产物）：

```html
<script src="node_modules/@orbit360/javascript/dist/orbit360-client.js"></script>
<script>
  const client = new Orbit360.Client(canvas, { container: stage, input: stage });
  client.load("assets/maid/scene.orb");
</script>
```

### 构造项

| 选项                 | 默认                   | 说明                     |
| -------------------- | ---------------------- | ------------------------ |
| `container`          | `canvas.parentElement` | 尺寸参考元素             |
| `input`              | `container`            | 指针 / 手势事件元素      |
| `dragClassTarget`    | `input`                | 拖拽时加 class 的元素    |
| `config`             | `{}`                   | 用户配置覆盖，见下       |
| `dprCap`             | `2`                    | devicePixelRatio 上限    |
| `autoStartGyro`      | `false`                | 触屏设备自动初始化陀螺仪 |
| `concurrency`        | `6`                    | 帧图片解码并发           |
| `dragClass`          | `'dragging'`           | 拖拽中的 class           |
| `preventContextMenu` | `true`                 | 阻止输入元素右键菜单     |

### 加载

```js
await client.load(urlOrBlobOrBuffer, { quality, cache });
await client.loadUrl(url);
await client.loadBlob(file);
client.unload();
```

只支持 `.orb`。`quality` 参数保留但不再影响加载结果。

### 配置

`setConfig()` 接受深层合并的配置片段，`getConfig()` 返回当前生效配置：

```js
client.setConfig({
  title: "沙发少女",
  orbit: { axis: "x", spanDeg: 360, direction: "cw", minAngle: -180, maxAngle: 180 },
  video: { fit: "contain", displayScale: 1, portraitScale: 1.25 },
  drag: { degPerPx: 0.42, touchScale: 2.5, invert: false, inertia: true, inertiaMs: 110 },
  motion: { smoothMs: 62 },
  auto: {
    enabled: false,
    dir: "cw",
    degPerSec: 36,
    idleDelayMs: 2200,
    rampInMs: 700,
    rampOutMs: 280,
  },
  gyro: { gain: 1, invert: false, smooth: true, smoothMs: 80 },
  mouseFollow: { enabled: true, degPerPx: 0.3 },
});
```

常用快捷方法：

| 方法                                                                  | 作用                                         |
| --------------------------------------------------------------------- | -------------------------------------------- |
| `setAngle(deg, { immediate })`                                        | 设置目标角度                                 |
| `rotateBy(deg)`                                                       | 相对转动                                     |
| `reset(deg, { immediate })`                                           | 重置角度与陀螺仪基准                         |
| `setAutoRotate('off'\|'cw'\|'ccw'\|boolean, dir?)`                    | 自动环绕                                     |
| `cycleAuto()`                                                         | 关 → 顺时针 → 逆时针                         |
| `setAutoSpeed(degPerSec)`                                             | 自动转速                                     |
| `setGyroConfig({ gain, invert, smooth, smoothMs })`                   | 陀螺仪参数                                   |
| `enableGyro()` / `disableGyro()` / `calibrateGyro()`                  | 陀螺仪开关与校准                             |
| `setDragConfig({ degPerPx, touchScale, invert, inertia, inertiaMs })` | 拖拽参数（`touchScale` 仅作用于触摸/触控笔） |
| `setMotionConfig({ smoothMs })`                                       | 角度阻尼                                     |
| `setInertia(bool)` / `setInvert(bool)`                                | 惯性 / 反向                                  |
| `setFit('contain'\|'cover')`                                          | 自适应 / 铺满                                |
| `setAuto({ enabled, dir })` / `stopAuto()`                            | 自动旋转别名                                 |
| `pause()` / `resume()`                                                | 暂停 / 恢复主循环                            |
| `setMouseFollow(bool \| { enabled, degPerPx })`                       | 鼠标跟随                                     |
| `setOrbitConfig({ axis, spanDeg, direction, minAngle, maxAngle })`    | 环绕轴、角度覆盖范围与限制                   |
| `setVideoConfig({ fit, displayScale, portraitScale })`                | 画面布局                                     |
| `resize()`                                                            | 手动重排                                     |
| `destroy()`                                                           | 移除监听并停止渲染                           |

### 状态

```js
client.getState();
```

主要字段：

- `ready` / `loading` / `format` / `quality` / `codec` / `title`
- `angle` / `target` / `axis` / `limits` / `velocity` / `frameIndex` / `frameCount` / `frameDeg`
- 角度为 `-180..180`（向左为负），`limits` 为 `{ min, max, limited }`
- `dragging` / `inertia` / `invert` / `fit` / `mouseFollow`
- `auto.state` / `auto.direction` / `auto.speed` / `auto.weight`
- `gyro.enabled` / `gyro.pending` / `gyro.absolute` / `gyro.gain`
- `progress.loaded` / `progress.total` / `progress.progress`
- `viewport` / `canvas` / `config` / `meta`

### 事件

```js
const off = client.on("state", (state) => {
  /* 配置 / 陀螺仪 / 自动旋转等状态变化 */
});
client.on("angle", ({ angle, target, frameIndex }) => {});
client.on("frame", ({ index, count, frameDeg }) => {});
client.on("progress", ({ progress, loaded, total }) => {});
client.on("ready", ({ meta, config, state }) => {});
client.on("error", (err) => {});
client.on("gyrochange", (e) => {});
client.on("longpress", () => {});
client.on("doubletap", () => {});
off();
```

## 构建

```bash
cd sdk/js
vp pack
```

`vite.config.ts` 的 `pack` 块输出：

- `dist/index.{mjs,js}` + `dist/index.d.ts`：解析器 ESM / CJS / 类型
- `dist/web-client.{mjs,js}` + `dist/web-client.d.ts`：web client ESM / CJS / 类型
- `dist/orbit360-client.js`：IIFE，暴露 `window.Orbit360`

完整格式说明、字段含义和生成方式见
[orbit360 仓库](https://github.com/owocc/orbit360) 的「场景包」一节。

## 许可

[PolyForm Noncommercial License 1.0.0](../../LICENSE)：源码公开，非商业用途免费（个人学习、研究、教育、
公益、政府机构），**商业用途需书面授权**。本包不是 OSI 开源包，商用前请先联系 `owocc`。
