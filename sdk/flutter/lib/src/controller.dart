import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'engine.dart';
import 'orb.dart';

class OrbitConfig {
  final String title;
  final String fit;
  final String axis;
  final double spanDeg;
  final String direction;
  final double minAngle;
  final double maxAngle;
  final double dragDegPerPx;
  final bool dragInvert;
  final bool dragInertia;
  final double dragInertiaMs;
  final double motionSmoothMs;
  final bool autoEnabled;
  final String autoDir;
  final double autoDegPerSec;
  final double autoIdleDelayMs;
  final double autoRampInMs;
  final double autoRampOutMs;
  final double gyroGain;
  final bool gyroInvert;
  final bool gyroSmooth;
  final double gyroSmoothMs;
  final bool mouseFollowEnabled;
  final double mouseFollowDegPerPx;

  const OrbitConfig({
    this.title = '',
    this.fit = 'contain',
    this.axis = 'x',
    this.spanDeg = 360,
    this.direction = 'cw',
    this.minAngle = -180,
    this.maxAngle = 180,
    this.dragDegPerPx = 0.42,
    this.dragInvert = false,
    this.dragInertia = true,
    this.dragInertiaMs = 110,
    this.motionSmoothMs = 62,
    this.autoEnabled = false,
    this.autoDir = 'cw',
    this.autoDegPerSec = 14,
    this.autoIdleDelayMs = 2200,
    this.autoRampInMs = 700,
    this.autoRampOutMs = 280,
    this.gyroGain = 1.0,
    this.gyroInvert = false,
    this.gyroSmooth = true,
    this.gyroSmoothMs = 80,
    this.mouseFollowEnabled = false,
    this.mouseFollowDegPerPx = 0.3,
  });

  OrbitConfig copyWith({
    String? title,
    String? fit,
    String? axis,
    double? spanDeg,
    String? direction,
    double? minAngle,
    double? maxAngle,
    double? dragDegPerPx,
    bool? dragInvert,
    bool? dragInertia,
    double? dragInertiaMs,
    double? motionSmoothMs,
    bool? autoEnabled,
    String? autoDir,
    double? autoDegPerSec,
    double? autoIdleDelayMs,
    double? autoRampInMs,
    double? autoRampOutMs,
    double? gyroGain,
    bool? gyroInvert,
    bool? gyroSmooth,
    double? gyroSmoothMs,
    bool? mouseFollowEnabled,
    double? mouseFollowDegPerPx,
  }) {
    return OrbitConfig(
      title: title ?? this.title,
      fit: fit ?? this.fit,
      axis: axis ?? this.axis,
      spanDeg: spanDeg ?? this.spanDeg,
      direction: direction ?? this.direction,
      minAngle: minAngle ?? this.minAngle,
      maxAngle: maxAngle ?? this.maxAngle,
      dragDegPerPx: dragDegPerPx ?? this.dragDegPerPx,
      dragInvert: dragInvert ?? this.dragInvert,
      dragInertia: dragInertia ?? this.dragInertia,
      dragInertiaMs: dragInertiaMs ?? this.dragInertiaMs,
      motionSmoothMs: motionSmoothMs ?? this.motionSmoothMs,
      autoEnabled: autoEnabled ?? this.autoEnabled,
      autoDir: autoDir ?? this.autoDir,
      autoDegPerSec: autoDegPerSec ?? this.autoDegPerSec,
      autoIdleDelayMs: autoIdleDelayMs ?? this.autoIdleDelayMs,
      autoRampInMs: autoRampInMs ?? this.autoRampInMs,
      autoRampOutMs: autoRampOutMs ?? this.autoRampOutMs,
      gyroGain: gyroGain ?? this.gyroGain,
      gyroInvert: gyroInvert ?? this.gyroInvert,
      gyroSmooth: gyroSmooth ?? this.gyroSmooth,
      gyroSmoothMs: gyroSmoothMs ?? this.gyroSmoothMs,
      mouseFollowEnabled: mouseFollowEnabled ?? this.mouseFollowEnabled,
      mouseFollowDegPerPx: mouseFollowDegPerPx ?? this.mouseFollowDegPerPx,
    );
  }
}

class FrameInfo {
  final int index;
  final int count;
  final double frameDeg;

  const FrameInfo(
      {required this.index, required this.count, required this.frameDeg});
}

class AutoState {
  final String state;
  final bool enabled;
  final String direction;
  final double speed;
  final double weight;

