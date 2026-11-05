# @orbit360/douyin-miniprogram

ORB3（`.orb`）场景包解析器与 Canvas 2D 渲染客户端，用于**抖音小程序**。
API 与 [`@orbit360/javascript/web-client`](../js/README.md) 基本一致，渲染逻辑移植自 web SDK，
去掉了 DOM 依赖，只保留小程序能用的能力。

- 解析 `.orb`（Header / Meta / 16B 索引 / 按 offset+length 取帧）
- Canvas 2D 帧切换、拖拽、惯性、自动环绕、自动布局
- 抖音设备姿态（`tt.onDeviceMotionChange`）控制视角
- 不依赖 npm 运行时，单文件 CommonJS 产物可直接放进小程序

## 安装

```bash
npm install @orbit360/douyin-miniprogram
```

如果使用抖音开发者工具的「构建 npm」，配置好 npm 后在小程序里：

```js
const { createClient } = require("@orbit360/douyin-miniprogram");
```

更简单的做法是直接把 `dist/orbit360-douyin.js` 复制到小程序目录（示例就是这么做的），
无需构建 npm。

## 快速开始

TTML：

```html
<canvas
  type="2d"
  id="orbit-canvas"
  class="scene"
  bindtouchstart="onTouchStart"
  catchtouchmove="onTouchMove"
  bindtouchend="onTouchEnd"
  bindtouchcancel="onTouchCancel"
></canvas>
```

JS：

```js
const { createClient } = require("./sdk/orbit360.js");

Component({
  lifetimes: {
    async ready() {
      const client = await createClient({
        selector: "#orbit-canvas",
        component: this, // 组件内需要；页面可省略
        config: {
          auto: { enabled: true, dir: "cw", degPerSec: 12 },
        },
      });

      client.on("state", (state) => console.log(state.angle, state.frameIndex));
      client.on("progress", ({ progress }) => console.log(progress));

      // 包内文件 / 网络 URL / ArrayBuffer 都支持
      await client.load("/assets/maid/scene.orb");

      this.client = client;
    },
    detached() {
      this.client && this.client.destroy();
    },
  },
  methods: {
    onTouchStart(e) {
      this.client.touchStart(e);
    },
    onTouchMove(e) {
      this.client.touchMove(e);
    },
    onTouchEnd(e) {
      this.client.touchEnd(e);
    },
    onTouchCancel(e) {
      this.client.touchCancel(e);
    },
  },
});
```

### 为什么不自动绑定触摸？

抖音小程序 Canvas 2D 节点没有可用的 `addEventListener` 触摸转发，触摸事件必须由页面 / 组件的
`bindtouchstart` 等转发给 SDK。SDK 提供 `touchStart` / `touchMove` / `touchEnd` /
`touchCancel`，事件对象原样传入即可。

## createClient

```js
const client = await createClient({
  selector: "#orbit-canvas", // 默认 #orbit-canvas
  component: this, // 组件实例，Page 可省略
  width: 375, // 可选；默认使用节点布局尺寸
  height: 667,
  config: {}, // 同 web SDK 的配置
  dprCap: 2,
  concurrency: 6,
  autoStartGyro: false,
  deviceMotionInterval: "game", // normal | ui | game
});
```

也可以直接传 Canvas 节点（同步创建，需要自己提供 CSS 尺寸）：

```js
const { Orbit360Client } = require("./sdk/orbit360.js");
const client = new Orbit360Client(canvasNode, { width: 375, height: 667 });
```

## 加载

```js
await client.load("/assets/maid/scene.orb"); // 小程序包内文件
await client.load("https://cdn.example.com/maid/scene.orb"); // 网络文件（需配置合法域名）
await client.load(arrayBuffer); // 自己通过 tt.request / readFile 读到的二进制
await client.load("data:application/octet-stream;base64,....");

client.loadUrl(url);
client.loadFile(filePath);
client.loadBuffer(buffer);
client.unload();
```

从聊天选择文件后直接把返回的文件对象传给 `load`（需要运行环境提供
`tt.chooseMessageFile`；抖音小程序通常没有该 API，推荐用网络 URL 或包内文件）：

```js
tt.chooseMessageFile({
  count: 1,
  type: "file",
  extension: ["orb"],
  success: async (res) => {
    const file = res.tempFiles[0]; // { path, name, size }
    await client.load(file); // 自动使用 file.path
  },
});
```

`ttfile://`、`http://tmp/`、`http://usr/` 等抖音临时文件路径会走
`FileSystemManager.readFile`，不会被当成网络 URL。

只支持 ORB3（`.orb`），不支持旧版 zip 场景包。帧图片通过 `canvas.createImage()`
和 base64 data URL 解码，所以包里的 `meta.codec` 必须是抖音 Canvas 能解码的格式
（推荐 `image/webp`，兼容性不够时用 `--codec jpeg` 重新打包）。

## 配置 / 状态 / 事件

配置项、快捷方法、状态字段、事件与 web SDK 一致：

```js
client.setAutoRotate("cw");
client.setAutoSpeed(20);
client.setGyroConfig({ gain: 1.4 });
client.setInvert(false);
client.setFit("cover");
client.setOrbitConfig({ axis: "y", minAngle: -60, maxAngle: 60 });

client.getAngle();
client.getState();

const off = client.on("angle", ({ angle, frameIndex }) => {});
client.on("frame", ({ index, count }) => {});
client.on("ready", ({ meta, state }) => {});
client.on("error", (err) => {});
client.on("gyrochange", (e) => {});
client.on("longpress", () => {});
off();
```

与 web 的差异：

- 没有鼠标，`setMouseFollow()` 保留但无效
- 没有 `ResizeObserver`，窗口尺寸变化时调用 `client.resize(width, height)` 或
  `client.setViewport(width, height)`
- 陀螺仪使用 `tt.startDeviceMotionListening` / `tt.onDeviceMotionChange`；
  `autoStartGyro: true` 会在第一次触摸时自动启用
- `gyro.absolute` 恒为 `false`（抖音不区分绝对方向）
- 页面 `onHide` 时建议 `pause()` + `disableGyro()`，`onShow` 时 `resume()`

## 构建

```bash
cd sdk/douyin-miniprogram
vp pack
```

产物：

- `dist/index.{js,mjs}` + `dist/index.d.ts`：npm / 构建工具使用
- `dist/orbit360-douyin.js`：单文件 CommonJS，直接复制进小程序

## 兼容性

- 建议使用支持 Canvas 2D（`<canvas type="2d">`）和 `tt.createSelectorQuery().fields({ node: true })`
  的抖音基础库版本。
- 抖音小程序没有微信的 `tt.chooseMessageFile`；导入本地场景请先把 `.orb` 上传到 CDN，
  或把文件放进代码包后用 `/assets/xxx.orb` 加载。
- 帧图片优先写入 `USER_DATA_PATH` 临时文件，再交给 `canvas.createImage()`；
  文件不可用时自动回退到 data URL。
- 模拟器与真机的 WebP 解码能力可能不同；真机异常时可用 `--codec jpeg` 重新打包。
- `tt.getWindowInfo` 存在时优先使用，否则回退到 `tt.getSystemInfoSync()`。

## 许可

[PolyForm Noncommercial License 1.0.0](../../LICENSE)：源码公开，非商业用途免费（个人学习、研究、教育、
公益、政府机构），**商业用途需书面授权**。本包不是 OSI 开源包，商用前请先联系 `owocc`。
