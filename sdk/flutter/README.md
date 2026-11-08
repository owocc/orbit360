# orbit360_render

ORB3/v1 解析器、确定性 `OrbitEngine`、布局计算和 Flutter `CustomPainter` 渲染组件。

```dart
final controller = OrbitRenderController();
await controller.loadFile(File('scene.orb'));
controller.setFit('cover');
controller.enableGyro();
```

`OrbitRenderWidget(controller: controller)` 使用 Ticker 计算 `dtMs`，把指针事件转发给
`onPointerDown / onPointerMove / onPointerUp`。引擎本身不读取时钟。

## 独立 API

```dart
final bundle = OrbBundle.parse(bytes);
final frame = bundle.frameBytes(0, 0);

final engine = OrbitEngine(
  EngineBundle(
    canvasWidth: 1280,
    canvasHeight: 720,
    initialAngle: 0,
    videos: [
      EngineLayerInput(
        rect: {'x': 0, 'y': 0, 'width': 1280, 'height': 720},
        frameCount: 36,
      ),
    ],
    sceneConfig: bundle.sceneConfig,
  ),
);
engine.setAngle(90, immediate: true);
engine.advance(16);
final snapshot = engine.getSnapshot();
```

## 测试

```bash
flutter pub get
flutter test
```

`test/conformance_test.dart` 直接读取仓库根 `fixtures/` 与 `conformance/`，覆盖
parser、engine、layout、lifecycle。
