import 'dart:convert';
import 'dart:typed_data';

const List<int> magicBytes = [0x4f, 0x52, 0x42, 0x33]; // "ORB3"
const int headerSize = 32;
const int entrySize = 16;
const String bundleFormat = "orbit360.bundle";
const int versionMajor = 1;
const int versionMinor = 2;
const int currentVersion = (versionMajor << 16) | versionMinor; // 0x00010002
const double metaVersion = 1.2;

class OrbMetaException implements Exception {
  final String code;
  final String message;
  final int? offset;

  OrbMetaException(this.code, this.message, [this.offset]);

  @override
  String toString() => 'ORB3[$code]: $message';
}

Never _fail(String code, String message, [int? offset]) {
  throw OrbMetaException(code, message, offset);
}

bool _isObject(Object? value) => value is Map<String, dynamic>;

bool _isInt(Object? value) =>
    value is int ||
    (value is double && value.isFinite && value == value.truncateToDouble());

int _asInt(Object? value) => (value as num).toInt();

double _asDouble(Object? value) => (value as num).toDouble();

double _doubleOr(Object? value, String code, String message) {
  if (value is num && value.isFinite) return value.toDouble();
  _fail(code, message);
}

int _intOr(Object? value, String code, String message) {
  if (_isInt(value)) return (value as num).toInt();
  _fail(code, message);
}

class BundleHeader {
  final int version;
  final int prefixLen;
  final int metaLen;
  final int indexLen;
  final int frameCount;
  final int indexEntrySize;
  final int flags;

  const BundleHeader({
    required this.version,
    required this.prefixLen,
    required this.metaLen,
    required this.indexLen,
    required this.frameCount,
    required this.indexEntrySize,
    required this.flags,
  });

  factory BundleHeader.fromBytes(Uint8List bytes) {
    if (bytes.lengthInBytes < headerSize) {
      _fail('ORB_TRUNCATED_HEADER', '头部不足 32 字节');
    }
    final dv = ByteData.sublistView(bytes);
    for (int i = 0; i < 4; i++) {
      if (dv.getUint8(i) != magicBytes[i]) {
        _fail('ORB_INVALID_MAGIC', 'magic 不是 ORB3');
      }
    }
    final version = dv.getUint32(4, Endian.little);
    final prefixLen = dv.getUint32(8, Endian.little);
    final metaLen = dv.getUint32(12, Endian.little);
    final indexLen = dv.getUint32(16, Endian.little);
    final frameCount = dv.getUint32(20, Endian.little);
    final indexEntrySize = dv.getUint32(24, Endian.little);
    final flags = dv.getUint32(28, Endian.little);

    if (version != currentVersion) {
      _fail('ORB_UNSUPPORTED_VERSION',
          '不支持的版本 ${version >>> 16}.${version & 0xffff}', 4);
    }
    if (indexEntrySize != entrySize) {
      _fail('ORB_INVALID_INDEX_ENTRY_SIZE', '不支持的索引项大小 $indexEntrySize', 24);
    }
    if (frameCount <= 0) _fail('ORB_INVALID_FRAME_COUNT', 'frameCount 为 0', 20);
    if (indexLen != frameCount * entrySize) {
      _fail('ORB_INVALID_INDEX_LENGTH', 'indexLen 与 frameCount 不一致', 16);
    }
    if (prefixLen != headerSize + metaLen + indexLen) {
      _fail('ORB_INVALID_PREFIX_LENGTH', 'prefixLen 不一致', 8);
    }

    return BundleHeader(
      version: version,
      prefixLen: prefixLen,
      metaLen: metaLen,
      indexLen: indexLen,
      frameCount: frameCount,
      indexEntrySize: indexEntrySize,
      flags: flags,
    );
  }
}

class OrbitMeta {
  final String axis;
  final double spanDeg;
  final String direction;
  final double minAngle;
  final double maxAngle;

  const OrbitMeta({
    this.axis = 'x',
    this.spanDeg = 360,
    this.direction = 'cw',
    this.minAngle = -180,
    this.maxAngle = 180,
  });

