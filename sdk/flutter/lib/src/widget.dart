import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import 'controller.dart';

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

    double dstW;
    double dstH;
    double dstX;
    double dstY;

    final fit = controller.fit;
    final scale = fit == 'cover'
        ? (cw / ch > size.width / size.height
            ? size.height / ch
            : size.width / cw)
        : (cw / ch > size.width / size.height
            ? size.width / cw
            : size.height / ch);

    dstW = cw * scale;
    dstH = ch * scale;
    dstX = (size.width - dstW) / 2.0;
    dstY = (size.height - dstH) / 2.0;

    final paint = Paint()..filterQuality = FilterQuality.medium;

    for (int i = 0; i < controller.layers.length; i++) {
      final layer = controller.layers[i];
      final img = controller.currentFrameForLayer(i);
      if (img == null) continue;

      final r = layer.rect;
      final sx = dstW / cw;
      final sy = dstH / ch;

      final srcRect = Rect.fromLTWH(
        0,
        0,
        img.width.toDouble(),
        img.height.toDouble(),
      );
      final dstRect = Rect.fromLTWH(
        dstX + r.x * sx,
        dstY + r.y * sy,
        r.width * sx,
        r.height * sy,
      );

      canvas.drawImageRect(img, srcRect, dstRect, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _OrbitPainter oldDelegate) => true;
}
