# RenderSnapshot

引擎只输出快照，不直接绘制。所有平台从同一快照出发，由各自的 renderer 完成绘制。

## 1. EngineSnapshot

```json
{
  "ready": true,
  "loading": false,
  "paused": false,
  "destroyed": false,
  "angle": 12.5,
  "targetAngle": 14.2,
  "velocity": 0.08,
  "axis": "x",
  "direction": "cw",
  "spanDeg": 360,
  "minAngle": -180,
  "maxAngle": 180,
  "limited": false,
  "frameIndex": 1,
  "frameCount": 36,
  "frameDeg": 10,
  "dragging": false,
  "auto": {
    "state": "off",
    "enabled": false,
    "direction": "cw",
    "speed": 14,
    "weight": 0,
    "idleDelayMs": 2200,
    "rampInMs": 700,
    "rampOutMs": 280
  },
  "gyro": {
    "enabled": false,
    "seen": false,
    "gain": 1,
    "invert": false,
    "smooth": true,
    "smoothMs": 80
  },
  "layers": [
    {
      "layerIndex": 0,
      "frameIndex": 1,
      "frameCount": 36,
      "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 }
    }
  ]
}
```

字段规则：

- `angle` / `targetAngle`：按 `orbit-api.md` 归一化后的值。
- `velocity`：度/毫秒，范围 `[-0.55, 0.55]`。
- `frameIndex`：主帧索引，基于 `frameCount = max(videos[].frameCount)`。
- `frameDeg = spanDeg / max(1, frameCount)`。
- `layers[].frameIndex`：按多图层映射规则得到。
- `auto.weight`：自动旋转权重，`[0, 1]`。
- `gyro.enabled`：收到过至少一次 `gyro` 采样且未 `disableGyro`。
- 浮点输出保留 double 精度；跨语言比较使用绝对误差 `<= 1e-6`。

## 2. RenderPlan

布局是纯函数，与渲染后端无关：

```text
layout(canvas, viewport, options) -> {
  destinationRect: { x, y, width, height },
  layers: [{ layerIndex, rect: { x, y, width, height } }]
}
```

输入：

```json
{
  "canvas": { "width": 1280, "height": 720 },
  "viewport": { "width": 390, "height": 844 },
  "fit": "contain",
  "displayScale": 1,
  "portraitScale": 1.25,
  "layers": [{ "layerIndex": 0, "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 } }]
}
```

计算：

```text
cover = fit === "cover"
base =
  cover
    ? max(viewport.width / canvas.width, viewport.height / canvas.height)
    : min(viewport.width / canvas.width, viewport.height / canvas.height)
      * (viewport.height > viewport.width ? portraitScale : 1)

scale = base * (cover ? 1 : displayScale)

destinationRect.width  = canvas.width * scale
destinationRect.height = canvas.height * scale
destinationRect.x      = (viewport.width  - destinationRect.width)  / 2
destinationRect.y      = (viewport.height - destinationRect.height) / 2

layer.rect.x      = destinationRect.x + layer.canvasRect.x * scale
layer.rect.y      = destinationRect.y + layer.canvasRect.y * scale
layer.rect.width  = layer.canvasRect.width * scale
layer.rect.height = layer.canvasRect.height * scale
```

`fit = "cover"` 时忽略 `displayScale` 与 `portraitScale`，与 Web 参考行为一致。

## 3. 平台绘制

```text
Web          snapshot + plan -> Canvas 2D drawImage
微信 / 抖音   snapshot + plan -> Canvas drawImage
Flutter      snapshot + plan -> CustomPainter drawImageRect
Go SDK       snapshot + plan -> 调用方选择的 renderer
```

`RenderSnapshot` 与 `RenderPlan` 是跨平台契约；单个平台的绘制调用不做逐像素比较。
