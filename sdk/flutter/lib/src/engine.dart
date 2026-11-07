import 'dart:math' as math;

const Map<String, dynamic> defaultEngineConfig = {
  'title': '',
  'video': {
    'displayScale': 1.0,
    'portraitScale': 1.25,
    'fit': 'contain',
    'width': 1280.0,
    'height': 720.0,
  },
  'orbit': {
    'axis': 'x',
    'spanDeg': 360.0,
    'direction': 'cw',
    'minAngle': -180.0,
    'maxAngle': 180.0,
  },
  'drag': {
    'degPerPx': 0.42,
    'invert': false,
    'inertia': true,
    'inertiaMs': 110.0
  },
  'motion': {'smoothMs': 62.0},
  'auto': {
    'enabled': false,
    'dir': 'cw',
    'degPerSec': 36.0,
    'idleDelayMs': 2200.0,
    'rampInMs': 700.0,
    'rampOutMs': 280.0,
  },
  'gyro': {'gain': 1.0, 'invert': false, 'smooth': true, 'smoothMs': 80.0},
  'mouseFollow': {'enabled': false, 'degPerPx': 0.3},
};

double _mod(double a, double n) => ((a % n) + n) % n;
double _shortDelta(double from, double to) => _mod(to - from + 180, 360) - 180;
double _wrapSigned(double deg) => _mod(deg + 180, 360) - 180;
double _clamp(double value, double low, double high) =>
    math.min(high, math.max(low, value));
double _roundHalfUp(double value) => (value + 0.5).floorToDouble();

Map<String, dynamic> deepMerge(Map<String, dynamic> base,
    [Map<String, dynamic>? source]) {
  final result = <String, dynamic>{};
  for (final entry in base.entries) {
    final value = entry.value;
    result[entry.key] = value is Map
        ? deepMerge(Map<String, dynamic>.from(value))
        : value is List
            ? List<dynamic>.from(value)
            : value;
  }
  if (source == null) return result;
  for (final entry in source.entries) {
    final value = entry.value;
    final current = result[entry.key];
    if (value is Map && current is Map) {
      result[entry.key] = deepMerge(
        Map<String, dynamic>.from(current),
        Map<String, dynamic>.from(value),
      );
    } else if (value is Map) {
      result[entry.key] = deepMerge(Map<String, dynamic>.from(value));
    } else if (value is List) {
      result[entry.key] = List<dynamic>.from(value);
    } else {
      result[entry.key] = value;
    }
  }
  return result;
}

Map<String, dynamic> resolveConfigMap(
  Map<String, dynamic> sceneConfig,
  Map<String, dynamic> userConfig,
) {
  final scene = deepMerge(const <String, dynamic>{}, sceneConfig);
  final defaults = scene['defaults'];
  if (defaults is Map && defaults['auto'] is Map) {
    scene['auto'] = deepMerge(
      scene['auto'] is Map
          ? Map<String, dynamic>.from(scene['auto'] as Map)
          : const {},
      Map<String, dynamic>.from(defaults['auto'] as Map),
    );
  }
  return deepMerge(
    deepMerge(const <String, dynamic>{}, defaultEngineConfig),
    deepMerge(scene, userConfig),
  );
}

double _number(Object? value, double fallback) =>
    value is num && value.isFinite ? value.toDouble() : fallback;

OrbitEngineConfig resolveConfig(
  Map<String, dynamic> sceneConfig,
  Map<String, dynamic> userConfig,
) =>
    OrbitEngineConfig.fromMap(resolveConfigMap(sceneConfig, userConfig));

class VideoConfig {
  final double displayScale;
  final double portraitScale;
  final String fit;
  final double width;
  final double height;

  const VideoConfig({
    this.displayScale = 1,
    this.portraitScale = 1.25,
    this.fit = 'contain',
    this.width = 1280,
    this.height = 720,
  });
}

class EngineOrbitConfig {
  final String axis;
  final double spanDeg;
  final String direction;
  final double minAngle;
  final double maxAngle;

