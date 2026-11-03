import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import 'orb.dart';

double mod(double a, double n) => ((a % n) + n) % n;
int modInt(int a, int n) => ((a % n) + n) % n;
double shortDelta(double from, double to) => mod(to - from + 180, 360) - 180;
double wrapSigned(double deg) => mod(deg + 180, 360) - 180;
double clampNum(double v, double lo, double hi) =>
    math.min(hi, math.max(lo, v));

class OrbitConfig {
  final String title;
  final String fit; // 'contain' | 'cover'
  final String axis; // 'x' | 'y'
  final double spanDeg;
  final String direction; // 'cw' | 'ccw'
  final double minAngle;
  final double maxAngle;
  final double dragDegPerPx;
  final bool dragInvert;
  final bool dragInertia;
  final double dragInertiaMs;
  final double motionSmoothMs;
  final bool autoEnabled;
  final String autoDir; // 'cw' | 'ccw'
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

  const FrameInfo({
    required this.index,
    required this.count,
    required this.frameDeg,
  });
}

class AutoState {
  final String state; // 'off' | 'cw' | 'ccw'
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

  VideoLayer({
    required this.rect,
    required this.count,
    required this.frames,
  });
}

class OrbitRenderController extends ChangeNotifier {
  OrbitConfig _config = const OrbitConfig();
  OrbBundle? _bundle;
  List<VideoLayer> _layers = [];

  bool _ready = false;
  bool _loading = false;
  String? _error;
  double _progress = 0.0;
  int loadedFrames = 0;
  int totalFrames = 0;

  double _angle = 0.0;
  double _target = 0.0;
  double _vel = 0.0;
  bool _dragging = false;

  double _minAngle = -180.0;
  double _maxAngle = 180.0;
  bool _limited = false;
  String _axis = 'x';
  bool _invert = false;
  bool _inertia = true;
  String _fit = 'contain';

  String _autoState = 'off';
  double _autoDir = 1.0;
  double _autoSpeed = 14.0;
  double _autoWeight = 0.0;
  int _idleSinceMs = 0;

  bool _gyroEnabled = false;
  final bool _gyroPending = false;
  bool _gyroSeen = false;
  double? _gyroRef;
  double _gyroBase = 0.0;
  int _orientTMs = 0;

  int _canvasW = 1280;
  int _canvasH = 720;
  int _count = 0;
  double _frameDeg = 1.0;
  double _degPerFrame = 1.0;

  int _lastTickMs = 0;
  int _lastPointerTMs = 0;
  double? _lastPointerX;
  double? _lastPointerY;

  OrbitRenderController({OrbitConfig? config}) {
    if (config != null) {
      _config = config;
      _applyConfig();
    }
    _touchActivity();
  }

  bool get isReady => _ready;
  bool get isLoading => _loading;
  String? get error => _error;
  double get progress => _progress;
  double get angle => _normAngle(_angle);
  double get target => _normAngle(_target);
  String get axis => _axis;
  int get frameCount => _count;
  int get frameIndex => _computeFrameIndex();
  double get frameDeg => _frameDeg;
  String get title => _config.title.isNotEmpty ? _config.title : '环绕视角';
  String get fit => _fit;
  bool get dragging => _dragging;
  bool get invert => _invert;
  bool get inertia => _inertia;
  AutoState get auto => AutoState(
        state: _autoState,
        enabled: _autoState != 'off',
        direction: _autoState == 'off' ? _config.autoDir : _autoState,
        speed: _autoSpeed,
        weight: _autoWeight,
      );
  GyroState get gyro => GyroState(
        enabled: _gyroEnabled,
        pending: _gyroPending,
        seen: _gyroSeen,
        gain: _config.gyroGain,
        invert: _config.gyroInvert,
        smooth: _config.gyroSmooth,
      );
  OrbitConfig get config => _config;
  OrbBundle? get bundle => _bundle;
  List<VideoLayer> get layers => _layers;
  int get canvasWidth => _canvasW;
  int get canvasHeight => _canvasH;

