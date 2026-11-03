# orbit360

把一段 360° 环绕拍摄的视频变成「可以转的 3D 模型」：手机陀螺仪控制视角，左右拖拽当作转动，
画面按角度切换帧（不是播放视频），Canvas 单帧硬切渲染；移动端用雪碧图避免逐帧换纹理的闪动。

默认演示素材是 `沙发少女`（`?e=maid`），另一段是 `环绕视角`（`?e=orbit`）。

- `examples/anime-maid.mp4`（**3840×2160** / 24fps / 10s / 239 帧，首尾闭环 0.768，环回有一次可见跳变）
- `examples/orbit-sample.mp4`（1280×720 / 24fps / 10s / 240 帧，首尾闭环 0.952）

## 快速开始

```bash
# 起服务（在仓库根目录执行）
python3 scripts/serve.py 8787        # 桌面 http://127.0.0.1:8787/
python3 scripts/serve_tls.py 8443    # 手机 https://<本机IP>:8443/（自签证书，需 HTTPS 才能用陀螺仪）
```

仓库里已经带了两个 `.orb` 示例（`assets/orbit/`、`assets/maid/`），开箱即用。
GitHub Pages 直接发布仓库根目录（`index.html`、`legacy.html`、`catalog.json`、`assets/`、`sdk/`），无需构建步骤。

自己的视频：用 `scripts/bundle.py` 生成 `.orb`，再挂进示例清单，页面不用改——

```bash
python3 scripts/bundle.py build assets/<id>/scene.orb <视频路径> \
    --fps 12 --long-edge 1280 --codec webp --quality 80 --title "标题"
```

