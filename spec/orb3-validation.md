# ORB3 解析校验

校验按下列顺序执行。fixture 中每个非法文件只触发其目标错误码，实现不得依赖未定义行为。

## 1. Header

```text
bytes.length < 32                                  -> ORB_TRUNCATED_HEADER
magic !== "ORB3"                                   -> ORB_INVALID_MAGIC
version !== 0x00010002                             -> ORB_UNSUPPORTED_VERSION
indexEntrySize !== 16                              -> ORB_INVALID_INDEX_ENTRY_SIZE
frameCount === 0                                   -> ORB_INVALID_FRAME_COUNT
indexLen !== frameCount * 16                       -> ORB_INVALID_INDEX_LENGTH
prefixLen !== 32 + metaLen + indexLen              -> ORB_INVALID_PREFIX_LENGTH
bytes.length < prefixLen                           -> ORB_TRUNCATED_PREFIX
```

## 2. Meta 基础字段

```text
Meta 不是 UTF-8 JSON                                -> ORB_INVALID_META_JSON
Meta 不是对象                                       -> ORB_INVALID_META
meta.format !== "orbit360.bundle"                  -> ORB_INVALID_FORMAT
meta.version !== 1.2                               -> ORB_INVALID_META_VERSION
canvas.width/height 不是正整数                      -> ORB_INVALID_CANVAS
meta.totalFrames !== header.frameCount             -> ORB_FRAME_COUNT_MISMATCH
meta.codec 不是非空字符串                           -> ORB_INVALID_CODEC
meta.videos 不是非空数组                            -> ORB_INVALID_VIDEOS
```

## 3. 场景 orbit

`orbit` 缺省为 `{}`，各字段取缺省值。存在但不是对象：

```text
-> ORB_INVALID_ORBIT
```

字段校验：

```text
axis ∉ {x, y}                                      -> ORB_INVALID_AXIS
direction ∉ {cw, ccw}                              -> ORB_INVALID_DIRECTION
spanDeg 不是有限数，或 spanDeg <= 0，或 spanDeg > 360 -> ORB_INVALID_SPAN
minAngle/maxAngle 不是有限数，或越出 [-180, 180]    -> ORB_INVALID_ANGLE_RANGE
minAngle >= maxAngle                               -> ORB_INVALID_ANGLE_RANGE
```

缺省值：`axis = "x"`、`direction = "cw"`、`spanDeg = 360`、`minAngle = -180`、`maxAngle = 180`。

## 4. 视频

对每个 `videos[i]`：

```text
video 不是对象，或缺少 rect/frames                 -> ORB_INVALID_VIDEOS
frames.count 不是正整数                             -> ORB_INVALID_FRAME_COUNT
frames.indexStart !== 前序 count 之和               -> ORB_INVALID_INDEX_START
rect 四个字段不是整数                               -> ORB_INVALID_RECT
rect.x < 0 / rect.y < 0 / width <= 0 / height <= 0  -> ORB_INVALID_RECT
rect.x + width > canvas.width                       -> ORB_INVALID_RECT
rect.y + height > canvas.height                     -> ORB_INVALID_RECT
```

视频级 `orbit`（若存在）必须是对象，否则 `ORB_INVALID_ORBIT`。显式提供的字段必须与场景级归一化后的值一致：

```text
axis、direction、spanDeg、minAngle、maxAngle
-> 不一致时 ORB_INVALID_VIDEO_ORBIT
```

未提供的字段继承场景值。

所有视频帧数之和：

```text
sum(frames.count) !== header.frameCount            -> ORB_FRAME_COUNT_MISMATCH
```

## 5. Index

遍历所有视频和帧，索引序号 `e` 从 0 开始：

```text
entry.video !== videoIndex                         -> ORB_INVALID_INDEX
entry.length === 0                                 -> ORB_INVALID_INDEX
entry.offset !== expectedOffset                    -> ORB_INVALID_INDEX
entry.offset + entry.length > bytes.length         -> ORB_TRUNCATED_FRAME
expectedOffset += entry.length
```

`expectedOffset` 初始为 `prefixLen`。遍历结束后：

```text
expectedOffset !== bytes.length                    -> ORB_INVALID_INDEX
```

## 6. 查询参数

```text
videoIndex 不在 [0, videos.length)                 -> ORB_INVALID_ARGUMENT
frameIndex 不在 [0, videos[videoIndex].frames.count) -> ORB_INVALID_ARGUMENT
```

## 7. 不可执行的行为

以下行为在所有实现中都被禁止：

- 接受任何非 `0x00010002` 的版本。
- 自动探测 ZIP 或其他容器。
- 校验失败后回退到旧格式。
- 忽略索引偏移不连续。
- 允许 `rect` 超出 `canvas`。
- 允许视频级 `orbit` 与场景级不一致。
- 在解析阶段解码图片。