  const AutoState({
    required this.state,
    required this.enabled,
    required this.direction,
    required this.speed,
    required this.weight,
  });
}

class GyroState {
  final bool enabled;
  final bool pending;
  final bool seen;
  final double gain;
  final bool invert;
  final bool smooth;

  const GyroState({
    required this.enabled,
    required this.pending,
    required this.seen,
    required this.gain,
    required this.invert,
    required this.smooth,
  });
}

class OrbitState {
  final bool ready;
  final bool loading;
  final String title;
  final double angle;
  final double target;
  final String axis;
  final double minAngle;
  final double maxAngle;
  final bool limited;
  final double velocity;
  final int frameIndex;
  final int frameCount;
  final double frameDeg;
  final bool dragging;
  final bool invert;
  final bool inertia;
  final String fit;
  final AutoState auto;
  final GyroState gyro;
  final bool mouseFollow;
  final OrbitConfig config;

  const OrbitState({
    required this.ready,
    required this.loading,
    required this.title,
    required this.angle,
    required this.target,
    required this.axis,
    required this.minAngle,
    required this.maxAngle,
    required this.limited,
    required this.velocity,
    required this.frameIndex,
    required this.frameCount,
    required this.frameDeg,
    required this.dragging,
    required this.invert,
    required this.inertia,
    required this.fit,
    required this.auto,
    required this.gyro,
    required this.mouseFollow,
    required this.config,
  });
}

class VideoLayer {
  final RectMeta rect;
  final int count;
  final List<ui.Image?> frames;

  VideoLayer({required this.rect, required this.count, required this.frames});
}

class LayerFrame {
  final ui.Image? base;
  final ui.Image? next;
  final double blend;

  const LayerFrame(
      {required this.base, required this.next, required this.blend});
}

Map<String, dynamic> _toCoreConfig(OrbitConfig config) => {
      'title': config.title,
      'video': {'fit': config.fit},
      'orbit': {
        'axis': config.axis,
        'spanDeg': config.spanDeg,
        'direction': config.direction,
        'minAngle': config.minAngle,
        'maxAngle': config.maxAngle,
      },
      'drag': {
        'degPerPx': config.dragDegPerPx,
        'invert': config.dragInvert,
        'inertia': config.dragInertia,
        'inertiaMs': config.dragInertiaMs,
      },
      'motion': {'smoothMs': config.motionSmoothMs},
      'auto': {
        'enabled': config.autoEnabled,
        'dir': config.autoDir,
        'degPerSec': config.autoDegPerSec,
        'idleDelayMs': config.autoIdleDelayMs,
        'rampInMs': config.autoRampInMs,
        'rampOutMs': config.autoRampOutMs,
      },
      'gyro': {
        'gain': config.gyroGain,
        'invert': config.gyroInvert,
        'smooth': config.gyroSmooth,
        'smoothMs': config.gyroSmoothMs,
      },
      'mouseFollow': {
        'enabled': config.mouseFollowEnabled,
        'degPerPx': config.mouseFollowDegPerPx,
      },
    };

OrbitConfig _fromCoreConfig(OrbitEngineConfig config) => OrbitConfig(
      title: config.title,
      fit: config.video.fit,
      axis: config.orbit.axis,
      spanDeg: config.orbit.spanDeg,
      direction: config.orbit.direction,
      minAngle: config.orbit.minAngle,
      maxAngle: config.orbit.maxAngle,
      dragDegPerPx: config.drag.degPerPx,
      dragInvert: config.drag.invert,
      dragInertia: config.drag.inertia,
      dragInertiaMs: config.drag.inertiaMs,
      motionSmoothMs: config.motion.smoothMs,
      autoEnabled: config.auto.enabled,
      autoDir: config.auto.dir,
      autoDegPerSec: config.auto.degPerSec,
      autoIdleDelayMs: config.auto.idleDelayMs,
      autoRampInMs: config.auto.rampInMs,
      autoRampOutMs: config.auto.rampOutMs,
      gyroGain: config.gyro.gain,
      gyroInvert: config.gyro.invert,
      gyroSmooth: config.gyro.smooth,
      gyroSmoothMs: config.gyro.smoothMs,
      mouseFollowEnabled: config.mouseFollow.enabled,
      mouseFollowDegPerPx: config.mouseFollow.degPerPx,
    );