  OrbitState get state => OrbitState(
        ready: _ready,
        loading: _loading,
        title: title,
        angle: angle,
        target: target,
        axis: _axis,
        minAngle: _minAngle,
        maxAngle: _maxAngle,
        limited: _limited,
        velocity: _vel,
        frameIndex: frameIndex,
        frameCount: _count,
        frameDeg: _frameDeg,
        dragging: _dragging,
        invert: _invert,
        inertia: _inertia,
        fit: _fit,
        auto: auto,
        gyro: gyro,
        mouseFollow: _config.mouseFollowEnabled,
        config: _config,
      );

  void _touchActivity() {
    _idleSinceMs = DateTime.now().millisecondsSinceEpoch;
  }

  void _applyConfig() {
    _invert = _config.dragInvert;
    _axis = _config.axis == 'y' ? 'y' : 'x';
    var lo = clampNum(_config.minAngle, -180, 180);
    var hi = clampNum(_config.maxAngle, -180, 180);
    if (lo > hi) {
      final tmp = lo;
      lo = hi;
      hi = tmp;
    }
    _minAngle = lo;
    _maxAngle = hi;
    _limited = lo > -180 || hi < 180;
    if (_limited) {
      _target = clampNum(_target, lo, hi);
      _angle = clampNum(_angle, lo, hi);
    }
    _inertia = _config.dragInertia;
    _fit = _config.fit == 'cover' ? 'cover' : 'contain';

    _autoState = _config.autoEnabled
        ? (_config.autoDir == 'ccw' ? 'ccw' : 'cw')
        : 'off';
    _autoDir = _autoState == 'ccw' ? -1.0 : 1.0;
    _autoSpeed = _config.autoDegPerSec;

    _recalcFrames();
  }

  void _recalcFrames() {
    _degPerFrame = _frameSpan() / math.max(1, _count);
    _frameDeg = _degPerFrame;
  }

  double _frameSpan() {
    final span = _config.spanDeg;
    if (span <= 0) return 360.0;
    return math.min(360.0, span);
  }

  double _normAngle(double value) {
    if (_limited) {
      return clampNum(value, _minAngle, _maxAngle);
    }
    return wrapSigned(value);
  }

  double _angleDelta(double from, double to) {
    return _limited ? (to - from) : shortDelta(from, to);
  }

  int _computeFrameIndex() {
    if (_count == 0) return 0;
    final dirSign = _config.direction == 'ccw' ? -1.0 : 1.0;
    final ang = wrapSigned(_angle * dirSign);
    final span = _frameSpan();
    if (span >= 360.0) {
      return modInt((mod(ang, 360.0) / _degPerFrame).round(), _count);
    }
    final t = (ang + span / 2.0) / span;
    return math.min(_count - 1, math.max(0, (t * (_count - 1)).round()));
  }

  ui.Image? currentFrameForLayer(int layerIndex) {
    if (layerIndex < 0 || layerIndex >= _layers.length) return null;
    final layer = _layers[layerIndex];
    if (layer.count == 0 || layer.frames.isEmpty) return null;
    final idx = frameIndex;
    final i = layer.count == _count
        ? idx
        : modInt(((idx * layer.count) / _count).floor(), layer.count);
    if (i < 0 || i >= layer.frames.length) return null;
    return layer.frames[i];
  }

  void setConfig(OrbitConfig next) {
    _config = next;
    _applyConfig();
    notifyListeners();
  }

  void setFit(String nextFit) {
    _config = _config.copyWith(fit: nextFit);
    _fit = nextFit == 'cover' ? 'cover' : 'contain';
    notifyListeners();
  }

  void setInvert(bool val) {
    _config = _config.copyWith(dragInvert: val);
    _invert = val;
    notifyListeners();
  }

  void setInertia(bool val) {
    _config = _config.copyWith(dragInertia: val);
    _inertia = val;
    notifyListeners();
  }

  void setMouseFollow(bool val) {
    _config = _config.copyWith(mouseFollowEnabled: val);
    notifyListeners();
  }

  void setGyroGain(double gain) {
    _config = _config.copyWith(gyroGain: gain);
    notifyListeners();
  }

  void setGyroSmooth(bool smooth) {
    _config = _config.copyWith(gyroSmooth: smooth);
    notifyListeners();
  }

