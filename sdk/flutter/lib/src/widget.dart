import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import 'controller.dart';
import 'layout.dart';

class OrbitRenderWidget extends StatefulWidget {
  final OrbitRenderController controller;

  const OrbitRenderWidget({
    super.key,
    required this.controller,
  });

  @override
  State<OrbitRenderWidget> createState() => _OrbitRenderWidgetState();
}

class _OrbitRenderWidgetState extends State<OrbitRenderWidget>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      widget.controller.tick(DateTime.now().millisecondsSinceEpoch);
    });
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        return MouseRegion(
          cursor: widget.controller.dragging
              ? SystemMouseCursors.grabbing
              : SystemMouseCursors.grab,
          onHover: (event) {
            widget.controller.onPointerHover(event.delta);
          },
          child: Listener(
            behavior: HitTestBehavior.opaque,
            onPointerDown: (event) {
              widget.controller.onPointerDown(event.position);
            },
            onPointerMove: (event) {
              widget.controller.onPointerMove(event.position);
            },
            onPointerUp: (_) {
              widget.controller.onPointerUp();
            },
            onPointerCancel: (_) {
              widget.controller.onPointerUp();
            },
            child: CustomPaint(
              size: Size.infinite,
              painter: _OrbitPainter(
                controller: widget.controller,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _OrbitPainter extends CustomPainter {
  final OrbitRenderController controller;

  _OrbitPainter({required this.controller});

  @override
  void paint(Canvas canvas, Size size) {
    if (!controller.isReady || controller.layers.isEmpty) {
      return;
    }

    final cw = controller.canvasWidth.toDouble();
    final ch = controller.canvasHeight.toDouble();
    if (cw <= 0 || ch <= 0 || size.width <= 0 || size.height <= 0) return;

    final plan = computeLayout({
      'canvas': {'width': cw, 'height': ch},
      'viewport': {'width': size.width, 'height': size.height},
      'fit': controller.fit,
      'displayScale': 1,
      'portraitScale': 1.25,
      'layers': [
        for (var i = 0; i < controller.layers.length; i++)
          {
            'layerIndex': i,
            'rect': {
              'x': controller.layers[i].rect.x,
              'y': controller.layers[i].rect.y,
              'width': controller.layers[i].rect.width,
              'height': controller.layers[i].rect.height,
            },
          },
      ],
    });
    final planLayers = plan['layers'] as List;

    final paint = Paint()..filterQuality = FilterQuality.medium;

    for (int i = 0; i < controller.layers.length; i++) {
      final img = controller.currentFrameForLayer(i);
      if (img == null) continue;

      final rect = (planLayers[i] as Map<String, dynamic>)['rect']
          as Map<String, dynamic>;
      final dstRect = Rect.fromLTWH(
        (rect['x'] as num).toDouble(),
        (rect['y'] as num).toDouble(),
        (rect['width'] as num).toDouble(),
        (rect['height'] as num).toDouble(),
      );

      canvas.drawImageRect(
        img,
        Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()),
        dstRect,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _OrbitPainter oldDelegate) => true;
}
