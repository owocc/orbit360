# orbit360

把一段 360° 环绕拍摄的视频变成「可以转的 3D 模型」：手机陀螺仪控制视角，左右拖拽当作转动，
画面按角度切换帧（不是播放视频），Canvas 单帧硬切渲染；移动端用雪碧图避免逐帧换纹理的闪动。

默认演示素材是 `沙发少女`（`?e=maid`），另一段是 `环绕视角`（`?e=orbit`）。

- `examples/anime-maid.mp4`（**3840×2160** / 24fps / 10s / 239 帧，首尾闭环 0.768，环回有一次可见跳变）
- `examples/orbit-sample.mp4`（1280×720 / 24fps / 10s / 240 帧，首尾闭环 0.952）

## 快速开始

```bash
# 起服务
python3 serve.py 8787            # 桌面 http://127.0.0.1:8787/
python3 serve_tls.py 8443        # 手机 https://<本机IP>:8443/（自签证书，需 HTTPS 才能用陀螺仪）
```

仓库里已经带了两个示例（`assets/orbit/`、`assets/maid/`），开箱即用。

## 资源包（zip）

每个示例按画质打包成独立的 zip，里面就是 `meta.json` + 图片，**不压缩（ZIP_STORED）**，
浏览器解包时不需要 inflate：

```
assets/maid/
  meta.json              包外的一份副本，供 catalog 读取默认配置
  packs/std.zip          512×288 ×120（2 张雪碧图，1.5 MB）
  packs/hd.zip           640×360 ×120（2 张雪碧图，2.0 MB）
  packs/uhd.zip          1920×1080 ×60（60 张序列帧，5.1 MB）
```

包内 `meta.json` 结构：

```json
{
  "title": "沙发少女",
  "source": { "width": 3840, "height": 2160, "fps": 24, "frames": 239, "durationSec": 9.963, ... },
  "pack": { "type": "atlas", "count": 120, "cols": 6, "rows": 10,
            "frameW": 512, "frameH": 288, "pattern": "sheet%02d.jpg",
            "files": ["sheet01.jpg", "sheet02.jpg"] },
  "defaults": { "quality": "uhd", "auto": { "enabled": true, "dir": "cw" } },
  "orbit": { "spanDeg": 360, "direction": "cw" },
  "drag": { ... }, "motion": { ... }, "auto": { ... }, "gyro": { ... }
}
```

- `pack.type` 为 `atlas`（雪碧图，按 `sx/sy` 裁剪）或 `sequence`（逐帧）
- `defaults.quality` 决定打开时用哪档；`defaults.auto` 决定是否自动旋转及方向
- 页面对 DEFLATE 包会用 `DecompressionStream('deflate-raw')` 兜底，老浏览器只支持 STORED

## 示例与画质切换

`catalog.json` 列出所有示例与各自可用的包：

```json
{ "default": "maid",
  "items": [{ "id": "maid", "title": "沙发少女",
              "packs": { "std": "assets/maid/packs/std.zip", "hd": "...", "uhd": "..." },
              "defaults": { "quality": "uhd" } }] }
```

- 面板左上角的下拉框切换示例（整页重载，上一套帧内存随之释放）
- 面板右下角 `标准/高清/超清` 按升档顺序循环，选择记在 `localStorage`
- URL 参数：`?e=maid&q=uhd`
- 手机打开时即使 meta 推荐 `uhd` 也自动降为 `hd`（约 110 MB 解码），需要时手动切到超清

新增一个示例：

```bash
python3 build.py my-video.mp4 --out assets/myid --title "我的示例" \
    --default-quality uhd --default-auto cw --catalog catalog.json
```

## 导入自定义包

面板的 `导入` 按钮接受一个 zip（就是上面那种包），要求：

1. 根目录有 `meta.json`，含 `pack.files` 与 `pack.frameW/frameH`
2. `pack.files` 列出的图片都在包里
3. 建议 STORED（不压缩），老浏览器才能解

导入后立即生效，不写入服务器；示例下拉框与画质按钮会禁用（单包模式）。

## 低版本兼容：两份页面

默认用 `index.html`；老系统访问 `legacy.html`。

| 文件 | 目标引擎 | 依赖 |
|---|---|---|
| `index.html` | Safari 13.4+ / Chrome 80+ | ES2020（`?.` `??`）、Pointer Events、ResizeObserver |
| `legacy.html` | **Safari 10 / iOS 10.3+** | ES2015 语法，附 Pointer Events 与 ResizeObserver 兜底 |

`legacy.html` 由脚本生成，**不要手改**：

```bash
node make-legacy.mjs        # 读 index.html → esbuild 降到 ES2015 → 写入 legacy.html
ESBUILD=npx node make-legacy.mjs   # 没有 bunx 时换用 npx
```

改动 `index.html` 后要重跑一次。降级只处理语法与缺失 API：

- `?.` / `??` / `async` / 对象展开 → ES2015
- 无 Pointer Events 的内核：`legacy-polyfill.js` 用 touch/mouse 合成 pointerdown/move/up/cancel/leave，
  并补 `setPointerCapture` / `hasPointerCapture` 空实现
- 无 ResizeObserver：补空壳，尺寸变化仍由 `resize` / `orientationchange` 触发重排

老设备的真正限制不是语法而是内存：iOS 的 canvas 总内存约 224 MB，建议在面板里用 `标准` 档
（512×288，雪碧图解码约 71 MB），`高清` 档 110 MB 在老机型上容易触发限制。

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
| `空格` / 面板 `自动环绕` | 三态循环：关 → 顺时针 → 逆时针（默认关） |

