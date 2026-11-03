import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:orbit360_render/orbit360_render.dart';
import 'package:sensors_plus/sensors_plus.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OrbitApp());
}

class OrbitApp extends StatelessWidget {
  const OrbitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '环绕视角',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0A0B0E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6EE7B7),
          surface: Color(0xFF0D0F13),
        ),
      ),
      home: const OrbitPlayerScreen(),
    );
  }
}

class CatalogItem {
  final String id;
  final String title;
  final String orbPath;
  final bool defaultAuto;
  final String defaultDir;

  CatalogItem({
    required this.id,
    required this.title,
    required this.orbPath,
    this.defaultAuto = true,
    this.defaultDir = 'cw',
  });
}

class OrbitPlayerScreen extends StatefulWidget {
  const OrbitPlayerScreen({super.key});

  @override
  State<OrbitPlayerScreen> createState() => _OrbitPlayerScreenState();
}

class _OrbitPlayerScreenState extends State<OrbitPlayerScreen> {
  final OrbitRenderController _controller = OrbitRenderController();
  List<CatalogItem> _catalogItems = [];
  String? _selectedExampleId;

  bool _uiVisible = true;
  String _hintText = '';
  bool _hintVisible = false;

  dynamic _gyroSubscription;
  bool _fullscreen = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onControllerUpdate);
    _initCatalogAndLoad();
    _setupSensors();
  }

  @override
  void dispose() {
    _gyroSubscription?.cancel();
    _controller.removeListener(_onControllerUpdate);
    super.dispose();
  }

  void _onControllerUpdate() {
    if (mounted) setState(() {});
  }

  void _flashHint(String text, [int durationMs = 1800]) {
    setState(() {
      _hintText = text;
      _hintVisible = true;
    });
    Future.delayed(Duration(milliseconds: durationMs), () {
      if (mounted && _hintText == text) {
        setState(() {
          _hintVisible = false;
        });
      }
    });
  }

  void _toggleUI() {
    setState(() {
      _uiVisible = !_uiVisible;
    });
  }

  void _touchUI() {}

  int _getScreenRotationDeg() {
    final view = View.maybeOf(context) ?? WidgetsBinding.instance.platformDispatcher.views.first;
    final size = view.physicalSize;
    if (size.width > size.height) {
      // 横屏
      return 90;
    }
    return 0; // 竖屏
  }

  void _setupSensors() {
    try {
      DateTime lastGyroTime = DateTime.now();
      // 使用高采样率 (gameInterval: 20ms = 50Hz) 监听陀螺仪角速度 (rad/s)
      _gyroSubscription = gyroscopeEventStream(
        samplingPeriod: SensorInterval.gameInterval,
      ).listen((GyroscopeEvent event) {
        if (!_controller.gyro.enabled) return;
        final now = DateTime.now();
        final dt = now.difference(lastGyroTime).inMicroseconds / 1000000.0;
        lastGyroTime = now;
        if (dt <= 0 || dt > 0.2) return;

        final rotation = _getScreenRotationDeg();

        _controller.handleGyroscopeDelta(
          gx: event.x,
          gy: event.y,
          gz: event.z,
          dt: dt,
          screenRotationDeg: rotation,
        );
      }, onError: (_) {});
    } catch (_) {}
  }

  Future<void> _initCatalogAndLoad() async {
    try {
      String jsonStr;
      try {
        jsonStr = await rootBundle.loadString('assets/catalog.json');
      } catch (_) {
        try {
          jsonStr = await rootBundle.loadString('../../catalog.json');
        } catch (_) {
          jsonStr = await rootBundle.loadString('catalog.json');
        }
      }
      final data = json.decode(jsonStr) as Map<String, dynamic>;
      final rawItems = data['items'] as List<dynamic>? ?? [];
      final items = <CatalogItem>[];

      for (final item in rawItems) {
        final map = item as Map<String, dynamic>;
        final defaults = map['defaults'] as Map<String, dynamic>?;
        final auto = defaults?['auto'] as Map<String, dynamic>?;
        items.add(CatalogItem(
          id: map['id'] as String,
          title: map['title'] as String? ?? map['id'] as String,
          orbPath: map['orb'] as String,
          defaultAuto: auto?['enabled'] as bool? ?? true,
          defaultDir: auto?['dir'] as String? ?? 'cw',
        ));
      }

      setState(() {
        _catalogItems = items;
      });

      final defaultId = data['default'] as String? ?? (items.isNotEmpty ? items.first.id : null);
      if (defaultId != null) {
        final item = items.firstWhere((it) => it.id == defaultId, orElse: () => items.first);
        await _loadCatalogItem(item);
      }
    } catch (e) {
      // Fallback: try loading directly from file or assets
      try {
        await _loadSceneOrb('assets/maid/scene.orb', title: '沙发少女');
      } catch (err) {
        _flashHint('加载素材失败: $err', 4000);
      }
    }
  }

  Future<void> _loadCatalogItem(CatalogItem item) async {
    setState(() {
      _selectedExampleId = item.id;
    });
    await _loadSceneOrb(item.orbPath, title: item.title);
  }

  Future<void> _loadSceneOrb(String path, {required String title}) async {
    _touchUI();
    try {
      Uint8List? bytes;
      final candidatePaths = [
        path,
        'assets/${path.replaceFirst('assets/', '')}',
        '../../$path',
      ];
      for (final p in candidatePaths) {
        try {
          final data = await rootBundle.load(p);
          bytes = data.buffer.asUint8List();
          break;
        } catch (_) {}
      }
      if (bytes == null) {
        for (final p in candidatePaths) {
          final file = File(p);
          if (await file.exists()) {
            bytes = await file.readAsBytes();
            break;
          }
        }
      }
      if (bytes == null) {
        throw Exception('找不到资产文件: $path');
      }
      await _controller.loadOrbBytes(bytes, defaultTitle: title);
      _flashHint(
        _controller.axis == 'y'
            ? '上下拖拽旋转 · 前后倾斜手机'
            : '左右拖拽旋转 · 倾斜手机环视',
        2500,
      );
    } catch (e) {
      _flashHint('加载失败: $e', 3500);
    }
  }

  Future<void> _handleImportFile() async {
    try {
      // Android SAF 选择器对于自定义未知后缀（如 .orb）可能因 MIME 类型匹配导致置灰不可选。
      // 先尝试带 allowedExtensions，如果未选中或在 Android 平台优先使用 any 类型选择，再校验扩展名。
      List<PlatformFile> result = [];
      try {
        result = await FilePicker.pickFiles(
          type: FileType.any,
        );
      } catch (_) {
        result = await FilePicker.pickFiles(
          type: FileType.custom,
          allowedExtensions: ['orb', 'zip'],
        );
      }

      if (result.isNotEmpty) {
        final file = result.first;
        final name = file.name.toLowerCase();
        if (!name.endsWith('.orb') && !name.endsWith('.zip')) {
          _flashHint('请选择 .orb 或 .zip 格式文件', 3000);
          return;
        }
        final bytes = await file.xFile.readAsBytes();
        _flashHint('正在解析 ${file.name}', 3000);
        setState(() {
          _selectedExampleId = null;
        });
        await _controller.loadOrbBytes(bytes, defaultTitle: file.name);
        _flashHint('已载入 ${_controller.title}', 2000);
      }
    } catch (e) {
      _flashHint('导入失败: $e', 3000);
    }
  }

  void _handleToggleGyro() {
    if (_controller.gyro.enabled) {
      _controller.disableGyro();
      _flashHint('陀螺仪已关闭', 1400);
    } else {
      _controller.enableGyro();
      _flashHint(
        _controller.axis == 'y'
            ? '前后倾斜手机环视 · 仍可上下拖拽微调'
            : '转动身体环视 · 仍可拖拽微调',
        2400,
      );
    }
  }

  void _handleToggleInvert() {
    final next = !_controller.invert;
    _controller.setInvert(next);
    _flashHint(next ? '方向已反向' : '方向已恢复', 1400);
  }

  void _handleToggleInertia() {
    final next = !_controller.inertia;
    _controller.setInertia(next);
    _flashHint(next ? '松手惯性已开' : '松手即停', 1400);
  }

  void _handleToggleFit() {
    final next = _controller.fit == 'cover' ? 'contain' : 'cover';
    _controller.setFit(next);
    _flashHint(next == 'cover' ? '铺满视口' : '自适应显示', 1400);
  }

  void _handleToggleMouseFollow() {
    final next = !_controller.config.mouseFollowEnabled;
    _controller.setMouseFollow(next);
    _flashHint(next ? '鼠标移动即可转向' : '鼠标跟随已关闭', 1400);
  }

  void _handleToggleGyroSmooth() {
    final next = !_controller.config.gyroSmooth;
    _controller.setGyroSmooth(next);
    _flashHint(next ? '陀螺仪平滑已开' : '陀螺仪原始跟随（会有抖动）', 1400);
  }

  void _handleAuto() {
    final next = _controller.cycleAuto();
    _flashHint(
      next == 'off' ? '自动旋转已关闭' : next == 'cw' ? '顺时针自动旋转' : '逆时针自动旋转',
      1400,
    );
  }

  void _handleReset() {
    _controller.reset();
    _flashHint('已重置到 0°', 1400);
  }

  void _handleCalibrate() {
    _controller.calibrateGyro();
    _flashHint('陀螺仪已校准', 1400);
  }

  void _toggleFullscreen() {
    setState(() {
      _fullscreen = !_fullscreen;
    });
    if (_fullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Focus(
        autofocus: true,
        onKeyEvent: (node, event) {
          if (event is KeyDownEvent) {
            final isShift = HardwareKeyboard.instance.isShiftPressed;
            final step = isShift ? 15.0 : 3.0;
            if (event.logicalKey == LogicalKeyboardKey.arrowRight) {
              _controller.rotateBy(step);
              return KeyEventResult.handled;
            } else if (event.logicalKey == LogicalKeyboardKey.arrowLeft) {
              _controller.rotateBy(-step);
              return KeyEventResult.handled;
            } else if (event.logicalKey == LogicalKeyboardKey.space) {
              _handleAuto();
              return KeyEventResult.handled;
            } else if (event.logicalKey == LogicalKeyboardKey.keyH) {
              _toggleUI();
              return KeyEventResult.handled;
            }
          }
          return KeyEventResult.ignored;
        },
        child: GestureDetector(
          onDoubleTap: _toggleUI,
          onLongPress: () {
            _toggleUI();
            HapticFeedback.lightImpact();
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 1. Stage view
              OrbitRenderWidget(controller: _controller),

              // 2. Top bar
              AnimatedOpacity(
                opacity: _uiVisible ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 260),
                child: IgnorePointer(
                  ignoring: !_uiVisible,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: _buildTopBar(),
                  ),
                ),
              ),

              // 3. Control Panel
              AnimatedOpacity(
                opacity: _uiVisible ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 260),
                child: IgnorePointer(
                  ignoring: !_uiVisible,
                  child: Align(
                    alignment: Alignment.bottomLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(left: 14, bottom: 14),
                      child: _buildControlPanel(),
                    ),
                  ),
                ),
              ),

              // 4. Example Bar (bottom-right)
              if (_catalogItems.length > 1)
                AnimatedOpacity(
                  opacity: _uiVisible ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 260),
                  child: IgnorePointer(
                    ignoring: !_uiVisible,
                    child: Align(
                      alignment: Alignment.bottomRight,
                      child: Padding(
                        padding: const EdgeInsets.only(right: 14, bottom: 14),
                        child: _buildExampleBar(),
                      ),
                    ),
                  ),
                ),

              // 5. Loader Overlay
              if (_controller.isLoading) _buildLoader(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color.fromRGBO(5, 6, 8, 0.72),
            Color.fromRGBO(5, 6, 8, 0.0),
          ],
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _controller.title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Color(0xFFF2F3F5),
              letterSpacing: -0.2,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          AnimatedOpacity(
            opacity: _hintVisible ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 350),
            child: Text(
              _hintText,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF8B909A),
                letterSpacing: 0.2,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlPanel() {
    final frameText = _controller.frameCount > 0
        ? '帧 ${_controller.frameIndex + 1} / ${_controller.frameCount} · ${_controller.frameDeg.toStringAsFixed(2)}°/帧'
        : '— / —';
    final gyroOn = _controller.gyro.enabled;
    final autoState = _controller.auto.state;
    final autoLabel = autoState == 'off'
        ? '自动环绕'
        : (autoState == 'ccw' ? '逆时针' : '顺时针');

    return Container(
      width: 290,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0F13).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1FFFFFFF)),
        boxShadow: const [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Frame label and Degree display
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                frameText,
                style: const TextStyle(
                  fontSize: 10.5,
                  color: Color(0xFF8B909A),
                  letterSpacing: 0.4,
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    _controller.angle.round().toString(),
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFF2F3F5),
                    ),
                  ),
                  const Text(
                    '°',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF8B909A),
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Compass Ring Hud
          Center(
            child: SizedBox(
              width: 72,
              height: 72,
              child: CustomPaint(
                painter: _RingHudPainter(
                  angle: _controller.angle,
                  axis: _controller.axis,
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Sliders
          _buildSliderRow(
            label: '陀螺仪',
            value: _controller.config.gyroGain,
            min: 0.4,
            max: 3.0,
            display: '${_controller.config.gyroGain.toStringAsFixed(1)}×',
            onChanged: (val) => _controller.setGyroGain(val),
          ),
          _buildSliderRow(
            label: '自动转速',
            value: _controller.config.autoDegPerSec,
            min: 2.0,
            max: 60.0,
            display: '${_controller.config.autoDegPerSec.round()}°/s',
            onChanged: (val) => _controller.setAutoSpeed(val),
          ),
          const SizedBox(height: 8),

          // Main Action Buttons
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildPillBtn(
                text: _fullscreen ? '退出全屏' : '全屏',
                active: _fullscreen,
                onTap: _toggleFullscreen,
              ),
              _buildPillBtn(
                text: gyroOn ? '陀螺仪已开' : '陀螺仪',
                active: gyroOn,
                onTap: _handleToggleGyro,
              ),
              _buildPillBtn(
                text: '重置',
                onTap: _handleReset,
              ),
              _buildPillBtn(
                text: '校准',
                disabled: !gyroOn,
                onTap: _handleCalibrate,
              ),
              _buildPillBtn(
                text: '反向',
                active: _controller.invert,
                onTap: _handleToggleInvert,
              ),
              _buildPillBtn(
                text: '鼠标跟随',
                active: _controller.config.mouseFollowEnabled,
                onTap: _handleToggleMouseFollow,
              ),
              _buildPillBtn(
                text: autoLabel,
                active: autoState != 'off',
                onTap: _handleAuto,
              ),
              _buildPillBtn(
                text: '导入',
                onTap: _handleImportFile,
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Toggles row
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildToggleBtn(
                text: '陀螺仪平滑',
                active: _controller.config.gyroSmooth,
                onTap: _handleToggleGyroSmooth,
              ),
              _buildToggleBtn(
                text: '惯性',
                active: _controller.inertia,
                onTap: _handleToggleInertia,
              ),
              _buildToggleBtn(
                text: _controller.fit == 'cover' ? '铺满' : '自适应',
                active: _controller.fit == 'cover',
                onTap: _handleToggleFit,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSliderRow({
    required String label,
    required double value,
    required double min,
    required double max,
    required String display,
    required ValueChanged<double> onChanged,
  }) {
    return Row(
      children: [
        SizedBox(
          width: 48,
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF8B909A)),
          ),
        ),
        Expanded(
          child: SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 2.5,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
              activeTrackColor: const Color(0xFF6EE7B7),
              inactiveTrackColor: Colors.white12,
              thumbColor: const Color(0xFF6EE7B7),
            ),
            child: Slider(
              value: value.clamp(min, max),
              min: min,
              max: max,
              onChanged: onChanged,
            ),
          ),
        ),
        SizedBox(
          width: 42,
          child: Text(
            display,
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFFF2F3F5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPillBtn({
    required String text,
    bool active = false,
    bool disabled = false,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active
              ? const Color(0xFF6EE7B7)
              : (disabled ? Colors.white.withValues(alpha: 0.02) : Colors.white.withValues(alpha: 0.08)),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: active ? const Color(0xFF6EE7B7) : Colors.white10,
          ),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 11,
            fontWeight: active ? FontWeight.w600 : FontWeight.normal,
            color: active
                ? const Color(0xFF06281E)
                : (disabled ? Colors.white30 : const Color(0xFFF2F3F5)),
          ),
        ),
      ),
    );
  }

  Widget _buildToggleBtn({
    required String text,
    required bool active,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: active ? const Color(0x226EE7B7) : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: active ? const Color(0xFF6EE7B7) : Colors.white12,
          ),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 10.5,
            color: active ? const Color(0xFF6EE7B7) : const Color(0xFF8B909A),
          ),
        ),
      ),
    );
  }

  Widget _buildExampleBar() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0F13).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x1FFFFFFF)),
        boxShadow: const [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: _catalogItems.map((item) {
            final on = item.id == _selectedExampleId;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: InkWell(
                onTap: () => _loadCatalogItem(item),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: on ? const Color(0xFF6EE7B7) : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.title,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: on ? FontWeight.w600 : FontWeight.normal,
                      color: on ? const Color(0xFF06281E) : const Color(0xFF8B909A),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildLoader() {
    return Container(
      color: const Color(0xFF0A0B0E),
      alignment: Alignment.center,
      child: SizedBox(
        width: 240,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'LOADING FRAMES',
              style: TextStyle(
                fontSize: 11,
                color: Color(0xFF8B909A),
                letterSpacing: 1.2,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: _controller.progress,
                minHeight: 2.5,
                backgroundColor: Colors.white10,
                valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6EE7B7)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingHudPainter extends CustomPainter {
  final double angle;
  final String axis;

  _RingHudPainter({required this.angle, required this.axis});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2.0;
    final cy = size.height / 2.0;
    final radius = math.min(cx, cy) - 6;

    // Track circle
    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = Colors.white.withValues(alpha: 0.08);
    canvas.drawCircle(Offset(cx, cy), radius, trackPaint);

    // Ticks
    final tickPaint = Paint()..style = PaintingStyle.stroke;
    for (int i = 0; i < 72; i++) {
      final major = i % 6 == 0;
      final rad = (i / 72.0) * math.pi * 2.0;
      final r1 = radius;
      final r2 = major ? radius - 6 : radius - 3.5;
      tickPaint.strokeWidth = major ? 1.2 : 0.7;
      tickPaint.color = major ? Colors.white.withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.12);

      final x1 = cx + math.sin(rad) * r1;
      final y1 = cy - math.cos(rad) * r1;
      final x2 = cx + math.sin(rad) * r2;
      final y2 = cy - math.cos(rad) * r2;
      canvas.drawLine(Offset(x1, y1), Offset(x2, y2), tickPaint);
    }

    // Arc
    final signed = wrapSigned(angle);
    final sweepAngle = (signed + 180.0) / 360.0 * 2.0 * math.pi;
    final arcPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.4
      ..color = const Color(0xFF6EE7B7);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      -math.pi / 2.0,
      sweepAngle,
      false,
      arcPaint,
    );

    // Needle
    final needleRad = angle * (math.pi / 180.0);
    final needlePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..color = const Color(0xFF6EE7B7);
    final nx = cx + math.sin(needleRad) * (radius - 2);
    final ny = cy - math.cos(needleRad) * (radius - 2);
    canvas.drawLine(Offset(cx, cy), Offset(nx, ny), needlePaint);

    // Center pivot
    final pivotPaint = Paint()
      ..style = PaintingStyle.fill
      ..color = const Color(0xFF6EE7B7);
    canvas.drawCircle(Offset(cx, cy), 2.8, pivotPaint);

    // Axis label
    final textPainter = TextPainter(
      text: TextSpan(
        text: axis == 'y' ? 'PITCH' : 'BEARING',
        style: TextStyle(
          fontSize: 7.5,
          color: Colors.white.withValues(alpha: 0.4),
          letterSpacing: 0.8,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(cx - textPainter.width / 2.0, cy + radius - 16),
    );
  }

  @override
  bool shouldRepaint(covariant _RingHudPainter oldDelegate) =>
      oldDelegate.angle != angle || oldDelegate.axis != axis;
}
