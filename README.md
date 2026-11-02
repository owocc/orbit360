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

UI 默认在进入 3.2 秒后自动隐藏，画面全屏沉浸；触屏长按、鼠标双击（或 `H`）随时调出。

| 操作 | 效果 |
|---|---|
| 左右拖拽 / 鼠标拖动 | 转动视角，松手有阻尼惯性 |
| 倾斜手机（需 HTTPS） | 陀螺仪 1:1 映射到环绕角度 |
| 长按画面（触屏） | 显示 / 隐藏 UI |
| 双击画面（鼠标） | 显示 / 隐藏 UI |
| `H` | 显示 / 隐藏 UI |
| `←` `→` | 微调 3°（`Shift` 为 15°） |
| `空格` / 按钮 | 开关自动环绕（默认关闭） |

按钮：`陀螺仪`（首次点击申请权限，无传感器自动回退）、`校准`（重设陀螺仪基准）、
`反向`（翻转拖拽与陀螺仪方向）、`自动环绕`。

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
| `drag.inertiaMs` | 松手惯性时间常数 | `110` |
| `motion.smoothMs` | 角度阻尼（越小越跟手） | `45` |
| `auto.enabled` | 是否默认开启自动环绕 | `false` |
| `auto.degPerSec` / `idleDelayMs` | 待机自动环绕速度 / 触发延迟 | `14` / `2200` |
| `gyro.gain` | 手机转角倍率 | `1.0` |

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