自动旋转在静止 `idleDelayMs` 后**渐入**（默认 700 ms 升到满速），任何拖拽/陀螺仪输入都会让权重
在 120–280 ms 内降到 0，所以起步和打断都没有突兀的速度跳变；速度与方向都记在 `localStorage`。
| 面板 `全屏` | 进入 / 退出全屏（浏览器不支持时自动隐藏该按钮） |
| 面板 `重置` | 角度回到 0°，陀螺仪下同时重设基准 |
| 面板 `鼠标跟随` | 开关悬停转向 |
| 面板 `陀螺仪平滑` | 陀螺仪输入低通滤波（默认开）；关掉更跟手但会抖 |
| 面板 `惯性` | 松手后是否继续滑行（默认开） |
| 面板 `自适应` / `铺满` | 画面等比完整显示 / 强制铺满视口（裁掉多余） |
| 面板 `标准` / `超清` | 切换帧清晰度：桌面 1280×720 ↔ 1920×1080（120/60 帧），移动 512×288 ↔ 640×360；选择记在 localStorage |
| 面板 `陀螺仪` / `校准` / `反向` | 手动开关、重设基准、翻转方向 |
| 面板 `陀螺仪` 滑块 | 陀螺仪增益，1.0× 为物理 1:1 |
| 面板 `自动转速` 滑块 | 静止自动旋转的速度，2–60°/s |

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
| `auto.enabled` / `auto.dir` | 默认是否自动旋转 / 方向 `cw`\|`ccw` | `false` / `cw` |
| `auto.degPerSec` | 自动旋转速度（面板滑块同步） | `14` |
| `auto.idleDelayMs` | 静止多久开始自动旋转 | `2200` |
| `auto.rampInMs` / `rampOutMs` | 起转渐入 / 交互渐出时间常数 | `700` / `280` |
| `gyro.gain` | 陀螺仪增益（面板滑块同步） | `1.0` |
| `gyro.smooth` / `smoothMs` | 陀螺仪低通滤波开关 / 时间常数 | `true` / `80` |
| `mouseFollow.enabled` | 是否默认开启鼠标悬停转向 | `true` |
| `mouseFollow.degPerPx` | 鼠标跟随灵敏度（度/像素） | `0.3` |

改完刷新页面即可生效。

## 重新生成资产

```bash
python3 build.py <video> --out assets/<id> [--title 标题] [--catalog catalog.json]
                  [--fps 12] [--std 512] [--hd 640] [--uhd 1920]
                  [--default-quality uhd] [--default-auto cw|ccw|off] [--quality 6]
```

`--uhd 0` 可关掉超清档；`--keep-raw` 会保留解包出来的中间帧目录（调试用）。
```

- 用 `ffprobe` 读源 meta，用 32×18 灰度缩略图算首尾 ZNCC 闭环相似度（过差会警告）
- 抽四套帧：桌面标准 1280、桌面超清 1920（帧数减半）、移动标准 512、移动高清 640
- 帧数按 `--fps` 采样，默认 12fps → 10 秒视频 120 帧（3°/帧）

## 移动端为什么不闪

iOS Safari 上逐帧切换 `ImageBitmap` 会不停上传/驱逐 GPU 纹理，画面出现闪动
（[WebKit #229825](https://bugs.webkit.org/show_bug.cgi?id=229825)、
[#234920](https://bugs.webkit.org/show_bug.cgi?id=234920)）。现在的做法：

- 移动端把 120 帧拼成 **2 张雪碧图**，整段只占 1~2 块纹理，绘制时按 `sx/sy` 裁剪
- 手机两档：`标准` 512×288（2×3072×2880，解压约 71 MB）/ `高清` 640×360（2×3840×3600，解压约 110 MB）
- 桌面两档：`标准` 1280×720 ×120（解压约 442 MB）/ `超清` 1920×1080 ×60（解压约 498 MB，6°/帧）
- 默认都取标准档，切换后写入 localStorage
- 用 `<img>` 而非 `createImageBitmap`，走浏览器的图像缓存
- Canvas 上下文 `alpha: false`，绘制前**不再 `clearRect`**，直接覆盖——不会出现「已清空、尚未绘制」的空窗
- `layout()`（resize / 切画幅）之后同步补画当前帧，避免清屏到下一帧 rAF 之间的空白
- UI 面板隐藏后 `visibility: hidden`，不再参与合成

画质档在包里声明（`pack.type` 决定雪碧图还是序列帧），页面不关心目录结构。
移动端判定阈值仍是 1100px（覆盖 iPad）。

## 目录

```
index.html        播放器（无依赖，单文件；自带 zip 解析）
build.py          视频 → meta.json + packs/{std,hd,uhd}.zip
serve.py          多线程静态服务
serve_tls.py      HTTPS 服务（手机陀螺仪必需，自动生成自签证书）
catalog.json      示例清单（default + items + packs + defaults）
examples/         示例源视频
  orbit-sample.mp4   1280×720 / 10s
  anime-maid.mp4     3840×2160 / 10s
assets/<id>/      每个示例的发布产物
  meta.json         包外副本（catalog 读取默认配置）
  packs/std.zip     512×288 雪碧图包
  packs/hd.zip      640×360 雪碧图包
  packs/uhd.zip     1920×1080 序列帧包
```

## 兼容性

Canvas + `createImageBitmap` + `ResizeObserver`。陀螺仪需要安全上下文
（`https://` 或 `localhost`），iOS 需在用户手势内调用 `DeviceOrientationEvent.requestPermission()`；
Android 优先使用 `deviceorientationabsolute` 的绝对朝向，无传感器时自动回退到拖拽。
