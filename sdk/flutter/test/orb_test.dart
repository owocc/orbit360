import 'package:flutter_test/flutter_test.dart';
import 'dart:io';
import 'package:orbit360_render/src/orb.dart';

void main() {
  test('parse scene.orb from assets/maid/scene.orb', () {
    final file = File('../../assets/maid/scene.orb');
    if (!file.existsSync()) {
      // Try from cwd main
      final alt = File('assets/maid/scene.orb');
      expect(alt.existsSync(), isTrue);
      final bytes = alt.readAsBytesSync();
      final bundle = OrbBundle.parse(bytes);
      expect(bundle.header.frameCount, greaterThan(0));
      expect(bundle.meta.format, equals('orbit360.bundle'));
      return;
    }
    final bytes = file.readAsBytesSync();
    final bundle = OrbBundle.parse(bytes);
    expect(bundle.header.frameCount, equals(120));
    expect(bundle.meta.format, equals('orbit360.bundle'));
    expect(bundle.meta.videos.length, equals(1));
    expect(bundle.entries.length, equals(120));
    final frame0 = bundle.frameBytes(0, 0);
    expect(frame0.length, greaterThan(0));
  });
}