  void setAutoRotate(dynamic value, [String? direction]) {
    if (value is bool) {
      _config = _config.copyWith(
        autoEnabled: value,
        autoDir: direction ?? _config.autoDir,
      );
    } else if (value is String) {
      if (value == 'off') {
        _config = _config.copyWith(autoEnabled: false);
      } else if (value == 'cw' || value == 'ccw') {
        _config = _config.copyWith(autoEnabled: true, autoDir: value);
      } else if (value == 'on') {
        _config = _config.copyWith(autoEnabled: true);
      }
    }
    _applyConfig();
    _touchActivity();
    notifyListeners();
  }

  String cycleAuto() {
    String next;
    if (_autoState == 'off') {
      next = 'cw';
    } else if (_autoState == 'cw') {
      next = 'ccw';
    } else {
      next = 'off';
    }
    setAutoRotate(next);
    return next;
  }

  void setAutoSpeed(double speed) {
    _config = _config.copyWith(autoDegPerSec: speed);
    _autoSpeed = speed;
    notifyListeners();
  }

  void rotateBy(double deg) {
    _target = _normAngle(_target + deg);
    _touchActivity();
    notifyListeners();
  }

  void setAngle(double deg, {bool immediate = false}) {
    _target = _normAngle(deg);
    _vel = 0;
    if (immediate) {
      _angle = _target;
    }
    _touchActivity();
    notifyListeners();
  }

  void reset({double angle = 0, bool immediate = false}) {
    _target = _normAngle(angle);
    _vel = 0;
    if (_gyroEnabled) {
      _gyroRef = null;
      _gyroBase = 0;
    }
    if (immediate) {
      _angle = _target;
    }
    _touchActivity();
    notifyListeners();
  }

  void calibrateGyro() {
    _gyroRef = null;
    _gyroBase = _target;
    notifyListeners();
  }

  void enableGyro() {
    _gyroEnabled = true;
    _gyroSeen = false;
    _gyroRef = null;
    notifyListeners();
  }

  void disableGyro() {
    _gyroEnabled = false;
    _gyroSeen = false;
    _gyroRef = null;
    notifyListeners();
  }

  /// 直接处理高采样率陀螺仪角速度（rad/s），并根据设备当前横竖屏角度（screenRotationDeg）做坐标投影转换。
  /// screenRotationDeg: 0 (竖屏), 90 (横屏左旋), 180 (倒立), 270 (横屏右旋)
  void handleGyroscopeDelta({
    required double gx, // 绕设备 x 轴（水平向右）
    required double gy, // 绕设备 y 轴（竖直向上）
    required double gz, // 绕设备 z 轴（垂直屏幕朝外）
    required double dt, // 秒
    int screenRotationDeg = 0,
  }) {
    if (!_gyroEnabled || _dragging) return;
    _gyroSeen = true;

    // 根据横竖屏角度转换到屏幕坐标系 (sx, sy, sz)
    // 屏幕坐标系下：sy 始终是屏幕上方，sx 始终是屏幕右方
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
      case 0:
      default:
        sx = gx;
        sy = gy;
        break;
    }

    final gain = _config.gyroGain *
        (_config.gyroInvert ? -1.0 : 1.0) *
        (_invert ? -1.0 : 1.0);

    // X 轴场景（环视）：人握持手机旋转，主要绕屏幕 Y 轴或 Z 轴旋转
    // Y 轴场景（俯仰）：人前后倾斜手机，主要绕屏幕 X 轴旋转
    final rad = _axis == 'y' ? (sx * dt) : (-sy * dt - gz * 0.4 * dt);
    final degDelta = rad * (180.0 / math.pi) * gain;
    if (_config.gyroSmooth) {
      final now = DateTime.now().millisecondsSinceEpoch;
      final dtMs = math.min(math.max(now - _orientTMs, 1), 120);
      _orientTMs = now;
      final tau = _config.gyroSmoothMs;
      final factor = 1 - math.exp(-dtMs / tau);
      _target = _normAngle(_target + degDelta * factor);
    } else {
      _target = _normAngle(_target + degDelta);
    }