  factory OrbitMeta.fromJson(Map<String, dynamic>? json, String where,
      {OrbitMeta? fallback}) {
    final raw = json ?? <String, dynamic>{};
    final base = fallback ?? const OrbitMeta();
    final axis = raw['axis'] ?? base.axis;
    if (axis != 'x' && axis != 'y') _fail('ORB_INVALID_AXIS', '$where.axis 非法');
    final direction = raw['direction'] ?? base.direction;
    if (direction != 'cw' && direction != 'ccw') {
      _fail('ORB_INVALID_DIRECTION', '$where.direction 非法');
    }
    final spanDeg = raw['spanDeg'] == null
        ? base.spanDeg
        : _doubleOr(raw['spanDeg'], 'ORB_INVALID_SPAN', '$where.spanDeg 非法');
    if (spanDeg <= 0 || spanDeg > 360) {
      _fail('ORB_INVALID_SPAN', '$where.spanDeg 非法');
    }
    final minAngle = raw['minAngle'] == null
        ? base.minAngle
        : _doubleOr(
            raw['minAngle'], 'ORB_INVALID_ANGLE_RANGE', '$where.minAngle 非法');
    final maxAngle = raw['maxAngle'] == null
        ? base.maxAngle
        : _doubleOr(
            raw['maxAngle'], 'ORB_INVALID_ANGLE_RANGE', '$where.maxAngle 非法');
    if (minAngle < -180 || maxAngle > 180 || minAngle >= maxAngle) {
      _fail('ORB_INVALID_ANGLE_RANGE', '$where.minAngle/maxAngle 非法');
    }
    return OrbitMeta(
      axis: axis as String,
      spanDeg: spanDeg,
      direction: direction as String,
      minAngle: minAngle,
      maxAngle: maxAngle,
    );
  }

  bool sameAs(OrbitMeta other) =>
      axis == other.axis &&
      direction == other.direction &&
      spanDeg == other.spanDeg &&
      minAngle == other.minAngle &&
      maxAngle == other.maxAngle;
}

class RectMeta {
  final int x;
  final int y;
  final int width;
  final int height;

