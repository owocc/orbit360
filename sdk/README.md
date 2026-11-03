# SDK

各语言版本的 ORB3（`.orb`）读取实现。目录按语言拆分，共享同一套文件格式：

```
sdk/
  js/
    package.json  npm 包 @orbit360/javascript
    orb.js       浏览器 / Node 通用（UMD，零依赖）
    orb.d.ts     TypeScript 类型
    README.md    npm 包说明
```

## JavaScript

npm：

```bash
npm install @orbit360/javascript
```

```js
const OrbBundle = require('@orbit360/javascript');

const orb = await OrbBundle.fromBlob(file);   // File / Blob，只读取 Header + Meta + Index
orb.meta;                                     // 场景 meta
orb.frameEntry(videoIndex, frameIndex);       // { video, length, offset }
orb.frameBlob(videoIndex, frameIndex);        // 该帧 Blob

const whole = OrbBundle.parse(arrayBuffer);   // 整文件
const head = OrbBundle.parse(prefixBuffer);   // 也可以只给前 prefixLen 字节
```

ESM / TypeScript：

```ts
import OrbBundle from '@orbit360/javascript';
```

浏览器里也可以直接引入，挂到 `window.OrbBundle`：

```html
<script src="sdk/js/orb.js"></script>
```

完整格式说明、字段含义和生成方式见仓库根目录 [README](../README.md) 的「场景包」一节。

## 发布

npm 包信息在 `sdk/js/package.json`，发布由 `.github/workflows/npm-publish.yml` 负责：

- PR / 手动运行：只做语法检查和 `npm pack --dry-run`
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