  const EngineOrbitConfig({
    this.axis = 'x',
    this.spanDeg = 360,
    this.direction = 'cw',
    this.minAngle = -180,
    this.maxAngle = 180,
  });
}

class DragConfig {
  final double degPerPx;
  final bool invert;
  final bool inertia;
  final double inertiaMs;

  const DragConfig(
      {this.degPerPx = 0.42,
      this.invert = false,
      this.inertia = true,
      this.inertiaMs = 110});
}

class MotionConfig {
  final double smoothMs;
  const MotionConfig({this.smoothMs = 62});
}

class AutoConfig {
  final bool enabled;
  final String dir;
  final double degPerSec;
  final double idleDelayMs;
  final double rampInMs;
  final double rampOutMs;

  const AutoConfig({
    this.enabled = false,
    this.dir = 'cw',
    this.degPerSec = 36,
    this.idleDelayMs = 2200,
    this.rampInMs = 700,
    this.rampOutMs = 280,
  });
}

class GyroConfig {
  final double gain;
  final bool invert;
  final bool smooth;
  final double smoothMs;

  const GyroConfig(
      {this.gain = 1,
      this.invert = false,
      this.smooth = true,
      this.smoothMs = 80});
}

class MouseFollowConfig {
  final bool enabled;
  final double degPerPx;

  const MouseFollowConfig({this.enabled = false, this.degPerPx = 0.3});
}

class OrbitEngineConfig {
  final String title;
  final VideoConfig video;
  final EngineOrbitConfig orbit;
  final DragConfig drag;
  final MotionConfig motion;
  final AutoConfig auto;
  final GyroConfig gyro;
  final MouseFollowConfig mouseFollow;

  const OrbitEngineConfig({
    this.title = '',
    this.video = const VideoConfig(),
    this.orbit = const EngineOrbitConfig(),
    this.drag = const DragConfig(),
    this.motion = const MotionConfig(),
    this.auto = const AutoConfig(),
    this.gyro = const GyroConfig(),
    this.mouseFollow = const MouseFollowConfig(),
  });

  factory OrbitEngineConfig.fromMap(Map<String, dynamic> map) {
    final video = map['video'] is Map
        ? Map<String, dynamic>.from(map['video'] as Map)
        : const <String, dynamic>{};
    final orbit = map['orbit'] is Map
        ? Map<String, dynamic>.from(map['orbit'] as Map)
        : const <String, dynamic>{};
    final drag = map['drag'] is Map
        ? Map<String, dynamic>.from(map['drag'] as Map)
        : const <String, dynamic>{};
    final motion = map['motion'] is Map
        ? Map<String, dynamic>.from(map['motion'] as Map)
        : const <String, dynamic>{};
    final auto = map['auto'] is Map
        ? Map<String, dynamic>.from(map['auto'] as Map)
        : const <String, dynamic>{};
    final gyro = map['gyro'] is Map
        ? Map<String, dynamic>.from(map['gyro'] as Map)
        : const <String, dynamic>{};
    final mouse = map['mouseFollow'] is Map
        ? Map<String, dynamic>.from(map['mouseFollow'] as Map)
        : const <String, dynamic>{};
    var minAngle = _clamp(_number(orbit['minAngle'], -180), -180, 180);
    var maxAngle = _clamp(_number(orbit['maxAngle'], 180), -180, 180);
    if (minAngle > maxAngle) {
      final swap = minAngle;
      minAngle = maxAngle;
      maxAngle = swap;
    }
    final span = _number(orbit['spanDeg'], 360);
    return OrbitEngineConfig(
      title: map['title'] is String ? map['title'] as String : '',
      video: VideoConfig(
        displayScale: _number(video['displayScale'], 1),
        portraitScale: _number(video['portraitScale'], 1.25),
        fit: video['fit'] == 'cover' ? 'cover' : 'contain',
        width: _number(video['width'], 1280),
        height: _number(video['height'], 720),
      ),
      orbit: EngineOrbitConfig(
        axis: orbit['axis'] == 'y' ? 'y' : 'x',
        spanDeg: span > 0 ? math.min(360, span) : 360,
        direction: orbit['direction'] == 'ccw' ? 'ccw' : 'cw',
        minAngle: minAngle,
        maxAngle: maxAngle,
      ),
      drag: DragConfig(
        degPerPx: _number(drag['degPerPx'], 0.42),
        invert: drag['invert'] == true,
        inertia: drag['inertia'] != false,
        inertiaMs: _number(drag['inertiaMs'], 110),
      ),
      motion: MotionConfig(smoothMs: _number(motion['smoothMs'], 62)),
      auto: AutoConfig(
        enabled: auto['enabled'] == true,
        dir: auto['dir'] == 'ccw' ? 'ccw' : 'cw',
        degPerSec: _number(auto['degPerSec'], 36),
        idleDelayMs: _number(auto['idleDelayMs'], 2200),
        rampInMs: _number(auto['rampInMs'], 700),
        rampOutMs: _number(auto['rampOutMs'], 280),
      ),
      gyro: GyroConfig(
        gain: _number(gyro['gain'], 1),
        invert: gyro['invert'] == true,
        smooth: gyro['smooth'] != false,
        smoothMs: _number(gyro['smoothMs'], 80),
      ),
      mouseFollow: MouseFollowConfig(
        enabled: mouse['enabled'] == true,
        degPerPx: _number(mouse['degPerPx'], 0.3),
      ),
    );
  }
}