class OrbitRenderController extends ChangeNotifier {
  OrbitConfig _config = const OrbitConfig();
  late final OrbitEngine _engine;
  OrbBundle? _bundle;
  List<VideoLayer> _layers = [];
  bool _ready = false;
  bool _loading = false;
  String? _error;
  double _progress = 0;
  int loadedFrames = 0;
  int totalFrames = 0;
  int _lastTickMs = 0;
  bool _gyroEnabled = false;
  bool _gyroSeen = false;
  int _orientTMs = 0;

  OrbitRenderController({OrbitConfig? config}) {
    final initial = config ?? const OrbitConfig();
    _engine = OrbitEngine(
      EngineBundle(
        canvasWidth: 0,
        canvasHeight: 0,
        initialAngle: 0,
        videos: const [],
        sceneConfig: const {},
      ),
      userConfig: _toCoreConfig(initial),
    );
    _engine.unload();
    _syncConfig();
  }

  bool get isReady => _ready;
  bool get isLoading => _loading;
  String? get error => _error;
  double get progress => _progress;
  double get angle => _engine.angle;
  double get target => _engine.targetAngle;
  String get axis => _engine.config.orbit.axis;
  int get frameCount => _engine.frameCount;
  int get frameIndex => _engine.getFrameIndex();
  double get frameDeg => _engine.getSnapshot()['frameDeg'] as double;
  String get title => _config.title.isNotEmpty ? _config.title : '环绕视角';
  String get fit => _config.fit;
  bool get dragging => _engine.getSnapshot()['dragging'] as bool;
  bool get invert => _config.dragInvert;
  bool get inertia => _config.dragInertia;
  OrbitConfig get config => _config;
  OrbBundle? get bundle => _bundle;
  List<VideoLayer> get layers => _layers;
  int get canvasWidth => _bundle?.meta.canvasWidth ?? 1280;
  int get canvasHeight => _bundle?.meta.canvasHeight ?? 720;

  AutoState get auto {
    final auto = _engine.getSnapshot()['auto'] as Map<String, dynamic>;
    return AutoState(
      state: auto['state'] as String,
      enabled: auto['enabled'] as bool,
      direction: auto['direction'] as String,
      speed: (auto['speed'] as num).toDouble(),
      weight: (auto['weight'] as num).toDouble(),
    );
  }

  GyroState get gyro => GyroState(
        enabled: _gyroEnabled,
        pending: false,
        seen: _gyroSeen,
        gain: _config.gyroGain,
        invert: _config.gyroInvert,
        smooth: _config.gyroSmooth,
      );

  OrbitState get state => OrbitState(
        ready: _ready,
        loading: _loading,
        title: title,
        angle: angle,
        target: target,
        axis: axis,
        minAngle: _config.minAngle,
        maxAngle: _config.maxAngle,
        limited: _engine.getSnapshot()['limited'] as bool,
        velocity: (_engine.getSnapshot()['velocity'] as num).toDouble(),
        frameIndex: frameIndex,
        frameCount: frameCount,
        frameDeg: frameDeg,
        dragging: dragging,
        invert: invert,
        inertia: inertia,
        fit: fit,
        auto: auto,
        gyro: gyro,
        mouseFollow: _config.mouseFollowEnabled,
        config: _config,
      );

  void _syncConfig() {
    _config = _fromCoreConfig(_engine.config);
  }

  void _applyConfig(Map<String, dynamic> partial) {
    _engine.setConfig(partial);
    _syncConfig();
    notifyListeners();
  }

  void setConfig(OrbitConfig next) {
    _engine.setConfig(_toCoreConfig(next));
    _syncConfig();
    notifyListeners();
  }

  void setFit(String nextFit) => _applyConfig({
        'video': {'fit': nextFit == 'cover' ? 'cover' : 'contain'},
      });

  void setInvert(bool value) => _applyConfig({
        'drag': {'invert': value},
      });

  void setInertia(bool value) => _applyConfig({
        'drag': {'inertia': value},
      });

  void setMouseFollow(bool value) => _applyConfig({
        'mouseFollow': {'enabled': value},
      });

  void setGyroGain(double gain) => _applyConfig({
        'gyro': {'gain': gain},
      });

  void setGyroSmooth(bool smooth) => _applyConfig({
        'gyro': {'smooth': smooth},
      });

