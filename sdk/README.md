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

完整 API、配置和事件见 [js/README.md](js/README.md)，文件格式见仓库根 README。

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