class EngineLayerInput {
  final Map<String, dynamic> rect;
  final int frameCount;

  EngineLayerInput({required this.rect, required this.frameCount});

  factory EngineLayerInput.fromJson(Map<String, dynamic> json) =>
      EngineLayerInput(
        rect: Map<String, dynamic>.from(json['rect'] as Map),
        frameCount: (json['frameCount'] as num).toInt(),
      );
}

class EngineBundle {
  final double canvasWidth;
  final double canvasHeight;
  final double initialAngle;
  final List<EngineLayerInput> videos;
  final Map<String, dynamic> sceneConfig;

  EngineBundle({
    required this.canvasWidth,
    required this.canvasHeight,
    required this.initialAngle,
    required this.videos,
    required this.sceneConfig,
  });

  factory EngineBundle.fromJson(Map<String, dynamic> json) {
    final canvas = json['canvas'] is Map
        ? Map<String, dynamic>.from(json['canvas'] as Map)
        : const {};
    final videos = json['videos'] is List ? json['videos'] as List : const [];
    return EngineBundle(
      canvasWidth: _number(canvas['width'], 0),
      canvasHeight: _number(canvas['height'], 0),
      initialAngle: _number(json['initialAngle'], 0),
      videos: videos
          .map((item) =>
              EngineLayerInput.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      sceneConfig: json['sceneConfig'] is Map
          ? Map<String, dynamic>.from(json['sceneConfig'] as Map)
          : const {},
    );
  }
}

class OrbitEngine {
  EngineBundle _bundle;
  Map<String, dynamic> _sceneConfig;
  Map<String, dynamic> _userConfig;
  OrbitEngineConfig _config;
  bool _ready = false;
  bool _paused = false;
  bool _destroyed = false;
  double _angle = 0;
  double _target = 0;
  double _velocity = 0;
  bool _dragging = false;
  bool _limited = false;
  String _axis = 'x';
  double _minAngle = -180;
  double _maxAngle = 180;
  int _frameCount = 0;
  double _degPerFrame = 360;
  List<Map<String, dynamic>> _layers = [];
  double _lastPointerX = 0;
  double _lastPointerY = 0;
  double _lastPointerTime = 0;
  double _now = 0;
  double _lastActivity = 0;
  String _autoState = 'off';
  double _autoDir = 1;
  double _autoSpeed = 36;
  double _autoWeight = 0;
  bool _gyroActive = false;
  bool _gyroSeen = false;
  double? _gyroRef;
  double _gyroBase = 0;
  double _lastGyroTime = 0;