    _touchActivity();
    notifyListeners();
  }

  void handleOrientationReading({
    required double alpha,
    required double beta,
    required double gamma,
    double? compassHeading,
  }) {
    if (!_gyroEnabled || _dragging) return;
    _gyroSeen = true;

    double? heading;
    if (_axis == 'y') {
      heading = mod(beta, 360);
    } else {
      if (compassHeading != null && compassHeading >= 0) {
        heading = compassHeading;
      } else {
        final a = alpha * (math.pi / 180.0);
        final b = beta * (math.pi / 180.0);
        final g = gamma * (math.pi / 180.0);
        final vx = math.sin(g) * math.cos(a) +
            math.cos(g) * math.sin(b) * math.sin(a);
        final vy = math.sin(g) * math.sin(a) -
            math.cos(g) * math.sin(b) * math.cos(a);
        final horizontal = math.sqrt(vx * vx + vy * vy);
        if (horizontal < 0.25) {
          heading = mod(360 - alpha, 360);
        } else {
          heading = mod(math.atan2(-vx, -vy) * (180.0 / math.pi), 360);
        }
      }
    }

    if (_gyroRef == null) {
      _gyroRef = heading;
      _gyroBase = _target;
      return;
    }

    final gain = _config.gyroGain *
        (_config.gyroInvert ? -1.0 : 1.0) *
        (_invert ? -1.0 : 1.0);
    final delta = shortDelta(_gyroRef!, heading) * gain;
    final raw = _normAngle(_gyroBase - delta);

    if (_config.gyroSmooth) {
      final now = DateTime.now().millisecondsSinceEpoch;
      final dt = math.min(math.max(now - _orientTMs, 1), 120);
      _orientTMs = now;
      final tau = _config.gyroSmoothMs;
      _target = _normAngle(
        _target + _angleDelta(_target, raw) * (1 - math.exp(-dt / tau)),
      );
    } else {
      _target = raw;
    }

    _touchActivity();
    notifyListeners();
  }

  void onPointerDown(Offset pos) {
    _dragging = true;
    _vel = 0;
    _lastPointerX = pos.dx;
    _lastPointerY = pos.dy;
    _lastPointerTMs = DateTime.now().millisecondsSinceEpoch;
    _touchActivity();
    notifyListeners();
  }

  void onPointerMove(Offset pos) {
    if (!_dragging) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final dx = pos.dx - (_lastPointerX ?? pos.dx);
    final dy = pos.dy - (_lastPointerY ?? pos.dy);
    final dt = math.max(now - _lastPointerTMs, 1);
    final px = _axis == 'y' ? dy : dx;
    final deg = px * _config.dragDegPerPx * (_invert ? -1.0 : 1.0);
    _target = _normAngle(_target + deg);
    if (_gyroEnabled) {
      _gyroBase = _normAngle(_gyroBase + deg);
    }
    final inst = dt > 90 ? 0.0 : deg / dt;
    _vel = 0.6 * inst + 0.4 * _vel;
    _lastPointerX = pos.dx;
    _lastPointerY = pos.dy;
    _lastPointerTMs = now;
    _touchActivity();
    notifyListeners();
  }

  void onPointerUp() {
    if (!_dragging) return;
    _dragging = false;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastPointerTMs > 90) {
      _vel = 0.0;
    }
    _vel = clampNum(_vel, -0.55, 0.55);
    _touchActivity();
    notifyListeners();
  }

  void onPointerHover(Offset delta) {
    if (_dragging || !_config.mouseFollowEnabled) return;
    final px = _axis == 'y' ? delta.dy : delta.dx;
    if (px != 0) {
      final d = px * _config.mouseFollowDegPerPx * (_invert ? -1.0 : 1.0);
      _target = _normAngle(_target + d);
      if (_gyroEnabled) {
        _gyroBase = _normAngle(_gyroBase + d);
      }
      _touchActivity();
      notifyListeners();
    }
  }

  void tick(int nowMs) {
    if (_lastTickMs == 0) {
      _lastTickMs = nowMs;
      return;
    }
    final dt = math.min(nowMs - _lastTickMs, 64);
    _lastTickMs = nowMs;

    if (!_dragging) {
      if (_inertia && !_gyroEnabled && _vel.abs() > 0.0005) {
        final next = _normAngle(_target + _vel * dt);
        if (_limited && next == _target) {
          _vel = 0;
        }
        _target = next;
        _vel *= math.exp(-dt / _config.dragInertiaMs);
        _touchActivity();
      } else {
        _vel = 0;
      }
    }

    _updateAuto(dt, nowMs);

    final delta = _angleDelta(_angle, _target);
    final tau = _config.motionSmoothMs;
    final next = _angle + delta * (1 - math.exp(-dt / tau));
    _angle = _limited
        ? clampNum(next, _minAngle, _maxAngle)
        : mod(next, 360.0);
    if (_angleDelta(_angle, _target).abs() < 0.0005) {
      _angle = _target;
    }

    notifyListeners();
  }

  void _updateAuto(int dt, int nowMs) {
    final idle = nowMs - _idleSinceMs;
    final want = (_autoState != 'off' &&
            !_gyroEnabled &&
            !_dragging &&
            idle > _config.autoIdleDelayMs)
        ? 1.0
        : 0.0;
    final tau = want > 0
        ? _config.autoRampInMs
        : (_dragging ? 120.0 : _config.autoRampOutMs);

    _autoWeight += (want - _autoWeight) * (1 - math.exp(-dt / tau));
    if (want == 0 && _autoWeight < 0.004) {
      _autoWeight = 0;
      return;
    }
    if (_autoWeight <= 0) return;
    _target = _normAngle(
      _target + (_autoDir * _autoSpeed * _autoWeight * dt) / 1000.0,
    );
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

      final sceneAuto = meta.raw['defaults']?['auto'] as Map<String, dynamic>?;
      final autoEnabled = sceneAuto?['enabled'] as bool? ?? false;
      final autoDir = sceneAuto?['dir'] as String? ?? 'cw';

      _config = _config.copyWith(
        title: defaultTitle ?? (meta.title.isNotEmpty ? meta.title : '环绕视角'),
        axis: meta.orbit.axis,
        spanDeg: meta.orbit.spanDeg,
        direction: meta.orbit.direction,
        minAngle: meta.orbit.minAngle,
        maxAngle: meta.orbit.maxAngle,
        autoEnabled: autoEnabled,
        autoDir: autoDir,
      );

      _canvasW = meta.canvasWidth;
      _canvasH = meta.canvasHeight;
      _count = meta.videos
          .map((v) => v.frames.count)
          .fold(0, (max, c) => c > max ? c : max);

      final layers = <VideoLayer>[];
      int totalJobs = 0;
      for (final v in meta.videos) {
        totalJobs += v.frames.count;
      }
      totalFrames = totalJobs;
      loadedFrames = 0;

      for (int vi = 0; vi < meta.videos.length; vi++) {
        final v = meta.videos[vi];
        final framesList = List<ui.Image?>.filled(v.frames.count, null);
        layers.add(VideoLayer(
          rect: v.rect,
          count: v.frames.count,
          frames: framesList,
        ));
      }

      int processed = 0;
      for (int vi = 0; vi < meta.videos.length; vi++) {
        final v = meta.videos[vi];
        final layer = layers[vi];
        for (int fi = 0; fi < v.frames.count; fi++) {
          final frameData = bundle.frameBytes(vi, fi);
          try {
            final codec = await ui.instantiateImageCodec(frameData);
            final frameInfo = await codec.getNextFrame();
            layer.frames[fi] = frameInfo.image;
          } catch (e) {
            // failed frame
          }
          processed++;
          loadedFrames = processed;
          _progress = 0.1 + 0.9 * (processed / totalJobs);
          if (processed % 10 == 0 || processed == totalJobs) {
            notifyListeners();
          }
        }
      }

      _bundle = bundle;
      _layers = layers;
      _applyConfig();
      _angle = _target = _normAngle(meta.initialAngle);
      _ready = true;
      _loading = false;
      _progress = 1.0;
      notifyListeners();
    } catch (e) {
      _loading = false;
      _ready = false;
      _error = e.toString();
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
      final uri = Uri.parse(url);
      final resp = await http.get(uri);
      if (resp.statusCode != 200) {
        throw Exception('HTTP ${resp.statusCode}: 无法加载 $url');
      }
      await loadOrbBytes(resp.bodyBytes, defaultTitle: defaultTitle);
    } catch (e) {
      _loading = false;
      _ready = false;
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> loadFile(File file, {String? defaultTitle}) async {
    final bytes = await file.readAsBytes();
    await loadOrbBytes(bytes, defaultTitle: defaultTitle ?? file.uri.pathSegments.last);
  }
}
