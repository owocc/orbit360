# orbit360

把一段 360° 环绕拍摄的视频变成「可以转的 3D 模型」：手机陀螺仪控制视角，左右拖拽当作转动，
画面按角度切换帧（不是播放视频）。全部预解码成 `ImageBitmap`，用 Canvas 单帧硬切渲染。

示例素材：`examples/orbit-sample.mp4`（1280×720 / 24fps / 10s / 240 帧，首尾闭环相似度 0.952）。

## 快速开始

```bash
# 1. 从源视频生成帧集与 config.json
python3 build.py examples/orbit-sample.mp4

# 2. 起服务
python3 serve.py 8787            # 桌面 http://127.0.0.1:8787/
python3 serve_tls.py 8443        # 手机 https://<本机IP>:8443/（自签证书，需 HTTPS 才能用陀螺仪）
```

构建产物 `frames/`、`frames-small/` 不入库，跑一次 `build.py` 即可生成。

## 交互

UI 集中在左下角面板，进入 3.2 秒后自动隐藏，画面全屏沉浸；触屏长按、鼠标双击（或 `H`）随时调出。
移动端进入页面后会在首次触摸时自动申请并开启陀螺仪（iOS 必须在用户手势内授权），无需手动点按钮。

| 操作 | 效果 |
|---|---|
| 左右拖拽 / 鼠标拖动 | 转动视角，松手有阻尼惯性 |
| 移动鼠标（不按键） | 鼠标跟随转向，默认 `0.3°/px` |
| 倾斜手机（需 HTTPS） | 陀螺仪映射到环绕角度，增益 0.4×–3.0× 可调 |
| 长按画面（触屏） | 显示 / 隐藏 UI |
| 双击画面（鼠标） | 显示 / 隐藏 UI |
| `H` | 显示 / 隐藏 UI |
| `←` `→` | 微调 3°（`Shift` 为 15°） |
| `空格` / 面板 `自动环绕` | 开关自动环绕（默认关闭） |
| 面板 `全屏` | 进入 / 退出全屏（浏览器不支持时自动隐藏该按钮） |
| 面板 `重置` | 角度回到 0°，陀螺仪下同时重设基准 |
| 面板 `鼠标跟随` | 开关悬停转向 |
| 面板 `陀螺仪平滑` | 陀螺仪输入低通滤波（默认开）；关掉更跟手但会抖 |
| 面板 `惯性` | 松手后是否继续滑行（默认开） |
| 面板 `自适应` / `铺满` | 画面等比完整显示 / 强制铺满视口（裁掉多余） |
| 面板 `陀螺仪` / `校准` / `反向` | 手动开关、重设基准、翻转方向 |
| 面板灵敏度滑块 | 陀螺仪增益，1.0× 为物理 1:1 |

陀螺仪不直接用 `alpha`：由 `alpha/beta/gamma` 合成设备屏幕法线在世界坐标中的水平方位角，
所以竖屏、横屏、手机倾斜握持都是同一套映射；手机接近平放（法线几乎竖直）时退回 `alpha`，
并按 `screen.orientation.angle` 修正 90°/270° 的方向。

## 配置 `config.json`

由 `build.py` 生成；重建时会保留你已经调过的 `drag / motion / auto / gyro / orbit / video / title`。

| 键 | 含义 | 默认 |
|---|---|---|
| `source` | 源视频 meta（分辨率/fps/帧数/时长/编码/码率/闭环相似度） | 自动 |
| `video.width/height` | 帧的逻辑宽高（决定画面比例） | 自动 |
| `video.displayScale` | 画面缩放 >1 时裁切边缘 | `1` |
| `video.portraitScale` | 竖屏额外放大 | `1.25` |
| `orbit.spanDeg` | 整段视频覆盖的真实角度 | `360` |
| `orbit.direction` | `cw` / `ccw`，帧序列方向 | `cw` |
| `frames.count` | 帧数；每帧角度 = `360/count` | 自动 |
| `drag.degPerPx` | 拖拽灵敏度（度/像素） | `0.42` |
| `video.fit` | `contain` 自适应 / `cover` 铺满 | `contain` |
| `drag.inertia` | 松手是否继续滑行 | `true` |
| `drag.inertiaMs` | 松手惯性时间常数 | `110` |
| `motion.smoothMs` | 角度阻尼（越小越跟手） | `45` |
| `auto.enabled` | 是否默认开启自动环绕 | `false` |
| `auto.degPerSec` / `idleDelayMs` | 待机自动环绕速度 / 触发延迟 | `14` / `2200` |
| `gyro.gain` | 陀螺仪增益（面板滑块同步） | `1.0` |
| `gyro.smooth` / `smoothMs` | 陀螺仪低通滤波开关 / 时间常数 | `true` / `80` |
| `mouseFollow.enabled` | 是否默认开启鼠标悬停转向 | `true` |
| `mouseFollow.degPerPx` | 鼠标跟随灵敏度（度/像素） | `0.3` |

改完刷新页面即可生效。

## 重新生成资产

```bash
python3 build.py <video> [--fps 12] [--desktop 800] [--mobile 512] [--quality 6]
```

- 用 `ffprobe` 读源 meta，用 32×18 灰度缩略图算首尾 ZNCC 闭环相似度（过差会警告）
- 抽两套帧：桌面长边 800、移动长边 512，移动端由 `frames.mobileMaxScreenPx` 自动选用
- 帧数按 `--fps` 采样，默认 12fps → 10 秒视频 120 帧（3°/帧）

## 目录

```
index.html        播放器（无依赖，单文件）
build.py          视频 → 帧集 + config.json
serve.py          多线程静态服务
serve_tls.py      HTTPS 服务（手机陀螺仪必需，自动生成自签证书）
config.json       示例 meta（由 build.py 生成）
examples/         示例源视频
frames/           桌面帧集（生成物，未入库）
frames-small/     移动帧集（生成物，未入库）
```

## 兼容性

Canvas + `createImageBitmap` + `ResizeObserver`。陀螺仪需要安全上下文
（`https://` 或 `localhost`），iOS 需在用户手势内调用 `DeviceOrientationEvent.requestPermission()`；
Android 优先使用 `deviceorientationabsolute` 的绝对朝向，无传感器时自动回退到拖拽。