  OrbitEngine(EngineBundle bundle, {Map<String, dynamic>? userConfig})
      : _bundle = bundle,
        _sceneConfig = bundle.sceneConfig,
        _userConfig =
            deepMerge(const <String, dynamic>{}, userConfig ?? const {}),
        _config = resolveConfig(bundle.sceneConfig, userConfig ?? const {}) {
    _loadInternal(bundle);
  }

  EngineBundle get bundle => _bundle;
  OrbitEngineConfig get config => _config;
  int get frameCount => _frameCount;
  double get angle => _normAngle(_angle);
  double get targetAngle => _normAngle(_target);

  void _loadInternal(EngineBundle bundle) {
    _bundle = bundle;
    _sceneConfig = deepMerge(const <String, dynamic>{}, bundle.sceneConfig);
    _layers = <Map<String, dynamic>>[];
    for (int i = 0; i < bundle.videos.length; i++) {
      _layers.add({
        'layerIndex': i,
        'frameIndex': 0,
        'frameCount': bundle.videos[i].frameCount,
        'rect': Map<String, dynamic>.from(bundle.videos[i].rect),
      });
    }
    _frameCount = bundle.videos
        .fold<int>(0, (max, video) => math.max(max, video.frameCount));
    _config = resolveConfig(_sceneConfig, _userConfig);
    _applyConfig();
    _angle = _target = _normAngle(bundle.initialAngle);
    _velocity = 0;
    _dragging = false;
    _autoWeight = 0;
    _gyroRef = null;
    _gyroBase = 0;
    _lastActivity = _now;
    _ready = true;
    _paused = false;
    _recalcFrames();
  }

  void load(EngineBundle bundle) {
    if (_destroyed) return;
    _loadInternal(bundle);
  }

  void setConfig(Map<String, dynamic> partial) {
    if (_destroyed) return;
    _lastActivity = _now;
    _userConfig = deepMerge(_userConfig, partial);
    _config = resolveConfig(_sceneConfig, _userConfig);
    _applyConfig();
  }

  void resetConfig() {
    if (_destroyed) return;
    _userConfig = {};
    _config = resolveConfig(_sceneConfig, {});
    _applyConfig();
    _lastActivity = _now;
  }

  void setAngle(double deg, {bool immediate = false}) {
    if (_destroyed) return;
    _target = _normAngle(deg);
    _velocity = 0;
    if (immediate) _angle = _target;
    _lastActivity = _now;
  }

  void rotateBy(double deg) {
    if (_destroyed) return;
    _target = _normAngle(_target + deg);
    _lastActivity = _now;
  }

  void pointerDown(double x, double y, double timeMs) {
    if (_destroyed) return;
    final time = _eventTime(timeMs);
    _dragging = true;
    _velocity = 0;
    _lastPointerX = x;
    _lastPointerY = y;
    _lastPointerTime = time;
    _lastActivity = _now;
  }

  void pointerMove(double x, double y, double timeMs) {
    if (_destroyed || !_dragging) return;
    final time = _eventTime(timeMs);
    final dx = x - _lastPointerX;
    final dy = y - _lastPointerY;
    final dt = math.max(time - _lastPointerTime, 1.0);
    final px = _axis == 'y' ? dy : dx;
    final deg = px * _config.drag.degPerPx * (_config.drag.invert ? -1 : 1);
    _target = _normAngle(_target + deg);
    final inst = dt > 90 ? 0.0 : deg / dt;
    _velocity = 0.6 * inst + 0.4 * _velocity;
    _lastPointerX = x;
    _lastPointerY = y;
    _lastPointerTime = time;
    _lastActivity = _now;
  }

  void pointerUp(double timeMs) {
    if (_destroyed || !_dragging) return;
    _eventTime(timeMs);
    _dragging = false;
    if (timeMs - _lastPointerTime > 90) _velocity = 0;
    _velocity = _clamp(_velocity, -0.55, 0.55);
    _lastActivity = _now;
  }

  void enableGyro() {
    if (!_destroyed) _gyroActive = true;
  }