参数与画布布局见 [场景包](#场景包orb多视频)，清单写法见 [示例](#示例)。

## GUI（原生窗口）

不想敲命令行就用 `apps/gui/`：一个 [MyGo](https://github.com/egoist/mygo) 的原生窗口，
Go 自己画界面，没有 webview、没有前端构建；里面只是给 `scripts/build.py` 套了一层表单。

```bash
cd apps/gui
go run .              # 直接跑
go tool mygo dev      # 改 .go 自动重启
go tool mygo build    # 打包成 Orbit360.app / .exe / .deb
```

需要 Go 1.27+、Python 3（跑 `scripts/build.py`）、ffmpeg。ffmpeg 和 Python 都不用自己折腾：
窗口会自动在 `PATH`、Homebrew 常见位置里找，找不到就点「下载」（macOS 从
[evermeet.cx](https://evermeet.cx/ffmpeg/) 取 ffmpeg + ffprobe 静态构建，Windows 取
gyan.dev 的 essentials 包，解到配置目录的 `bin/`）；Linux 走包管理器，窗口只给提示。

| 位置 | 作用 |
|---|---|
| 源视频 | `选择…` 后自动用 ffprobe 读尺寸，并把「超清长边」收到源的长边（不放大） |
| 示例 id / 标题 | `id` 决定 `assets/<id>/`，并写进 `catalog.json` |
| 帧率 + 三档长边 | 就是 `--fps` / `--std` / `--hd` / `--uhd`（超清填 0 关掉该档） |
| 默认画质 / 默认自动环绕 | `--default-quality` / `--default-auto` |
| 保留中间帧 / 更新 catalog | `--keep-raw` / `--catalog` |
| 开始生成 | 起 `python3 scripts/build.py`，日志实时贴在下半屏，可中途停止 |
| 打开预览 | 没在跑就先起 `scripts/serve.py 8787`，再打开 `http://127.0.0.1:8787/?e=<id>` |
| 打开输出目录 | 在 Finder / 资源管理器里定位 `assets/<id>` |

设置（上一次的视频、路径、参数）存在 `~/Library/Application Support/orbit360-gui/settings.json`
（Linux 在 `$XDG_CONFIG_HOME`，Windows 在 `%AppData%`）。

界面本身可以不开窗口渲成图片，方便调布局：

```bash
go run . -shot shot.png
```

GUI 只是 `scripts/build.py` 的壳，页面仍是 `index.html`，两边互不影响。
GUI 生成的是旧版 zip 资源包，只在本地预览 / 兼容旧页面时使用；仓库发布示例统一用 `.orb`。

## 旧版资源包（zip，可选）

仓库发布的示例只保留 `scene.orb`，**不再内置 zip**。页面仍保留 zip 解析作为兼容路径：
只有 `catalog.json` 里给某个示例配了 `packs`，`?fmt=zip` 或任意 `?q=` 才会切回 zip。
zip 里就是 `meta.json` + 图片，**不压缩（ZIP_STORED）**，浏览器解包时不需要 inflate：

```
assets/<id>/
  meta.json              包外副本，供 catalog 读取默认配置
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
- 需要旧格式时用 `scripts/build.py` 生成；`assets/*/packs/` 与 `assets/*/meta.json` 已在 `.gitignore` 里，
  不会误提交进发布目录

## 场景包（`.orb`，多视频）

`scripts/bundle.py` 把 1~N 个视频抽成 WebP / AVIF / JPEG 帧，和 meta、帧索引一起打进**一个二进制文件**。
文件里没有视频轨，只有帧；读取端先按 `prefixLen` 一次 Range 拿到头部，再按索引里的
`offset/length` 按需取帧，不需要解析 zip。

```bash
# 单个视频：画布自动等于帧尺寸
python3 scripts/bundle.py build scene.orb a.mp4 --fps 12 --long-edge 960 --codec webp

# 多个视频：显式画布 + 每个视频的位置
python3 scripts/bundle.py build wall.orb a.mp4 b.mp4 --canvas 1920x1080 \
    --place 0,0,960,1080 --place 960,0,960,1080 --fps 12 --long-edge 960

python3 scripts/bundle.py info scene.orb          # 画布 / 编码 / 每个视频的帧数、位置、prefix
python3 scripts/bundle.py info scene.orb --json   # 完整 meta
python3 scripts/bundle.py extract scene.orb --out /tmp/frames   # 每视频一个子目录
```

仓库里两个示例已经按 12fps / 1280 长边 / WebP q80 打好：

```
assets/maid/scene.orb   1280×720 ×120  image/webp  5.0 MB
assets/orbit/scene.orb  1280×720 ×120  image/webp  5.5 MB
```

```bash
python3 scripts/serve.py 8787
# http://127.0.0.1:8787/?orb=assets/maid/scene.orb
# http://127.0.0.1:8787/?orb=assets/orbit/scene.orb
```

重新生成（参数与上面文件一致）：

```bash
python3 scripts/bundle.py build assets/orbit/scene.orb examples/orbit-sample.mp4 \
    --fps 12 --long-edge 1280 --codec webp --quality 80 --title "环绕视角"
python3 scripts/bundle.py build assets/maid/scene.orb examples/anime-maid.mp4 \
    --fps 12 --long-edge 1280 --codec webp --quality 80 --title "沙发少女"
```

容器布局（小端）：

```
Header  32B
  0   4B  magic  "ORB3"
  4   4B  version（当前 1）
  8   4B  prefixLen = 32 + metaLen + indexLen
  12  4B  metaLen
  16  4B  indexLen
  20  4B  frameCount
  24  4B  indexEntrySize（当前 16）
  28  4B  flags（保留，0）

Meta    metaLen 字节，JSON（UTF-8）
Index   indexLen 字节，每帧一条 16B 的 <IIQ>：
          u32 videoIndex, u32 length, u64 absoluteOffset
        顺序 = videos[] × frames，帧号在视频内按顺序隐含
Payload 帧数据，从 prefixLen 开始，offset 指向这里
```

`prefixLen` 覆盖 Header + Meta + Index，所以一次
`Range: bytes=0-<prefixLen-1>` 就能拿到全部元数据和每条索引；之后每帧再来一次
`Range: bytes=<offset>-<offset+length-1>`。

meta 是一个对象 + 一个数组，一个视频对应 `videos` 里的一项：

```json
{
  "format": "orbit360.bundle", "version": 1, "title": "…",
  "canvas": { "width": 1920, "height": 1080 },
  "totalFrames": 240,
  "codec": "image/webp",
  "initialAngle": 0,
  "orbit": { "spanDeg": 360, "direction": "cw" },
  "videos": [{
    "id": "v1",
    "rect": { "x": 0, "y": 0, "width": 960, "height": 1080 },
    "source": { "file": "a.mp4", "width": 3840, "height": 2160, "fps": 24,
                "frames": 239, "durationSec": 9.963, "codec": "h264" },
    "orbit": { "spanDeg": 360, "direction": "cw" },
    "frames": { "count": 120, "width": 960, "height": 540, "fps": 12,
                "indexStart": 0 }
  }]
}
```

- **单视频**：`canvas` 恒等于帧尺寸，`rect` 恒为 `(0, 0, w, h)`；给不同的
  `--canvas` / `--place` 会直接报错
- **多视频**：`rect` 是视频画到画布上的位置与尺寸（帧按 `rect` 缩放）；不给 `--place`
  时按一行排开、整体在画布内居中，画布默认取这行的包围盒，给了 `--canvas` 则校验是否放得下
- `frames.indexStart` 是该视频第一帧在 Index 区里的条目序号；`count` 可以各视频不同
  （按各自时长 × `--fps` 抽帧），`totalFrames` 是全部帧数，与 Header 的 `frameCount` 一致
- `videos[]` 的顺序就是画布上的绘制顺序（后面的盖在前面的上面）
- `--codec` 支持 `webp`（默认）/ `avif` / `jpeg`，meta 里写成 `image/webp` 等 MIME；
  `--quality` 统一为 0–100（越大越清晰），JPEG / AVIF 内部换算成 `-q:v` / CRF
- 其他参数：`--fps` 采样帧率、`--long-edge` 每帧长边、`--initial-angle` 初始视角、
  `--title`、`--orbit-span` / `--orbit-dir`（写进 `orbit`）

### 网页里怎么用

页面渲染由 Web client 负责，UI 只负责按钮、滑杆与 HUD。`index.html` 加载
`sdk/js/dist/orbit360-client.js`，然后创建一个客户端：

```html
<script src="sdk/js/dist/orbit360-client.js"></script>
<script>
  const client = new Orbit360.Client(document.querySelector('canvas'), {
    container: document.querySelector('#stage'),
    input: document.querySelector('#stage'),
  });

  client.load('assets/maid/scene.orb').then(() => {
    console.log(client.getState());
  });
</script>
```

核心 API：

```js
client.load(urlOrBlob);                       // .orb / 旧版 zip
client.setAngle(90);                          // 目标角度
client.rotateBy(3);
client.setAutoRotate('cw');                   // off / cw / ccw
client.setAutoSpeed(20);
client.setGyroConfig({ gain: 1.4, smooth: true });
client.setInvert(false);
client.setFit('cover');                       // contain / cover
client.setMouseFollow({ enabled: true });
client.setConfig({ drag: { degPerPx: 0.5 } });
client.getAngle();                            // 当前角度
client.getConfig();                           // 当前完整配置
client.getState();                            // 角度 / 帧号 / 自动旋转 / 陀螺仪 / 进度 / meta
client.on('angle', ({ angle, frameIndex }) => {});
client.on('state', state => {});
```

完整配置项、状态字段、事件与方法见 [sdk/js/README.md](sdk/js/README.md)。
SDK 按语言分目录，其他语言实现放在 `sdk/<lang>/`，约定见 [sdk/README.md](sdk/README.md)。

修改 `sdk/js/src/client.mjs` 后重新构建，并同步旧版页面：

```bash
cd sdk/js && npm install && npm run build && cd ../..
node scripts/make-legacy.mjs
```

JavaScript SDK 也发布到 npm：`@orbit360/javascript`（含 TypeScript 类型）。

```bash
npm install @orbit360/javascript
```

- 面板「导入」同时接受 `.zip` 和 `.orb`，按文件头 magic 自动判断
- 直接打开：`?orb=scene.orb`（不需要 `catalog.json`）
- `.orb` 多视频按 `meta.canvas` 建画布，每个 `videos[]` 按其 `rect` 缩放绘制；
  各视频帧数不同时按当前角度占整圈的比例取帧
- 打开时角度取 `meta.initialAngle`，环绕方向取 `meta.orbit.direction`

底层解析器仍可单独使用（`@orbit360/javascript`）：

```js
const orb = await OrbBundle.fromBlob(file);   // File / Blob
orb.meta;                                     // JSON meta
orb.prefixLen;                                // Header+Meta+Index 字节数
orb.entries;                                  // [video, length, offset] 数组
orb.frameEntry(0, 0);                         // { video, length, offset }
orb.frameBlob(0, 0);                          // 该帧 Blob，可直接 <img>/createImageBitmap

const whole = OrbBundle.parse(arrayBuffer);   // 整文件 ArrayBuffer
const head = OrbBundle.parse(prefixBuffer);   // 也可以只给前 prefixLen 字节
```

`fromBlob()` 只先读 32B Header 和前 `prefixLen` 字节，帧在需要时才 `slice`，
配合同样的 Range 服务端不会整包下载。

`legacy.html` 由 `scripts/make-legacy.mjs` 把 Web client 构建产物与页面脚本一起内联，
旧系统也能运行。

## 示例

`catalog.json` 列出所有发布示例，每个示例只放一个 `.orb`：

```json
{
  "default": "maid",
  "items": [{
    "id": "maid",
    "title": "沙发少女",
    "orb": "assets/maid/scene.orb",
    "defaults": { "auto": { "enabled": true, "dir": "cw" } }
  }]
}
```

- 右下角胶囊栏切换示例（当前项高亮，可横向滚动）；移动端它与面板合并成底部控制区，
  面板上移 68px 避让。切换时整页重载，上一套帧内存随之释放
- 默认加载 `item.orb`；URL 参数 `?e=maid` 选择示例
- 旧版页面仍可用 `?fmt=zip` / `?q=uhd` 切到 zip，但前提是清单里给该项配了 `packs`；
  仓库发布的示例不提供 `packs`，画质按钮会自动隐藏

新增一个示例（生成 `.orb` → 写清单，`index.html` 不动）：

```bash
python3 scripts/bundle.py build assets/myid/scene.orb my-video.mp4 \
    --fps 12 --long-edge 1280 --codec webp --quality 80 --title "我的示例"
```

然后在 `catalog.json` 的 `items` 里加一项，`orb` 指向 `assets/myid/scene.orb`，
需要时把 `default` 改成这个 `id`。

## 导入自定义包

面板的 `导入` 按钮接受 zip 包或 `.orb`（按 magic 自动区分）。zip 要求：

1. 根目录有 `meta.json`，含 `pack.files` 与 `pack.frameW/frameH`
2. `pack.files` 列出的图片都在包里
3. 建议 STORED（不压缩），老浏览器才能解

`.orb` 直接整体载入，多视频按 `meta.canvas` / `videos[].rect` 排布；帧格式由 `meta.codec`
决定（WebP 兼容面最广，AVIF 需要较新的浏览器）。

导入后立即生效，不写入服务器；示例下拉框与画质按钮会禁用（单包模式）。

## 低版本兼容：两份页面

默认用 `index.html`；老系统访问 `legacy.html`。

| 文件 | 目标引擎 | 依赖 |
|---|---|---|
| `index.html` | Safari 13.4+ / Chrome 80+ | ES2020（`?.` `??`）、Pointer Events、ResizeObserver |
| `legacy.html` | **Safari 10 / iOS 10.3+** | ES2015 语法，附 Pointer Events 与 ResizeObserver 兜底 |

`legacy.html` 由脚本生成，**不要手改**：

```bash
node scripts/make-legacy.mjs        # 读 index.html → esbuild 降到 ES2015 → 写入 legacy.html
ESBUILD=npx node scripts/make-legacy.mjs   # 没有 bunx 时换用 npx
```

`make-legacy.mjs` 会同时内联 `sdk/js/dist/orbit360-client.js` 与页面脚本。
改动 `index.html` 或 Web client 后要重跑一次。降级只处理语法与缺失 API：

- `?.` / `??` / `async` / 对象展开 → ES2015
- 无 Pointer Events 的内核：`scripts/legacy-polyfill.js` 用 touch/mouse 合成 pointerdown/move/up/cancel/leave，
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

由 `scripts/build.py` 生成；重建时会保留你已经调过的 `drag / motion / auto / gyro / orbit / video / title`。

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

## 重新生成资产（旧版 zip）

发布示例请用上面的 `scripts/bundle.py` 生成 `.orb`。下面这套只保留给旧版 zip 兼容路径，
产物已被 `.gitignore` 忽略，不会进入 GitHub Pages。

`scripts/build.py` 把「视频 → 可转的 3D 模型」这条链全包了：读源 meta、算闭环、抽帧、
拼雪碧图、打 zip、刷新 `catalog.json`。

```bash
python3 scripts/build.py <视频路径> --out assets/<id> [--title 标题] [--catalog catalog.json]
                         [--fps 12] [--std 512] [--hd 640] [--uhd 1920] [--quality 6]
                         [--default-quality uhd] [--default-auto cw|ccw|off] [--assets-root DIR]
                         [--keep-raw] [--frames-only [--frames-dir DIR]]
```

常见用法：

```bash
# 4K 源
python3 scripts/build.py examples/anime-maid.mp4 --out assets/maid --title "沙发少女" --catalog catalog.json

# 低分辨率源（752×416）：超清档给到原生 752 长边，不放大
python3 scripts/build.py ~/Downloads/my-video.mp4 --out assets/gen --title "生成视频" \
    --uhd 752 --default-quality uhd --catalog catalog.json

# 只想看看抽出来的帧，不打包
python3 scripts/build.py ~/Downloads/my-video.mp4 --frames-only --frames-dir /tmp/frames
```

| 参数 | 作用 |
|---|---|
| `--out` | 产物目录（默认脚本目录）：`meta.json` + `packs/{std,hd,uhd}.zip`（不入库） |
| `--fps` | 标准/高清档采样帧率，默认 12（10 秒 → 120 帧，3°/帧） |
| `--std` / `--hd` | 雪碧图档长边，默认 512 / 640 |
| `--uhd` | 超清档长边，默认 1920，帧数减半；`0` 关掉该档；源更小时按源的长边给 |
| `--quality` | JPEG 质量 2–31，越小越清晰（默认 6） |
| `--catalog` | 构建完刷新示例清单；同时扫描 `<id>/scene.orb`，已有的 `.orb` 示例不会丢 |
| `--assets-root` | 清单扫描的根目录，默认 `--out` 的父目录 |
| `--keep-raw` | 中间产物留着：`out/frames-<std\|hd\|uhd>/`（序列帧）、`out/atlas-<std\|hd>/`（雪碧图） |
| `--frames-only` | 只抽帧不建 zip、不写 meta（长边/帧率取 `--std`/`--fps`） |
| `--frames-dir` | 配合 `--frames-only` 指定落地目录，默认 `out/frames` |

流程要点：

- 用 `ffprobe` 读源 meta，用 32×18 灰度缩略图算首尾 ZNCC 闭环相似度（过差会警告）
- 三档都从同一个源解码：`std`/`hd` 合并成 6×10 雪碧图（`pack.type = atlas`），
  `uhd` 输出逐帧序列（`pack.type = sequence`）；长边按 `fit()` 等比缩放并取偶数
- 帧在临时目录里解码，构建完成即删；需要帧就显式加 `--keep-raw` 或 `--frames-only`
- 已有 `meta.json` 里的 `drag / motion / auto / gyro / orbit / video / title` 会被沿用，
  重建不会冲掉手调过的参数

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
index.html          播放器（GitHub Pages 入口）
legacy.html         旧系统版本（由脚本生成，不要手改）
catalog.json        示例清单（default + items + orb + defaults）
.nojekyll           GitHub Pages：关闭 Jekyll 处理
assets/<id>/        发布产物，每个示例只放 scene.orb
  scene.orb         ORB3 二进制场景包（帧 + meta + 索引）
examples/           示例源视频（用于重新生成，不参与页面加载）
  orbit-sample.mp4   1280×720 / 10s
  anime-maid.mp4     3840×2160 / 10s
sdk/                多语言 SDK
  README.md          SDK 约定、npm 发布与新增语言说明
  js/                JavaScript SDK
    package.json     npm 包 @orbit360/javascript
    orb.js           ORB3 解析器（浏览器 / Node，零依赖）
    orb.d.ts         解析器类型
    src/client.mjs   Web client 源码（渲染核心，不含 UI）
    dist/            IIFE / ESM / CJS 构建产物（GitHub Pages 用 IIFE）
    web-client.d.ts  Web client 类型
    README.md        npm 包说明与完整 API
apps/
  gui/              原生窗口 GUI（MyGo native UI，Go + scripts/build.py）
    main.go           界面与构建流程
    env.go            路径检测、ffmpeg 下载、设置持久化
scripts/
  bundle.py         多视频 → 单文件 .orb（发布示例用）
  build.py          视频 → meta.json + packs/{std,hd,uhd}.zip（旧版兼容）
  serve.py          多线程静态服务
  serve_tls.py      HTTPS 服务（手机陀螺仪必需，自动生成自签证书）
  make-legacy.mjs   由 index.html 生成 legacy.html
  legacy-polyfill.js  Pointer Events / ResizeObserver 兜底
.github/workflows/
  npm-publish.yml   SDK 校验与 npm 发布（NPM_TOKEN 占位）
```

`assets/*/packs/`、`assets/*/meta.json`、中间帧目录都已在 `.gitignore` 里，
发布目录只会保留 `.orb`。

## 兼容性

Canvas + `Image` + `ResizeObserver`。陀螺仪需要安全上下文
（`https://` 或 `localhost`），iOS 需在用户手势内调用 `DeviceOrientationEvent.requestPermission()`；
Android 优先使用 `deviceorientationabsolute` 的绝对朝向，无传感器时自动回退到拖拽。
