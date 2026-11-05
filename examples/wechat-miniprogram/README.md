# orbit360 微信小程序示例

使用 [`@orbit360/wechat-miniprogram`](../../sdk/wechat-miniprogram) 在微信小程序里渲染
`.orb` 场景包的最小完整示例。

示例**不内置任何场景包**，启动后通过「导入 .orb 场景」按钮从微信聊天选择文件。

## 运行

1. 打开微信开发者工具，导入本目录（`examples/wechat-miniprogram`）；
2. AppID 选择「测试号」或填自己的 AppID（`project.config.json` 里默认 `touristappid`）；
3. 编译后页面会显示「导入 .orb 场景」。

> 已知限制：微信开发者工具的 iOS 模拟器对 Canvas 2D 绘制 WebP 帧支持不稳定，可能出现黑屏；
> **请使用「真机调试」**。如果必须在模拟器里看，可用 `--codec jpeg` 重新打包 `.orb`。

## 导入场景

1. 先把 `.orb` 文件发送到微信聊天，例如「文件传输助手」；
2. 回到小程序，点底部「＋ 导入 .orb 场景」；
3. 从聊天记录里选择 `.orb` 文件，等待解码完成。

实现使用 `wx.chooseMessageFile`：

```js
wx.chooseMessageFile({
  count: 1,
  type: "file",
  extension: ["orb"],
  success: (res) => {
    const file = res.tempFiles[0]; // { path, name, size }
    client.load(file); // SDK 会读取 file.path
  },
});
```

微信临时文件路径（`wxfile://`、`http://tmp/` 等）会被 SDK 当作本地文件读取，
不会误走网络请求。导入的包只支持 ORB3（`.orb`），旧版 zip 会提示不支持。

## 目录

```
project.config.json
miniprogram/
  app.js / app.json / app.wxss
  sitemap.json
  sdk/
    orbit360.js       从 sdk/wechat-miniprogram/dist/orbit360-miniprogram.js 复制
    orbit360.d.ts
  pages/index/
    index.js          创建 client、导入场景、转发触摸、控制栏
    index.wxml
    index.wxss
```

## 页面用法

```js
const { createClient } = require("../../sdk/orbit360.js");

const client = await createClient({
  selector: "#orbit-canvas",
  component: this,
  config: { auto: { enabled: true, dir: "cw", degPerSec: 12 } },
});

await client.load(file); // wx.chooseMessageFile 的 tempFiles[0]
```

触摸事件在 WXML 上绑定，再转发给 SDK：

```html
<canvas
  type="2d"
  id="orbit-canvas"
  bindtouchstart="onTouchStart"
  catchtouchmove="onTouchMove"
  bindtouchend="onTouchEnd"
  bindtouchcancel="onTouchCancel"
/>
```

```js
onTouchStart(e) {
  this.client.touchStart(e);
},
onTouchMove(e) {
  this.client.touchMove(e);
},
onTouchEnd(e) {
  this.client.touchEnd(e);
},
```

控制栏提供：自动环绕、陀螺仪、自适应 / 铺满。导入成功后可以继续导入其他场景。

## 更新 SDK

在仓库根目录构建后复制产物：

```bash
vp run --filter @orbit360/wechat-miniprogram build
cp sdk/wechat-miniprogram/dist/orbit360-miniprogram.js \
   examples/wechat-miniprogram/miniprogram/sdk/orbit360.js
```

完整 API 见 [SDK README](../../sdk/wechat-miniprogram/README.md)。