  void gyro(double heading, double timeMs) {
    if (_destroyed) return;
    _eventTime(timeMs);
    _gyroActive = true;
    _gyroSeen = true;
    if (_dragging) return;
    if (_gyroRef == null) {
      _gyroRef = heading;
      _gyroBase = _target;
      _lastGyroTime = _now;
      _lastActivity = _now;
      return;
    }
    final gain = _config.gyro.gain *
        (_config.gyro.invert ? -1 : 1) *
        (_config.drag.invert ? -1 : 1);
    final delta = _shortDelta(_gyroRef!, heading) * gain;
    final raw = _normAngle(_gyroBase - delta);
    if (_config.gyro.smooth) {
      final dt = _clamp(_now - _lastGyroTime, 1, 120);
      _lastGyroTime = _now;
      _target = _normAngle(
        _target +
            _angleDelta(_target, raw) *
                (1 - math.exp(-dt / _config.gyro.smoothMs)),
      );
    } else {
      _target = raw;
    }
    _lastActivity = _now;
  }

  void disableGyro() {
    if (_destroyed) return;
    _gyroActive = false;
    _gyroRef = null;
    _gyroBase = 0;
  }

  void calibrateGyro() {
    if (_destroyed) return;
    _gyroRef = null;
    _gyroBase = _target;
  }

  void pause() {
    if (!_destroyed) _paused = true;
  }

  void resume() {
    if (!_destroyed) _paused = false;
  }

  void reset(double angle, {bool immediate = true}) {
    if (_destroyed) return;
    _target = _normAngle(angle);
    _velocity = 0;
    _gyroRef = null;
    _gyroBase = 0;
    if (immediate) _angle = _target;
    _lastActivity = _now;
  }

  void unload() {
    if (_destroyed) return;
    _bundle = EngineBundle(
      canvasWidth: 0,
      canvasHeight: 0,
      initialAngle: 0,
      videos: const [],
      sceneConfig: const {},
    );
    _sceneConfig = {};
    _layers = [];
    _frameCount = 0;
    _angle = 0;
    _target = 0;
    _velocity = 0;
    _dragging = false;
    _autoWeight = 0;
    _gyroRef = null;
    _gyroBase = 0;
    _ready = false;
    _paused = false;
    _config = resolveConfig({}, _userConfig);
    _applyConfig();
    _lastActivity = _now;
  }

  void destroy() {
    _destroyed = true;
    _dragging = false;
    _velocity = 0;
  }

  void advance(double dtMs) {
    if (_destroyed || _paused) return;
    final dt = math.min(64.0, math.max(0.0, dtMs.isFinite ? dtMs : 0));
    _now += dt;

    if (!_dragging) {
      if (_config.drag.inertia && !_gyroActive && _velocity.abs() > 0.0005) {
        final next = _normAngle(_target + _velocity * dt);
        if (_limited && next == _target) _velocity = 0;
        _target = next;
        _velocity *= math.exp(-dt / _config.drag.inertiaMs);
        _lastActivity = _now;
      } else {
        _velocity = 0;
      }
    }

    final idle = _now - _lastActivity;
    final want = _autoState != 'off' &&
            !_gyroActive &&
            !_dragging &&
            idle > _config.auto.idleDelayMs
        ? 1.0
        : 0.0;
    final tau = want > 0
        ? _config.auto.rampInMs
        : (_dragging ? 120.0 : _config.auto.rampOutMs);
    _autoWeight += (want - _autoWeight) * (1 - math.exp(-dt / tau));
    if (want == 0 && _autoWeight < 0.004) _autoWeight = 0;
    if (_autoWeight > 0) {
      _target = _normAngle(
        _target + (_autoDir * _autoSpeed * _autoWeight * dt) / 1000,
      );
    }

    final delta = _angleDelta(_angle, _target);
    final next = _angle + delta * (1 - math.exp(-dt / _config.motion.smoothMs));
    _angle = _limited ? _clamp(next, _minAngle, _maxAngle) : _mod(next, 360);
    if (_angleDelta(_angle, _target).abs() < 0.0005) _angle = _target;
  }

