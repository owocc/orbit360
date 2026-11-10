# SDK

ORB3/v1 的统一解析器、确定性 `OrbitEngine` 和各平台渲染适配器。

```text
spec/ + fixtures/ + conformance/   ← 唯一事实来源
        ↓
sdk/core/        TypeScript 解析器 + 引擎 + 布局（Web / 小程序 / Expo 共用）
sdk/js/          @orbit360/javascript（浏览器 + Node）
sdk/wechat-miniprogram/  微信小程序 Canvas 2D
sdk/douyin-miniprogram/  抖音小程序 Canvas 2D
sdk/expo/        Expo / React Native
sdk/flutter/     Flutter（Dart 独立实现）
sdk/go/          Go（独立实现）
sdk/mygo/        MyGo 原生窗口渲染适配器（复用 sdk/go）
```

## 目录

```text
sdk/
  core/                        @orbit360/core（workspace，私有）
    src/orb.ts                 ORB3/v1 解析与全部校验
    src/engine.ts              纯状态机，调用方传入 dtMs
    src/layout.ts              contain / cover / portraitScale / displayScale
    src/errors.ts              稳定错误码
    test/suite.ts              共享 conformance runner
  js/
    src/index.ts               解析器 + engine + layout 入口
    src/web-client.ts          Canvas 2D 适配器
  miniprogram/                 微信 / 抖音共用的 Canvas 2D 客户端
  wechat-miniprogram/          wx 平台适配器
  douyin-miniprogram/          tt 平台适配器
  expo/                        React Native 适配器
  flutter/                     Dart 解析器、引擎、布局、CustomPainter
  go/                          Go 解析器、引擎、布局
  mygo/                        MyGo 原生窗口渲染（复用 sdk/go）
```

## 使用

```bash
vp install
vp run build:sdk
vp test                 # Web / WeChat / Douyin / Expo 的 TypeScript conformance
vp run test:go          # Go conformance
vp run test:mygo        # MyGo 适配层（回放 parser conformance）
vp run test:flutter     # Flutter conformance
```

MyGo 适配层直接回放 `conformance/parser`，引擎与布局复用 `sdk/go` 的 conformance。

Web:

```js
import { Orbit360Client } from "@orbit360/javascript/web-client";
const client = new Orbit360Client(canvas, { container: stage, input: stage });
await client.load("assets/maid/scene.orb");
client.setAutoRotate("cw");
```

小程序使用 `createClient({ selector, component, config })`，触摸事件由页面转发给
`touchStart / touchMove / touchEnd`；陀螺仪由 `wx` / `tt` 的 device motion API 驱动。
API 与平台差异见各包 README。

MyGo 桌面：

```go
preview := orbit360.NewClient(orbit360.Options{Fit: orbit360.FitContain})
if err := preview.LoadFile("assets/orbit/scene.orb"); err != nil {
	log.Fatal(err)
}
defer preview.Close()

ui.Column(c).Fill().Children(func() {
	preview.View(c).Grow(1) // 拖拽 / 自动环绕 / 帧缓存
})
```

`View` 每帧推进 `OrbitEngine` 并按 `RenderPlan` 绘制，不启动浏览器、不依赖 WebView。
解码走 MyGo 的 WebP / JPEG / PNG，AVIF 不支持。详见 [mygo/README.md](mygo/README.md)。

## 规范

- 格式：`spec/orb3-format.md`
- 校验与错误码：`spec/orb3-validation.md`、`spec/errors.md`
- 引擎语义：`spec/orbit-api.md`
- 快照与布局：`spec/render-snapshot.md`
- 版本策略：`spec/compatibility.md`

所有平台只接受 Header `0x00010002`、`meta.version = 1.2`。ZIP、旧版 Meta / Index、
自动格式探测和失败 fallback 都不是支持范围。

## 新增平台

1. 实现 `parse(bytes)`、`frameEntry(videoIndex, frameIndex)`、`frameBytes(videoIndex, frameIndex)`。
2. 实现与 `spec/orbit-api.md` 完全一致的 `advance(dtMs)` 与事件操作。
3. 从 `fixtures/` 和 `conformance/` 读取用例，不得维护私有 expected values。
4. 在 CI 中执行 parser / engine / layout / lifecycle 四组 conformance。

## 发布

包在根 `pnpm-workspace.yaml` 的 workspace 里，依赖与安装由 `vp` 管理，发布由
`.github/workflows/npm-publish.yml` 负责。发布前在仓库 Secrets 添加 `NPM_TOKEN`，
并更新对应包的 `version`。
