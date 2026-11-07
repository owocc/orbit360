# ORB3 稳定错误码

所有实现解析失败时返回（或抛出）一个带 `code` 的错误对象：

```ts
type OrbError = {
  code: OrbErrorCode;
  message: string;
  offset?: number;
};
```

`message` 只用于调试，不属于跨语言兼容契约。conformance 只比较 `code`。

## 错误码

| code                           | 触发条件                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `ORB_TRUNCATED_HEADER`         | 文件小于 32 字节                                                                     |
| `ORB_INVALID_MAGIC`            | 前 4 字节不是 `ORB3`                                                                 |
| `ORB_UNSUPPORTED_VERSION`      | Header `version` 不是 `0x00010002`                                                   |
| `ORB_INVALID_INDEX_ENTRY_SIZE` | `indexEntrySize` 不是 16                                                             |
| `ORB_INVALID_FRAME_COUNT`      | Header `frameCount` 为 0，或某视频 `frames.count` 不是正整数                         |
| `ORB_INVALID_INDEX_LENGTH`     | `indexLen !== frameCount * 16`                                                       |
| `ORB_INVALID_PREFIX_LENGTH`    | `prefixLen !== 32 + metaLen + indexLen`                                              |
| `ORB_TRUNCATED_PREFIX`         | 文件长度小于 `prefixLen`                                                             |
| `ORB_INVALID_META_JSON`        | Meta 不是合法 UTF-8 JSON 对象                                                        |
| `ORB_INVALID_META`             | Meta 不是 JSON 对象                                                                  |
| `ORB_INVALID_FORMAT`           | `meta.format !== "orbit360.bundle"`                                                  |
| `ORB_INVALID_META_VERSION`     | `meta.version !== 1.2`                                                               |
| `ORB_INVALID_CANVAS`           | `canvas.width/height` 不是正整数                                                     |
| `ORB_FRAME_COUNT_MISMATCH`     | `meta.totalFrames !== header.frameCount`，或视频帧数之和与 `frameCount` 不一致       |
| `ORB_INVALID_CODEC`            | `meta.codec` 不是非空字符串                                                          |
| `ORB_INVALID_VIDEOS`           | `meta.videos` 不是非空数组，或视频缺少 `rect/frames`                                 |
| `ORB_INVALID_ORBIT`            | `meta.orbit` 或视频 `orbit` 存在但不是对象                                           |
| `ORB_INVALID_AXIS`             | `orbit.axis` 不是 `x` / `y`                                                          |
| `ORB_INVALID_DIRECTION`        | `orbit.direction` 不是 `cw` / `ccw`                                                  |
| `ORB_INVALID_SPAN`             | `orbit.spanDeg` 存在但不是 `(0, 360]` 内的有限数                                     |
| `ORB_INVALID_ANGLE_RANGE`      | `orbit.minAngle/maxAngle` 不是 `[-180, 180]` 内的有限数，或 `minAngle >= maxAngle`   |
| `ORB_INVALID_VIDEO_ORBIT`      | 视频级 `orbit` 与场景级 `orbit` 的 `axis/direction/spanDeg/minAngle/maxAngle` 不一致 |
| `ORB_INVALID_INDEX_START`      | `videos[i].frames.indexStart` 与前序视频帧数之和不一致                               |
| `ORB_INVALID_RECT`             | `rect` 不是整数、宽高非正、或超出 `canvas`                                           |
| `ORB_INVALID_INDEX`            | 索引项 `video` 编号错误、`length` 为 0、`offset` 不连续、或文件尾部有多余数据        |
| `ORB_TRUNCATED_FRAME`          | 索引项 `offset + length` 超出文件长度                                                |
| `ORB_INVALID_ARGUMENT`         | `frameEntry` / `frameBytes` 的 video/frame 参数越界                                  |

## 稳定字段

错误对象中只有 `code` 和 `offset`（字节偏移，可选）是稳定字段。新增错误码属于规范变更，必须同时更新本文件、fixtures 和全部实现。