  void setAutoRotate(dynamic value, [String? direction]) {
    bool enabled = value == true;
    String? dir = direction;
    if (value is String) {
      if (value == 'off') {
        enabled = false;
      } else if (value == 'on') {
        enabled = true;
      } else if (value == 'cw' || value == 'ccw') {
        enabled = true;
        dir = value;
      }
    }
    _applyConfig({
      'auto': {'enabled': enabled, if (dir != null) 'dir': dir},
    });
  }

  String cycleAuto() {
    final state = auto.state;
    final next = state == 'off'
        ? 'cw'
        : state == 'cw'
            ? 'ccw'
            : 'off';
    setAutoRotate(next);
    return next;
  }

  void setAutoSpeed(double speed) => _applyConfig({
        'auto': {'degPerSec': speed},
      });

  void rotateBy(double deg) {
    _engine.rotateBy(deg);
    notifyListeners();
  }

  void setAngle(double deg, {bool immediate = false}) {
    _engine.setAngle(deg, immediate: immediate);
    notifyListeners();
  }

  void reset({double angle = 0, bool immediate = true}) {
    _engine.reset(angle, immediate: immediate);
    notifyListeners();
  }

  void calibrateGyro() {
    _engine.calibrateGyro();
    notifyListeners();
  }

  void enableGyro() {
    _gyroEnabled = true;
    _gyroSeen = false;
    _engine.enableGyro();
    _engine.calibrateGyro();
    notifyListeners();
  }

  void disableGyro() {
    _gyroEnabled = false;
    _gyroSeen = false;
    _engine.disableGyro();
    notifyListeners();
  }

  void handleGyroscopeDelta({
    required double gx,
    required double gy,
    required double gz,
    required double dt,
    int screenRotationDeg = 0,
  }) {
    if (!_gyroEnabled || dragging) return;
    _gyroSeen = true;
    double sx;
    double sy;
    switch (screenRotationDeg) {
      case 90:
        sx = gy;
        sy = -gx;
        break;
      case 180:
        sx = -gx;
        sy = -gy;
        break;
      case 270:
        sx = -gy;
        sy = gx;
        break;
      default:
        sx = gx;
        sy = gy;
        break;
    }
    final gain = _config.gyroGain *
        (_config.gyroInvert ? -1.0 : 1.0) *
        (_config.dragInvert ? -1.0 : 1.0);
    final radians = axis == 'y' ? sx * dt : -sy * dt - gz * 0.4 * dt;
    final delta = radians * (180.0 / math.pi) * gain;
    final now = DateTime.now().millisecondsSinceEpoch;
    final dtMs = math.min(math.max(now - _orientTMs, 1), 120);
    _orientTMs = now;
    final factor =
        _config.gyroSmooth ? 1 - math.exp(-dtMs / _config.gyroSmoothMs) : 1.0;
    _engine.rotateBy(delta * factor);
    notifyListeners();
  }

  void handleOrientationReading({
    required double alpha,
    required double beta,
    required double gamma,
    double? compassHeading,
    int screenRotationDeg = 0,
  }) {
    if (!_gyroEnabled || dragging) return;
    _gyroSeen = true;
    double heading;
    if (axis == 'y') {
      heading = beta % 360;
    } else if (compassHeading != null && compassHeading >= 0) {
      heading = compassHeading;
    } else if (beta.isNaN || gamma.isNaN) {
      heading = (360 - alpha) % 360;
    } else {
      final a = alpha * (math.pi / 180.0);
      final b = beta * (math.pi / 180.0);
      final g = gamma * (math.pi / 180.0);
      final vx =
          math.sin(g) * math.cos(a) + math.cos(g) * math.sin(b) * math.sin(a);
      final vy =
          math.sin(g) * math.sin(a) - math.cos(g) * math.sin(b) * math.cos(a);
      if (math.sqrt(vx * vx + vy * vy) < 0.25) {
        heading = screenRotationDeg == 90 || screenRotationDeg == 270
            ? alpha % 360
            : (360 - alpha) % 360;
      } else {
        heading = (math.atan2(-vx, -vy) * (180.0 / math.pi)) % 360;
      }
    }
    _engine.gyro(heading, DateTime.now().millisecondsSinceEpoch.toDouble());
    notifyListeners();
  }

  void onPointerDown(ui.Offset pos) {
    _engine.pointerDown(
      pos.dx,
      pos.dy,
      DateTime.now().millisecondsSinceEpoch.toDouble(),
    );
    notifyListeners();
  }

