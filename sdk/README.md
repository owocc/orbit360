# SDK

各语言版本的 ORB3（`.orb`）读取实现。目录按语言拆分，共享同一套文件格式：

```
sdk/
  js/
    package.json      npm 包 @orbit360/javascript
    orb.js            ORB3 解析器（UMD，零依赖）
    orb.d.ts          解析器类型
    src/client.mjs    Web client 源码（渲染核心，不含 UI）
    dist/             构建产物：IIFE / ESM / CJS
    web-client.d.ts   Web client 类型
    README.md         npm 包说明
```

## JavaScript

npm：

```bash
npm install @orbit360/javascript
```

解析 `.orb`：

```js
const OrbBundle = require('@orbit360/javascript');
const orb = await OrbBundle.fromBlob(file);
```

Web 渲染客户端（不包含 UI，所有控制项通过 API）：

```js
import { Orbit360Client } from '@orbit360/javascript/web-client';

const client = new Orbit360Client(canvas, { container: stage, input: stage });
await client.load('assets/maid/scene.orb');
client.setAutoRotate('cw');
client.setFit('cover');
console.log(client.getAngle(), client.getState());
```

浏览器全局版：

```html
<script src="sdk/js/dist/orbit360-client.js"></script>
<script>
  const client = new Orbit360.Client(canvas, { container: stage, input: stage });
</script>
```

完整 API、配置和事件见 [sdk/js/README.md](js/README.md)。

## 发布

npm 包信息在 `sdk/js/package.json`，发布由 `.github/workflows/npm-publish.yml` 负责：

- PR / 手动运行：安装依赖、构建 `dist`、校验 web client、`npm pack --dry-run`
- GitHub Release：校验后执行 `npm publish --access public --provenance`
- 手动运行且关闭 `dry_run`：同样执行发布

发布前在仓库 `Settings → Secrets and variables → Actions` 添加 `NPM_TOKEN`，
并先更新 `sdk/js/package.json` 的 `version`（npm 不允许覆盖已发布版本）。
工作流里的 `NPM_TOKEN` 目前是占位引用，未配置时不会成功发布。

## 新增其他语言

建议每个语言一个目录（如 `sdk/go/`、`sdk/rust/`、`sdk/python/`），至少提供：

1. 读取 32B Header，并校验 magic / version / prefixLen / indexLen；
2. 解析 Meta JSON 与 16B 索引项（`<IIQ>`）；
3. 按 `offset/length` 取帧，支持只读文件前缀（HTTP Range）；
4. 校验 `videos[].frames.indexStart`、`totalFrames` 与索引连续性。

解析逻辑应以 `sdk/js/orb.js` 为参考，但不要依赖浏览器 API；核心校验规则保持一致。
