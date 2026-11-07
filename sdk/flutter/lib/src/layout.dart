import 'dart:math' as math;

Map<String, dynamic> computeLayout(Map<String, dynamic> input) {
  final canvas = Map<String, dynamic>.from(input['canvas'] as Map);
  final viewport = Map<String, dynamic>.from(input['viewport'] as Map);
  final canvasWidth = (canvas['width'] as num).toDouble();
  final canvasHeight = (canvas['height'] as num).toDouble();
  final viewportWidth = (viewport['width'] as num).toDouble();
  final viewportHeight = (viewport['height'] as num).toDouble();
  final cover = input['fit'] == 'cover';
  final displayScale = input['displayScale'] is num
      ? (input['displayScale'] as num).toDouble()
      : 1.0;
  final portraitScale = input['portraitScale'] is num
      ? (input['portraitScale'] as num).toDouble()
      : 1.25;
  final fitScale =
      math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight);
  final coverScale =
      math.max(viewportWidth / canvasWidth, viewportHeight / canvasHeight);
  final base = cover
      ? coverScale
      : fitScale * (viewportHeight > viewportWidth ? portraitScale : 1.0);
  final scale = base * (cover ? 1.0 : displayScale);
  final width = canvasWidth * scale;
  final height = canvasHeight * scale;
  final destination = {
    'x': (viewportWidth - width) / 2,
    'y': (viewportHeight - height) / 2,
    'width': width,
    'height': height,
  };
  final layers = <Map<String, dynamic>>[];
  final inputLayers =
      input['layers'] is List ? input['layers'] as List : const [];
  for (final item in inputLayers) {
    final layer = Map<String, dynamic>.from(item as Map);
    final rect = Map<String, dynamic>.from(layer['rect'] as Map);
    final dx = (rect['x'] as num).toDouble();
    final dy = (rect['y'] as num).toDouble();
    final dw = (rect['width'] as num).toDouble();
    final dh = (rect['height'] as num).toDouble();
    layers.add({
      'layerIndex': layer['layerIndex'],
      'rect': {
        'x': (destination['x'] as double) + dx * scale,
        'y': (destination['y'] as double) + dy * scale,
        'width': dw * scale,
        'height': dh * scale,
      },
    });
  }
  return {'scale': scale, 'destinationRect': destination, 'layers': layers};
}