  void onPointerMove(ui.Offset pos) {
    if (!dragging) return;
    _engine.pointerMove(
      pos.dx,
      pos.dy,
      DateTime.now().millisecondsSinceEpoch.toDouble(),
    );
    notifyListeners();
  }

  void onPointerUp() {
    _engine.pointerUp(DateTime.now().millisecondsSinceEpoch.toDouble());
    notifyListeners();
  }

  void onPointerHover(ui.Offset delta) {
    if (dragging || !_config.mouseFollowEnabled) return;
    final px = axis == 'y' ? delta.dy : delta.dx;
    if (px == 0) return;
    _engine.rotateBy(
        px * _config.mouseFollowDegPerPx * (_config.dragInvert ? -1 : 1));
    notifyListeners();
  }

  void tick(int nowMs) {
    if (_lastTickMs == 0) {
      _lastTickMs = nowMs;
      return;
    }
    final dt = math.min(nowMs - _lastTickMs, 64);
    _lastTickMs = nowMs;
    _engine.advance(dt.toDouble());
    notifyListeners();
  }

  ui.Image? currentFrameForLayer(int layerIndex) {
    if (layerIndex < 0 || layerIndex >= _layers.length) return null;
    final layer = _layers[layerIndex];
    if (layer.count == 0 || layer.frames.isEmpty) return null;
    final snapshot = _engine.getSnapshot();
    final layers = snapshot['layers'] as List;
    final index = layers.length > layerIndex
        ? (layers[layerIndex] as Map<String, dynamic>)['frameIndex'] as int
        : 0;
    if (index < 0 || index >= layer.frames.length) return null;
    return layer.frames[index];
  }

  Future<void> loadOrbBytes(Uint8List bytes, {String? defaultTitle}) async {
    _loading = true;
    _ready = false;
    _error = null;
    _progress = 0.1;
    notifyListeners();
    try {
      final bundle = OrbBundle.parse(bytes);
      final meta = bundle.meta;
      totalFrames =
          meta.videos.fold<int>(0, (sum, video) => sum + video.frames.count);
      loadedFrames = 0;
      final layers = <VideoLayer>[];
      for (var vi = 0; vi < meta.videos.length; vi++) {
        final video = meta.videos[vi];
        final frames = List<ui.Image?>.filled(video.frames.count, null);
        layers.add(VideoLayer(
            rect: video.rect, count: video.frames.count, frames: frames));
        for (var fi = 0; fi < video.frames.count; fi++) {
          try {
            final codec =
                await ui.instantiateImageCodec(bundle.frameBytes(vi, fi));
            final frame = await codec.getNextFrame();
            frames[fi] = frame.image;
          } catch (_) {
            frames[fi] = null;
          }
          loadedFrames++;
          _progress = 0.1 + 0.9 * (loadedFrames / math.max(1, totalFrames));
          if (loadedFrames % 10 == 0 || loadedFrames == totalFrames) {
            notifyListeners();
          }
        }
      }
      _bundle = bundle;
      _layers = layers;
      _engine.load(EngineBundle(
        canvasWidth: meta.canvasWidth.toDouble(),
        canvasHeight: meta.canvasHeight.toDouble(),
        initialAngle: meta.initialAngle,
        videos: bundle.layers
            .map((layer) => EngineLayerInput(
                  rect: {
                    'x': layer.rect.x,
                    'y': layer.rect.y,
                    'width': layer.rect.width,
                    'height': layer.rect.height,
                  },
                  frameCount: layer.frameCount,
                ))
            .toList(),
        sceneConfig: bundle.sceneConfig,
      ));
      if (defaultTitle != null) _engine.setConfig({'title': defaultTitle});
      _syncConfig();
      _ready = true;
      _loading = false;
      _progress = 1;
      notifyListeners();
    } catch (error) {
      _loading = false;
      _ready = false;
      _error = error.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> loadUrl(String url, {String? defaultTitle}) async {
    _loading = true;
    _ready = false;
    _error = null;
    _progress = 0.05;
    notifyListeners();
    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: 无法加载 $url');
      }
      await loadOrbBytes(response.bodyBytes, defaultTitle: defaultTitle);
    } catch (error) {
      _loading = false;
      _ready = false;
      _error = error.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> loadFile(File file, {String? defaultTitle}) async {
    await loadOrbBytes(
      await file.readAsBytes(),
      defaultTitle: defaultTitle ?? file.uri.pathSegments.last,
    );
  }
}
