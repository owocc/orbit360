# orbit360

把一段 360° 环绕拍摄的视频变成「可以转的 3D 模型」：手机陀螺仪控制视角，左右拖拽当作转动，
画面按角度切换帧（不是播放视频），Canvas 单帧硬切渲染；仓库发布的示例统一是单个 `.orb` 文件。

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
Go 自己画界面，没有 webview、没有前端构建；里面只是给 `scripts/bundle.py` 套了一层表单。

```bash
cd apps/gui
go run .              # 直接跑
go tool mygo dev      # 改 .go 自动重启
go tool mygo build    # 打包成 Orbit360.app / .exe / .deb
```

需要 Go 1.27+、Python 3（跑 `scripts/bundle.py`）、ffmpeg。ffmpeg 和 Python 都不用自己折腾：
窗口会自动在 `PATH`、Homebrew 常见位置里找，找不到就点「下载」（macOS 从
[evermeet.cx](https://evermeet.cx/ffmpeg/) 取 ffmpeg + ffprobe 静态构建，Windows 取
gyan.dev 的 essentials 包，解到配置目录的 `bin/`）；Linux 走包管理器，窗口只给提示。

| 位置 | 作用 |
|---|---|
| 源视频 | `选择…` 后自动用 ffprobe 读尺寸，并把「每帧长边」收窄到源的长边（上限 1280） |
| 示例 id / 标题 | `id` 决定唯一产物 `assets/<id>/scene.orb`，并写进 `catalog.json` |
| 帧率 / 每帧长边 | `--fps` / `--long-edge` |
| 帧质量 / 帧编码 | `--quality`（0–100，默认 80）/ `--codec`（webp / avif / jpeg） |
| 初始角度 / 环向 / 环绕角度 | `--initial-angle` / `--orbit-dir` / `--orbit-span` |
| 更新 catalog | `--catalog`，扫描 `assets/<id>/scene.orb` 重写清单 |
| 开始生成 | 起 `python3 scripts/bundle.py build assets/<id>/scene.orb …`，日志实时贴在下半屏，可中途停止 |
| 打开预览 | 没在跑就先起 `scripts/serve.py 8787`，再打开 `http://127.0.0.1:8787/?e=<id>` |
| 打开输出目录 | 在 Finder / 资源管理器里定位 `assets/<id>` |

设置（上一次的视频、路径、参数）存在 `~/Library/Application Support/orbit360-gui/settings.json`
（Linux 在 `$XDG_CONFIG_HOME`，Windows 在 `%AppData%`）。

界面本身可以不开窗口渲成图片，方便调布局：

```bash
go run . -shot shot.png
```

GUI 和命令行是同一个脚本的两个入口，参数一一对应，产物只有 `assets/<id>/scene.orb`；
没有第二套 zip 产物链。页面仍是 `index.html`，两边互不影响。

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
- 页面仍保留旧版 zip 解析用于导入旧包，但仓库不再生成 zip，也不写 `packs` 字段，
  所以 `?fmt=zip` / `?q=` 在发布示例上无效，画质按钮会自动隐藏

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

老设备的真正限制不是语法而是内存：iOS 的 canvas 总内存约 224 MB，`.orb` 的帧尺寸直接决定占用，
老机型建议 `--long-edge 960` 以内；导入旧 zip 包时仍可按 `标准` 档（512×288，
雪碧图解码约 71 MB）控制内存。

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
| 面板 `陀螺仪` / `校准` / `反向` | 手动开关、重设基准、翻转方向 |
| 面板 `陀螺仪` 滑块 | 陀螺仪增益，1.0× 为物理 1:1 |
| 面板 `自动转速` 滑块 | 静止自动旋转的速度，2–60°/s |

陀螺仪不直接用 `alpha`：由 `alpha/beta/gamma` 合成设备屏幕法线在世界坐标中的水平方位角，
所以竖屏、横屏、手机倾斜握持都是同一套映射；手机接近平放（法线几乎竖直）时退回 `alpha`，
并按 `screen.orientation.angle` 修正 90°/270° 的方向。

## 播放器配置

Web client 会把 `.orb` meta 里的 `title / video / orbit / drag / motion / auto / gyro / mouseFollow / defaults`
合并到内置默认值上；`scripts/bundle.py` 默认只写 `title / canvas / codec / initialAngle / orbit / videos`，
其余键取客户端默认值，也可以在加载后用 `client.setConfig({...})` 覆盖（完整字段见 [sdk/js/README.md](sdk/js/README.md)）。

| 键 | 含义 | 默认 |
|---|---|---|
| `source` | 源视频 meta（分辨率/fps/帧数/时长/编码/码率） | 自动 |
| `video.width/height` | 帧的逻辑宽高（决定画面比例） | 自动 |
| `video.displayScale` | 画面缩放 >1 时裁切边缘 | `1` |
| `video.portraitScale` | 竖屏额外放大 | `1.25` |
| `orbit.spanDeg` | 整段视频覆盖的真实角度（`--orbit-span`） | `360` |
| `orbit.direction` | `cw` / `ccw`，帧序列方向（`--orbit-dir`） | `cw` |
| `videos[].frames.count` | 帧数；每帧角度 = `orbit.spanDeg / count` | 自动 |
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

改完重新生成 `.orb`（或改 `client.setConfig`）后生效。

## 移动端为什么不闪

iOS Safari 上逐帧切换 `ImageBitmap` 会不停上传/驱逐 GPU 纹理，画面出现闪动
（[WebKit #229825](https://bugs.webkit.org/show_bug.cgi?id=229825)、
[#234920](https://bugs.webkit.org/show_bug.cgi?id=234920)）。`.orb` 是逐帧图，页面这样处理：

- 用 `<img>` 而非 `createImageBitmap`，走浏览器的图像缓存
- Canvas 上下文 `alpha: false`，绘制前**不再 `clearRect`**，直接覆盖——不会出现「已清空、尚未绘制」的空窗
- `layout()`（resize / 切画幅）之后同步补画当前帧，避免清屏到下一帧 rAF 之间的空白
- UI 面板隐藏后 `visibility: hidden`，不再参与合成
- 内存随帧尺寸线性增长：手机建议 `--long-edge 960` 以内；旧版 zip 的雪碧图解析仍留在 Web client 里（兼容导入旧包），
  但仓库不再生成 zip

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
  gui/              原生窗口 GUI（MyGo native UI，Go + scripts/bundle.py）
    main.go           界面与构建流程
    env.go            路径检测、ffmpeg 下载、设置持久化
scripts/
  bundle.py         视频 → 单文件 .orb（唯一资产构建脚本，GUI 也调它）
  serve.py          多线程静态服务
  serve_tls.py      HTTPS 服务（手机陀螺仪必需，自动生成自签证书）
  make-legacy.mjs   由 index.html 生成 legacy.html
  legacy-polyfill.js  Pointer Events / ResizeObserver 兜底
.github/workflows/
  npm-publish.yml   SDK 校验与 npm 发布（NPM_TOKEN 占位）
```

每个示例目录只有 `scene.orb` 一个产物，中间帧在临时目录里解码、构建完成即删。

## 兼容性

Canvas + `Image` + `ResizeObserver`。陀螺仪需要安全上下文
（`https://` 或 `localhost`），iOS 需在用户手势内调用 `DeviceOrientationEvent.requestPermission()`；
Android 优先使用 `deviceorientationabsolute` 的绝对朝向，无传感器时自动回退到拖拽。
