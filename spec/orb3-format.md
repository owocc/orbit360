# ORB3 文件格式 v1

ORB3 是 orbit360 唯一支持的场景包格式。正式版本为 **ORB3/v1**，Header 版本字面量为：

```text
version = major << 16 | minor = 1 << 16 | 2 = 0x00010002
```

其他任何版本（包括旧版裸整数 `1`、`0x00010001`）都返回 `ORB_UNSUPPORTED_VERSION`。不存在 ZIP、自动探测或 fallback 路径。

## 1. 字节序与位宽

所有整数均为小端。本文中的 `uint32` / `uint64` 是无符号固定位宽整数。

| 语言       | `uint64` 表示                                                                   |
| ---------- | ------------------------------------------------------------------------------- |
| TypeScript | `number`，且必须满足 `<= Number.MAX_SAFE_INTEGER`；超出返回 `ORB_INVALID_INDEX` |
| Dart       | `int`（64 位）                                                                  |
| Go         | `uint64`                                                                        |
| Python     | `int`                                                                           |

## 2. 文件布局

```text
offset 0                      Header        32 bytes
offset 32                     Meta          metaLen bytes (UTF-8 JSON)
offset 32 + metaLen           Index         indexLen bytes
offset prefixLen              Payload       frames, 连续排列
```

```text
prefixLen = 32 + metaLen + indexLen
indexLen  = frameCount * 16
```

## 3. Header（32 字节）

| 偏移 | 类型       | 字段             | 值                                 |
| ---- | ---------- | ---------------- | ---------------------------------- |
| 0    | `uint8[4]` | `magic`          | ASCII `ORB3` = `4F 52 42 33`       |
| 4    | `uint32`   | `version`        | `0x00010002`                       |
| 8    | `uint32`   | `prefixLen`      | `32 + metaLen + indexLen`          |
| 12   | `uint32`   | `metaLen`        | Meta JSON 字节数                   |
| 16   | `uint32`   | `indexLen`       | `frameCount * 16`                  |
| 20   | `uint32`   | `frameCount`     | 大于 0                             |
| 24   | `uint32`   | `indexEntrySize` | `16`                               |
| 28   | `uint32`   | `flags`          | 保留，当前为 0；解析器不得依赖其值 |

## 4. Index（每项 16 字节）

| 偏移 | 类型     | 字段                               |
| ---- | -------- | ---------------------------------- |
| 0    | `uint32` | `video`                            |
| 4    | `uint32` | `length`（字节数，大于 0）         |
| 8    | `uint64` | `offset`（相对文件起点，绝对定位） |

索引按 `videos` 顺序、再按各视频帧顺序排列。`offset` 必须严格连续：第一项等于 `prefixLen`，之后每项等于前一项 `offset + length`。最后一项结束位置必须等于文件长度。

## 5. Meta

Meta 是一个 UTF-8 JSON 对象。必需字段：

```json
{
  "format": "orbit360.bundle",
  "version": 1.2,
  "title": "…",
  "canvas": { "width": 1280, "height": 720 },
  "totalFrames": 72,
  "codec": "image/webp",
  "initialAngle": 0,
  "orbit": {
    "axis": "x",
    "direction": "cw",
    "spanDeg": 360,
    "minAngle": -180,
    "maxAngle": 180
  },
  "videos": [
    {
      "id": "v1",
      "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 },
      "orbit": {
        "axis": "x",
        "direction": "cw",
        "spanDeg": 360,
        "minAngle": -180,
        "maxAngle": 180
      },
      "frames": {
        "count": 72,
        "width": 1280,
        "height": 720,
        "fps": 12,
        "indexStart": 0
      }
    }
  ]
}
```

字段语义：

- `format`：固定 `orbit360.bundle`。
- `version`：固定数字 `1.2`。
- `canvas`：正整数宽高，所有 `rect` 必须落在其内。
- `totalFrames`：必须等于 Header `frameCount`，也等于所有视频 `frames.count` 之和。
- `codec`：非空 MIME 字符串，例如 `image/webp`。解析器不解码帧。
- `initialAngle`：数字，缺省 `0`。
- `orbit`：场景级轨道配置。
  - `axis`：`x`（水平环视）或 `y`（俯仰），缺省 `x`。
  - `direction`：`cw` 或 `ccw`，缺省 `cw`。
  - `spanDeg`：帧序列覆盖的角度，`(0, 360]`，缺省 `360`。
  - `minAngle` / `maxAngle`：`[-180, 180]`，`minAngle < maxAngle`，缺省 `-180` / `180`。
- `videos`：非空数组。
  - `rect`：整数像素矩形，`x >= 0`、`y >= 0`、`width > 0`、`height > 0`，且 `x + width <= canvas.width`、`y + height <= canvas.height`。
  - `orbit`：可省略。省略的字段继承场景级值；显式提供的字段必须与场景级值完全相等。
  - `frames.count`：正整数。
  - `frames.indexStart`：从 0 开始连续累加，第 0 个视频必须为 0。
  - `frames.width/height/fps`：描述性字段，解析器不校验。

`videos` 之外的顶层键（`video`、`drag`、`motion`、`auto`、`gyro`、`mouseFollow`、`defaults`、`quality`）由引擎作为场景配置读取，见 `orbit-api.md`。

## 6. 解析器 API

所有语言提供语义等价的三个操作：

```text
parse(bytes) -> Bundle
frameEntry(videoIndex, frameIndex) -> { video, length, offset }
frameBytes(videoIndex, frameIndex) -> bytes
```

解析器只处理内存字节：不访问文件系统、网络、Canvas、图片解码或时钟。

## 7. 完整性

`parse` 要求输入是完整文件。任何截断、越界、尾部多余数据都属于非法文件。只读取前缀（HTTP Range）不是 ORB3/v1 的要求。
