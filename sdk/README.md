# SDK

ORB3（`.orb`）的解析器与浏览器渲染层在同一个包里：

```
sdk/
  js/
    package.json      npm 包 @orbit360/javascript
    src/orb.ts        ORB3 解析器（TypeScript，零依赖）
    src/client.ts     Canvas 渲染核心（TypeScript，不含 UI）
    src/index.ts      解析器入口
    src/web-client.ts web client 入口
    vite.config.ts    Vite+ pack 配置（ESM / CJS / IIFE + dts）
    dist/             构建产物
    README.md         包说明与完整 API
  wechat-miniprogram/
    package.json      npm 包 @orbit360/wechat-miniprogram
    src/orb.ts        小程序版解析器（ArrayBuffer / base64）
    src/client.ts     微信小程序 Canvas 2D 渲染核心
    src/index.ts      入口
    vite.config.ts    ESM / CJS / 单文件 CJS
    dist/             构建产物
    README.md         小程序 API 与平台差异
  mygo/
    go.mod            Go 模块 github.com/owocc/orbit360/sdk/mygo
    orb.go            ORB3 解析器（Header / Meta / Index / Frame）
    client.go         MyGo 原生渲染（拖拽 / 自动环绕 / fit / 帧缓存）
    README.md         Go API、MyGo 集成与解码支持
```

## 安装

```bash
npm install @orbit360/javascript
```

解析 `.orb`：

```js
const OrbBundle = require("@orbit360/javascript");
const orb = await OrbBundle.fromBlob(file);
```

渲染（不包含 UI，所有控制项通过 API）：

```js
import { Orbit360Client } from "@orbit360/javascript/web-client";

const client = new Orbit360Client(canvas, { container: stage, input: stage });
await client.load("assets/maid/scene.orb");
client.setAutoRotate("cw");
client.setFit("cover");
console.log(client.getAngle(), client.getState());
```

浏览器全局版（IIFE 暴露 `window.Orbit360`）：

```html
<script src="sdk/js/dist/orbit360-client.js"></script>
<script>
  const client = new Orbit360.Client(canvas, { container: stage, input: stage });
</script>
```

## 微信小程序

安装 `@orbit360/wechat-miniprogram`，或者直接把 `dist/orbit360-miniprogram.js` 复制进小程序。

```js
const { createClient } = require("./sdk/orbit360.js");

const client = await createClient({
  selector: "#orbit-canvas",
  component: this, // 组件内需要；页面可省略
  config: { auto: { enabled: true, dir: "cw" } },
});

await client.load("/assets/maid/scene.orb");
client.setAutoRotate("cw");
client.setFit("cover");
```

小程序没有 DOM，触摸事件需要在 WXML 上绑定后调用 `client.touchStart / touchMove / touchEnd`；
陀螺仪使用 `wx.startDeviceMotionListening`。完整示例见
[`examples/wechat-miniprogram/`](../examples/wechat-miniprogram/)，API 与平台差异见
[wechat-miniprogram/README.md](wechat-miniprogram/README.md)。

完整 API、配置和事件见 [js/README.md](js/README.md)，文件格式见仓库根 README。

## MyGo 桌面

`github.com/owocc/orbit360/sdk/mygo` 用 Go 解析 `.orb`，并在 MyGo 原生窗口里渲染；
不启动浏览器、不依赖 WebView。`apps/gui/` 的「预览」页直接用了它：

```go
preview := orbit360.NewClient(nil, orbit360.Options{Fit: orbit360.FitContain})
if err := preview.LoadFile("assets/maid/scene.orb"); err != nil {
	log.Fatal(err)
}
defer preview.Close()

ui.Column(c).Fill().Children(func() {
	preview.View(c).Grow(1)
})
```

支持拖拽、自动环绕、角度限制和帧缓存；解码走 MyGo 的 WebP / JPEG / PNG，AVIF 不支持。
详见 [mygo/README.md](mygo/README.md)。

## 发布

包在根 `pnpm-workspace.yaml` 的 workspace 里，依赖与安装由 `vp` 管理，发布由
`.github/workflows/npm-publish.yml` 负责：

- PR / 手动运行：安装依赖、构建 SDK 与页面、校验包、`vp pm pack --dry-run`
- GitHub Release：执行
  `vp pm publish`（在 `sdk/js` 下）

发布前在仓库 `Settings → Secrets and variables → Actions` 添加 `NPM_TOKEN`，
并按需更新 `sdk/js/package.json` 的 `version`（npm 不允许覆盖已发布版本）。

## 新增其他语言

建议每个语言一个目录（如 `sdk/go/`、`sdk/rust/`、`sdk/python/`），至少提供：

1. 读取 32B Header，并校验 magic / version（1.0 裸整数 1、1.1 = `0x00010001`、1.2 = `0x00010002`）/ prefixLen / indexLen；
2. 解析 Meta JSON 与 16B 索引项（`<IIQ>`）；
3. 按 `offset/length` 取帧，支持只读文件前缀（HTTP Range）；
4. 校验 `videos[].frames.indexStart`、`totalFrames` 与索引连续性；
5. 校验 `orbit.axis` 为 `x` / `y`（缺省 `x`），且每条视频与场景一致（一个场景只用一个轴）；
6. 校验 `orbit.minAngle` / `maxAngle` 在 `-180..180` 且 `min < max`（缺省 `-180 / 180`），
   角度语义为向右为正、向左为负，每条视频的限制与场景一致。

解析逻辑应以 `sdk/js/src/orb.ts` 为参考，但不要依赖浏览器 API；核心校验规则保持一致。
