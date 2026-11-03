# @orbit360/javascript

ORB3（`.orb`）场景包解析器。浏览器 / Node 通用，零依赖，只读取文件头和索引，
帧数据按 `offset/length` 切片，适合配合 HTTP Range 按需加载。

## 安装

```bash
npm install @orbit360/javascript
```

## 使用

```js
const OrbBundle = require('@orbit360/javascript');

const orb = await OrbBundle.fromBlob(file);   // File / Blob
orb.meta;                                     // 场景 meta
orb.frameEntry(videoIndex, frameIndex);       // { video, length, offset }
orb.frameBlob(videoIndex, frameIndex);        // 该帧 Blob

const whole = OrbBundle.parse(arrayBuffer);   // 整文件
const head = OrbBundle.parse(prefixBuffer);   // 也可以只给前 prefixLen 字节
```

浏览器直接引入时挂到 `window.OrbBundle`：

```html
<script src="node_modules/@orbit360/javascript/orb.js"></script>
```

ESM / TypeScript：

```ts
import OrbBundle from '@orbit360/javascript';
```

完整格式说明、字段含义和生成方式见
[orbit360 仓库](https://github.com/owocc/orbit360) 的「场景包」一节。
