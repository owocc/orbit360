import 'package:flutter_test/flutter_test.dart';
import 'package:orbit360_render/orbit360_render.dart';

void main() {
  test('OrbitConfig defaults and copyWith', () {
    const config = OrbitConfig();
    expect(config.fit, equals('contain'));
    expect(config.axis, equals('x'));
    expect(config.dragInertia, isTrue);

    final modified = config.copyWith(fit: 'cover', axis: 'y');
    expect(modified.fit, equals('cover'));
    expect(modified.axis, equals('y'));
  });

  test('OrbitRenderController state and angle math', () {
    final controller = OrbitRenderController(
      config: const OrbitConfig(minAngle: -180, maxAngle: 180),
    );
    expect(controller.angle, equals(0.0));
    controller.rotateBy(45);
    expect(controller.target, equals(45.0));

    final nextAuto = controller.cycleAuto();
    expect(nextAuto, equals('cw'));
    expect(controller.auto.enabled, isTrue);
  });
}