  double getAngle() => _normAngle(_angle);
  double getTargetAngle() => _normAngle(_target);
  int getFrameIndex() => _frameIndex();

  Map<String, dynamic> getSnapshot() {
    final frameIndex = _frameIndex();
    final autoDirection = _autoState == 'off' ? _config.auto.dir : _autoState;
    return {
      'ready': _ready,
      'loading': false,
      'paused': _paused,
      'destroyed': _destroyed,
      'angle': _normAngle(_angle),
      'targetAngle': _normAngle(_target),
      'velocity': _velocity,
      'axis': _axis,
      'direction': _config.orbit.direction,
      'spanDeg': _frameSpan(),
      'minAngle': _minAngle,
      'maxAngle': _maxAngle,
      'limited': _limited,
      'frameIndex': frameIndex,
      'frameCount': _frameCount,
      'frameDeg': _degPerFrame,
      'dragging': _dragging,
      'auto': {
        'state': _autoState,
        'enabled': _autoState != 'off',
        'direction': autoDirection,
        'speed': _autoSpeed,
        'weight': _autoWeight,
        'idleDelayMs': _config.auto.idleDelayMs,
        'rampInMs': _config.auto.rampInMs,
        'rampOutMs': _config.auto.rampOutMs,
      },
      'gyro': {
        'enabled': _gyroActive,
        'seen': _gyroSeen,
        'gain': _config.gyro.gain,
        'invert': _config.gyro.invert,
        'smooth': _config.gyro.smooth,
        'smoothMs': _config.gyro.smoothMs,
      },
      'layers': _layers.map((layer) {
        final count = layer['frameCount'] as int;
        return {
          'layerIndex': layer['layerIndex'],
          'frameIndex': count == _frameCount
              ? frameIndex
              : _mod(
                  ((frameIndex * count) ~/ math.max(1, _frameCount)).toDouble(),
                  count.toDouble(),
                ).floor(),
          'frameCount': count,
          'rect': Map<String, dynamic>.from(layer['rect'] as Map),
        };
      }).toList(),
    };
  }

  double _eventTime(double timeMs) {
    if (timeMs > _now) _now = timeMs;
    return timeMs;
  }

  double _frameSpan() => math.min(360, _config.orbit.spanDeg);

  void _recalcFrames() {
    _degPerFrame = _frameSpan() / math.max(1, _frameCount);
  }

  void _applyConfig() {
    _axis = _config.orbit.axis;
    _minAngle = _config.orbit.minAngle;
    _maxAngle = _config.orbit.maxAngle;
    _limited = _minAngle > -180 || _maxAngle < 180;
    if (_limited) {
      _target = _clamp(_target, _minAngle, _maxAngle);
      _angle = _clamp(_angle, _minAngle, _maxAngle);
    }
    _autoState = _config.auto.enabled ? _config.auto.dir : 'off';
    _autoDir = _autoState == 'ccw' ? -1 : 1;
    _autoSpeed = _config.auto.degPerSec;
    _recalcFrames();
  }

  double _normAngle(double value) {
    if (!value.isFinite) return _limited ? _minAngle : 0;
    if (_limited) return _clamp(value, _minAngle, _maxAngle);
    return _wrapSigned(value);
  }

  double _angleDelta(double from, double to) =>
      _limited ? to - from : _shortDelta(from, to);

  int _frameIndex() {
    if (_frameCount == 0) return 0;
    final dirSign = _config.orbit.direction == 'ccw' ? -1.0 : 1.0;
    final angle = _wrapSigned(_angle * dirSign);
    final span = _frameSpan();
    if (span >= 360) {
      return _mod(_roundHalfUp(_mod(angle, 360) / _degPerFrame),
              _frameCount.toDouble())
          .floor();
    }
    final t = (angle + span / 2) / span;
    return math.min(
      _frameCount - 1,
      math.max(0, _roundHalfUp(t * (_frameCount - 1)).toInt()),
    );
  }
}
