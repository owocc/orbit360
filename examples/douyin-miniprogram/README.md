# orbit360 抖音小程序示例

使用 [`@orbit360/douyin-miniprogram`](../../sdk/douyin-miniprogram) 在抖音小程序里渲染
`.orb` 场景包的最小完整示例。

示例**不内置任何场景包**，启动后通过「导入 .orb 场景」按钮从抖音聊天选择文件。

## 运行

1. 打开抖音开发者工具，导入本目录（`examples/douyin-miniprogram`）；
2. AppID 换成自己的（`project.config.json` 里默认是仓库作者的测试 AppID）；
3. 编译后页面会显示「导入 .orb 场景」。

模拟器调试时，可以把 `miniprogram/pages/index/index.js` 顶部的 `DEMO_URL`
改成任意可访问的 `.orb` 地址，空状态会出现「加载演示场景」按钮。
`project.config.json` 已关闭 `urlCheck`。

## 导入场景

抖音小程序没有微信的 `tt.chooseMessageFile`，示例提供两种导入方式：

1. **网络地址**：把 `.orb` 上传到可访问的 CDN（或本地 HTTP 服务），在空状态输入框里填入地址后点「加载」；
2. **剪贴板**：复制 `.orb` 地址后点底部「从剪贴板粘贴 .orb 地址」，示例会读取 `tt.getClipboardData` 并加载。

若某些宿主环境提供了 `tt.chooseMessageFile`，示例会自动把底部按钮切换为「从聊天导入 .orb」。

```js
// 手动加载
await client.load("https://cdn.example.com/maid/scene.orb");

// 或者交给 SDK 自己请求，也可以用临时文件/包内文件
await client.load("/assets/maid/scene.orb");
```

导入的包只支持 ORB3（`.orb`），旧版 zip 会提示不支持。

> 模拟器调试时还可以把 `miniprogram/pages/index/index.js` 顶部的 `DEMO_URL` 填成
> 一个可访问的地址，空状态会多出「加载演示场景」按钮。

## 目录

```
project.config.json
miniprogram/
  app.js / app.json / app.ttss
  sdk/
    orbit360.js       从 sdk/douyin-miniprogram/dist/orbit360-douyin.js 复制
    orbit360.d.ts
  pages/index/
    index.js          创建 client、导入场景、转发触摸、控制栏
    index.ttml
    index.ttss
```

## 页面用法

```js
const { createClient } = require("../../sdk/orbit360.js");

const client = await createClient({
  selector: "#orbit-canvas",
  component: this,
  config: { auto: { enabled: true, dir: "cw", degPerSec: 12 } },
});

await client.load(file); // tt.chooseMessageFile 的 tempFiles[0]
```

触摸事件在 TTML 上绑定，再转发给 SDK：

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
vp run --filter @orbit360/douyin-miniprogram build
cp sdk/douyin-miniprogram/dist/orbit360-douyin.js \
   examples/douyin-miniprogram/miniprogram/sdk/orbit360.js
cp sdk/douyin-miniprogram/dist/index.d.ts \
   examples/douyin-miniprogram/miniprogram/sdk/orbit360.d.ts
```

完整 API 见 [SDK README](../../sdk/douyin-miniprogram/README.md)。