  const RectMeta({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  factory RectMeta.fromJson(Map<String, dynamic> json) {
    return RectMeta(
      x: _intOr(json['x'], 'ORB_INVALID_RECT', 'rect.x 非法'),
      y: _intOr(json['y'], 'ORB_INVALID_RECT', 'rect.y 非法'),
      width: _intOr(json['width'], 'ORB_INVALID_RECT', 'rect.width 非法'),
      height: _intOr(json['height'], 'ORB_INVALID_RECT', 'rect.height 非法'),
    );
  }
}

class VideoFramesMeta {
  final int count;
  final int width;
  final int height;
  final double fps;
  final int indexStart;

  const VideoFramesMeta({
    required this.count,
    required this.width,
    required this.height,
    required this.fps,
    required this.indexStart,
  });

  factory VideoFramesMeta.fromJson(Map<String, dynamic> json) {
    return VideoFramesMeta(
      count:
          _intOr(json['count'], 'ORB_INVALID_FRAME_COUNT', 'frames.count 非法'),
      width: json['width'] == null
          ? 0
          : _intOr(json['width'], 'ORB_INVALID_FRAME_COUNT', 'frames.width 非法'),
      height: json['height'] == null
          ? 0
          : _intOr(
              json['height'], 'ORB_INVALID_FRAME_COUNT', 'frames.height 非法'),
      fps: json['fps'] == null
          ? 0
          : _doubleOr(json['fps'], 'ORB_INVALID_FRAME_COUNT', 'frames.fps 非法'),
      indexStart: _intOr(json['indexStart'], 'ORB_INVALID_INDEX_START',
          'frames.indexStart 非法'),
    );
  }
}

class VideoMeta {
  final String id;
  final RectMeta rect;
  final OrbitMeta orbit;
  final VideoFramesMeta frames;
  final Map<String, dynamic> raw;

  const VideoMeta({
    required this.id,
    required this.rect,
    required this.orbit,
    required this.frames,
    required this.raw,
  });

  factory VideoMeta.fromJson(
    Map<String, dynamic> json,
    int index,
    OrbitMeta sceneOrbit,
  ) {
    final framesJson = json['frames'];
    final rectJson = json['rect'];
    if (!_isObject(framesJson) || !_isObject(rectJson)) {
      _fail('ORB_INVALID_VIDEOS', '视频 $index 缺少 rect/frames');
    }
    final frames = VideoFramesMeta.fromJson(framesJson as Map<String, dynamic>);
    if (frames.count <= 0) {
      _fail('ORB_INVALID_FRAME_COUNT', '视频 $index 的 frames.count 非法');
    }
    final orbitJson = json['orbit'];
    if (orbitJson != null && !_isObject(orbitJson)) {
      _fail('ORB_INVALID_ORBIT', '视频 $index 的 orbit 不是对象');
    }
    final orbit = OrbitMeta.fromJson(
      orbitJson as Map<String, dynamic>?,
      '视频 $index 的 orbit',
      fallback: sceneOrbit,
    );
    if (!orbit.sameAs(sceneOrbit)) {
      _fail('ORB_INVALID_VIDEO_ORBIT', '视频 $index 的 orbit 与场景不一致');
    }
    return VideoMeta(
      id: json['id'] is String ? json['id'] as String : '',
      rect: RectMeta.fromJson(rectJson as Map<String, dynamic>),
      orbit: orbit,
      frames: frames,
      raw: json,
    );
  }
}

class BundleMeta {
  final String format;
  final double version;
  final String title;
  final int canvasWidth;
  final int canvasHeight;
  final int totalFrames;
  final String codec;
  final double initialAngle;
  final OrbitMeta orbit;
  final List<VideoMeta> videos;
  final Map<String, dynamic> raw;

  const BundleMeta({
    required this.format,
    required this.version,
    required this.title,
    required this.canvasWidth,
    required this.canvasHeight,
    required this.totalFrames,
    required this.codec,
    required this.initialAngle,
    required this.orbit,
    required this.videos,
    required this.raw,
  });

  factory BundleMeta.fromJson(Map<String, dynamic> json, int frameCount) {
    if (json['format'] != bundleFormat) {
      _fail('ORB_INVALID_FORMAT', 'meta.format 非法');
    }
    final version = json['version'] == null
        ? 0.0
        : _doubleOr(
            json['version'], 'ORB_INVALID_META_VERSION', 'meta.version 非法');
    if (version != metaVersion) {
      _fail('ORB_INVALID_META_VERSION', 'meta.version 非法');
    }
    final canvas = json['canvas'];
    if (!_isObject(canvas) ||
        !_isInt(canvas['width']) ||
        !_isInt(canvas['height']) ||
        (canvas['width'] as num) <= 0 ||
        (canvas['height'] as num) <= 0) {
      _fail('ORB_INVALID_CANVAS', 'meta 缺少合法的 canvas');
    }
    if (json['totalFrames'] != frameCount) {
      _fail('ORB_FRAME_COUNT_MISMATCH', 'meta.totalFrames 与头部不一致');
    }
    final codec = json['codec'];
    if (codec is! String || codec.isEmpty) {
      _fail('ORB_INVALID_CODEC', 'meta 缺少 codec');
    }
    final videosJson = json['videos'];
    if (videosJson is! List || videosJson.isEmpty) {
      _fail('ORB_INVALID_VIDEOS', 'meta 缺少 videos 数组');
    }
    final orbitJson = json['orbit'];
    if (orbitJson != null && !_isObject(orbitJson)) {
      _fail('ORB_INVALID_ORBIT', 'meta.orbit 不是对象');
    }
    final orbit =
        OrbitMeta.fromJson(orbitJson as Map<String, dynamic>?, 'meta.orbit');
    final videos = <VideoMeta>[];
    int indexStart = 0;
    int sum = 0;
    for (int i = 0; i < videosJson.length; i++) {
      final item = videosJson[i];
      if (!_isObject(item)) _fail('ORB_INVALID_VIDEOS', '视频 $i 不是对象');
      final video = VideoMeta.fromJson(item as Map<String, dynamic>, i, orbit);
      if (video.frames.indexStart != indexStart) {
        _fail('ORB_INVALID_INDEX_START', '视频 $i 的 indexStart 不连续');
      }
      final rect = video.rect;
      if (rect.x < 0 ||
          rect.y < 0 ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          rect.x + rect.width > _asInt(canvas['width']) ||
          rect.y + rect.height > _asInt(canvas['height'])) {
        _fail('ORB_INVALID_RECT', '视频 $i 的 rect 越界');
      }
      videos.add(video);
      indexStart += video.frames.count;
      sum += video.frames.count;
    }
    if (sum != frameCount) {
      _fail('ORB_FRAME_COUNT_MISMATCH', 'videos 帧数之和与 frameCount 不一致');
    }
    return BundleMeta(
      format: json['format'] as String,
      version: version,
      title: json['title'] is String ? json['title'] as String : '',
      canvasWidth: _asInt(canvas['width']),
      canvasHeight: _asInt(canvas['height']),
      totalFrames: _asInt(json['totalFrames']),
      codec: codec,
      initialAngle:
          json['initialAngle'] == null ? 0 : _asDouble(json['initialAngle']),
      orbit: orbit,
      videos: videos,
      raw: json,
    );
  }
}

class FrameEntry {
  final int video;
  final int length;
  final int offset;

  const FrameEntry({
    required this.video,
    required this.length,
    required this.offset,
  });
}

class OrbVideoLayer {
  final int videoIndex;
  final RectMeta rect;
  final int frameCount;
  final int indexStart;

  const OrbVideoLayer({
    required this.videoIndex,
    required this.rect,
    required this.frameCount,
    required this.indexStart,
  });
}

class OrbBundle {
  final BundleHeader header;
  final BundleMeta meta;
  final List<FrameEntry> entries;
  final List<OrbVideoLayer> layers;
  final int size;
  final Uint8List? rawBytes;
  final Map<String, dynamic> sceneConfig;

  const OrbBundle({
    required this.header,
    required this.meta,
    required this.entries,
    required this.layers,
    required this.size,
    this.rawBytes,
    required this.sceneConfig,
  });

  int get prefixLen => header.prefixLen;

  FrameEntry frameEntry(int videoIndex, int frameIndex) {
    if (videoIndex < 0 || videoIndex >= meta.videos.length) {
      _fail('ORB_INVALID_ARGUMENT', '没有视频 $videoIndex');
    }
    final video = meta.videos[videoIndex];
    if (frameIndex < 0 || frameIndex >= video.frames.count) {
      _fail('ORB_INVALID_ARGUMENT', '视频 $videoIndex 没有第 $frameIndex 帧');
    }
    return entries[video.frames.indexStart + frameIndex];
  }

  Uint8List frameBytes(int videoIndex, int frameIndex) {
    if (rawBytes == null) _fail('ORB_INVALID_ARGUMENT', '解析结果没有完整文件数据');
    final entry = frameEntry(videoIndex, frameIndex);
    return Uint8List.sublistView(
        rawBytes!, entry.offset, entry.offset + entry.length);
  }

  static const List<String> _configKeys = [
    'title',
    'video',
    'orbit',
    'drag',
    'motion',
    'auto',
    'gyro',
    'mouseFollow',
    'defaults',
    'quality',
  ];

  static OrbBundle parse(Uint8List bytes) {
    if (bytes.lengthInBytes < headerSize) {
      _fail('ORB_TRUNCATED_HEADER', '头部不足 32 字节');
    }
    final header = BundleHeader.fromBytes(bytes);
    if (bytes.lengthInBytes < header.prefixLen) {
      _fail('ORB_TRUNCATED_PREFIX', 'Header/Meta/Index 不完整');
    }
    final metaBytes =
        Uint8List.sublistView(bytes, headerSize, headerSize + header.metaLen);
    late final Map<String, dynamic> json;
    try {
      final decoded = jsonDecode(utf8.decode(metaBytes));
      if (decoded is! Map<String, dynamic>) {
        _fail('ORB_INVALID_META', 'meta 不是对象');
      }
      json = decoded;
    } on OrbMetaException {
      rethrow;
    } catch (error) {
      _fail('ORB_INVALID_META_JSON', 'meta 不是合法 JSON: $error');
    }
    final meta = BundleMeta.fromJson(json, header.frameCount);
    final layers = <OrbVideoLayer>[];
    for (int i = 0; i < meta.videos.length; i++) {
      final video = meta.videos[i];
      layers.add(OrbVideoLayer(
        videoIndex: i,
        rect: video.rect,
        frameCount: video.frames.count,
        indexStart: video.frames.indexStart,
      ));
    }

    final dv = ByteData.sublistView(bytes);
    final entries = <FrameEntry>[];
    int expectedOffset = header.prefixLen;
    int entryIndex = 0;
    for (int videoIndex = 0; videoIndex < layers.length; videoIndex++) {
      final layer = layers[videoIndex];
      for (int frame = 0; frame < layer.frameCount; frame++) {
        final base = headerSize + header.metaLen + entryIndex * entrySize;
        final video = dv.getUint32(base, Endian.little);
        final length = dv.getUint32(base + 4, Endian.little);
        final low = dv.getUint32(base + 8, Endian.little);
        final high = dv.getUint32(base + 12, Endian.little);
        if (high > 0x7fffffff) {
          _fail('ORB_INVALID_INDEX', '第 $entryIndex 条索引 offset 超出平台范围');
        }
        final offset = high * 4294967296 + low;
        if (video != videoIndex) {
          _fail('ORB_INVALID_INDEX', '第 $entryIndex 条索引 video 编号不对');
        }
        if (length == 0) {
          _fail('ORB_INVALID_INDEX', '第 $entryIndex 条索引 length 为 0');
        }
        if (offset != expectedOffset) {
          _fail('ORB_INVALID_INDEX', '第 $entryIndex 条索引 offset 不连续');
        }
        if (offset + length > bytes.lengthInBytes) {
          _fail('ORB_TRUNCATED_FRAME', '第 $entryIndex 条索引越界');
        }
        entries.add(FrameEntry(video: video, length: length, offset: offset));
        expectedOffset += length;
        entryIndex++;
      }
    }
    if (expectedOffset != bytes.lengthInBytes) {
      _fail('ORB_INVALID_INDEX', '索引与文件长度不一致');
    }

    final sceneConfig = <String, dynamic>{};
    for (final key in _configKeys) {
      if (json[key] != null) sceneConfig[key] = json[key];
    }
    return OrbBundle(
      header: header,
      meta: meta,
      entries: entries,
      layers: layers,
      size: bytes.lengthInBytes,
      rawBytes: bytes,
      sceneConfig: sceneConfig,
    );
  }
}
