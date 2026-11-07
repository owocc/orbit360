import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:orbit360_render/src/engine.dart';
import 'package:orbit360_render/src/layout.dart';
import 'package:orbit360_render/src/orb.dart';

Directory _projectRoot() {
  var dir = Directory.current;
  for (var i = 0; i < 8; i++) {
    if (Directory('${dir.path}/conformance').existsSync()) return dir;
    dir = dir.parent;
  }
  throw StateError('找不到仓库根目录（conformance/）');
}

Map<String, dynamic> _readJson(File file) =>
    jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;

List<File> _jsonFiles(Directory dir) {
  final files = dir
      .listSync()
      .whereType<File>()
      .where((file) => file.path.endsWith('.json'))
      .toList();
  files.sort((a, b) => a.path.compareTo(b.path));
  return files;
}

void _compare(Object? actual, Object? expected, String where) {
  if (expected is num) {
    expect(actual, isA<num>(), reason: where);
    expect((actual as num).toDouble(), closeTo(expected.toDouble(), 1e-6),
        reason: where);
    return;
  }
  if (expected is List) {
    expect(actual, isA<List>(), reason: where);
    final values = actual as List;
    expect(values.length, expected.length, reason: '$where.length');
    for (var i = 0; i < expected.length; i++) {
      _compare(values[i], expected[i], '$where[$i]');
    }
    return;
  }
  if (expected is Map) {
    expect(actual, isA<Map>(), reason: where);
    final values = actual as Map;
    for (final key in expected.keys) {
      _compare(values[key], expected[key], '$where.$key');
    }
    return;
  }
  expect(actual, expected, reason: where);
}

void _applyEvent(OrbitEngine engine, Map<String, dynamic> event) {
  switch (event['type']) {
    case 'setAngle':
      engine.setAngle((event['angle'] as num).toDouble(),
          immediate: event['immediate'] == true);
      break;
    case 'rotateBy':
      engine.rotateBy((event['deg'] as num).toDouble());
      break;
    case 'pointerDown':
      engine.pointerDown(
        (event['x'] as num).toDouble(),
        (event['y'] as num).toDouble(),
        (event['timeMs'] as num).toDouble(),
      );
      break;
    case 'pointerMove':
      engine.pointerMove(
        (event['x'] as num).toDouble(),
        (event['y'] as num).toDouble(),
        (event['timeMs'] as num).toDouble(),
      );
      break;
    case 'pointerUp':
      engine.pointerUp((event['timeMs'] as num).toDouble());
      break;
    case 'gyro':
      engine.gyro(
        (event['heading'] as num).toDouble(),
        (event['timeMs'] as num).toDouble(),
      );
      break;
    case 'advance':
      engine.advance((event['dtMs'] as num).toDouble());
      break;
    case 'pause':
      engine.pause();
      break;
    case 'resume':
      engine.resume();
      break;
    case 'reset':
      engine.reset(
        event['angle'] == null ? 0 : (event['angle'] as num).toDouble(),
        immediate: event['immediate'] != false,
      );
      break;
    case 'load':
      engine
          .load(EngineBundle.fromJson(event['bundle'] as Map<String, dynamic>));
      break;
    case 'unload':
      engine.unload();
      break;
    case 'destroy':
      engine.destroy();
      break;
    case 'setConfig':
      engine.setConfig(event['config'] is Map
          ? Map<String, dynamic>.from(event['config'] as Map)
          : {});
      break;
    default:
      throw StateError('unknown event type: ${event['type']}');
  }
}

void main() {
  final root = _projectRoot();
  final conformance = Directory('${root.path}/conformance');

  group('parser conformance', () {
    for (final file in _jsonFiles(Directory('${conformance.path}/parser'))) {
      final item = _readJson(file);
      test(item['name'] as String, () {
        final bytes = Uint8List.fromList(
            File('${root.path}/${item['file']}').readAsBytesSync());
        final expected = item['expect'] as Map<String, dynamic>;
        if (expected['success'] == true) {
          final bundle = OrbBundle.parse(bytes);
          expect(bundle.header.frameCount, expected['frameCount']);
          expect(bundle.meta.videos.length, expected['videoCount']);
          expect(
            bundle.meta.videos.map((video) => video.frames.count).toList(),
            expected['videoFrameCounts'],
          );
          expect(
            {
              'width': bundle.meta.canvasWidth,
              'height': bundle.meta.canvasHeight,
            },
            expected['canvas'],
          );
          expect(bundle.meta.initialAngle, expected['initialAngle']);
          final frames = expected['frames'] as List;
          for (var vi = 0; vi < frames.length; vi++) {
            final videoFrames = frames[vi] as List;
            for (var fi = 0; fi < videoFrames.length; fi++) {
              expect(base64Encode(bundle.frameBytes(vi, fi)), videoFrames[fi]);
            }
          }
        } else {
          String code = 'NO_ERROR';
          try {
            OrbBundle.parse(bytes);
          } on OrbMetaException catch (error) {
            code = error.code;
          }
          expect(code, expected['errorCode']);
        }
      });
    }
  });

  for (final dir in ['engine', 'lifecycle']) {
    group('$dir conformance', () {
      for (final file in _jsonFiles(Directory('${conformance.path}/$dir'))) {
        final item = _readJson(file);
        test(item['name'] as String, () {
          final engine = OrbitEngine(
            EngineBundle.fromJson(item['bundle'] as Map<String, dynamic>),
            userConfig: item['config'] is Map
                ? Map<String, dynamic>.from(item['config'] as Map)
                : const {},
          );
          for (final event in item['events'] as List? ?? const []) {
            _applyEvent(engine, Map<String, dynamic>.from(event as Map));
          }
          _compare(
              engine.getSnapshot(), item['expect'], item['name'] as String);
        });
      }
    });
  }

  group('layout conformance', () {
    for (final file in _jsonFiles(Directory('${conformance.path}/layout'))) {
      final item = _readJson(file);
      test(item['name'] as String, () {
        final input = Map<String, dynamic>.from(item);
        input.remove('name');
        input.remove('kind');
        input.remove('expect');
        _compare(computeLayout(input), item['expect'], item['name'] as String);
      });
    }
  });
}
