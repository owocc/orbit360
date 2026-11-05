import 'dart:convert';
import 'dart:typed_data';

const List<int> magicBytes = [0x4f, 0x52, 0x42, 0x33]; // "ORB3"
const int headerSize = 32;
const int entrySize = 16;
const String bundleFormat = "orbit360.bundle";

const int versionMajor = 1;
const int versionMinor = 2;
const int currentVersion = (versionMajor << 16) | versionMinor; // 0x00010002

class OrbMetaException implements Exception {
  final String message;
  OrbMetaException(this.message);

  @override
  String toString() => 'ORB3: $message';
}

void _fail(String msg) {
  throw OrbMetaException(msg);
}

String _versionText(int raw) {
  return raw == 1 ? '1.0' : '${raw >>> 16}.${raw & 0xffff}';
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
      _fail('头部不足 32 字节');
    }
    final dv = ByteData.sublistView(bytes);
    for (int i = 0; i < 4; i++) {
      if (dv.getUint8(i) != magicBytes[i]) {
        _fail('magic 不是 ORB3');
      }
    }
    final version = dv.getUint32(4, Endian.little);
    final prefixLen = dv.getUint32(8, Endian.little);
    final metaLen = dv.getUint32(12, Endian.little);
    final indexLen = dv.getUint32(16, Endian.little);
    final frameCount = dv.getUint32(20, Endian.little);
    final indexEntrySize = dv.getUint32(24, Endian.little);
    final flags = dv.getUint32(28, Endian.little);

    if (version != currentVersion && version != 0x00010001 && version != 1) {
      _fail('不支持的版本 ${_versionText(version)}（支持 1.0 / 1.1 / 1.2）');
    }
    if (indexEntrySize != entrySize) {
      _fail('不支持的索引项大小 $indexEntrySize');
    }
    if (indexLen != frameCount * entrySize) {
      _fail('indexLen 与 frameCount 不一致');
    }
    if (prefixLen != headerSize + metaLen + indexLen) {
      _fail('prefixLen 不一致');
    }
    if (frameCount <= 0) {
      _fail('frameCount 为 0');
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
  final String axis; // 'x' | 'y'
  final double spanDeg;
  final String direction; // 'cw' | 'ccw'
  final double minAngle;
  final double maxAngle;

  const OrbitMeta({
    this.axis = 'x',
    this.spanDeg = 360,
    this.direction = 'cw',
    this.minAngle = -180,
    this.maxAngle = 180,
  });

  factory OrbitMeta.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const OrbitMeta();
    final axis = json['axis'] as String? ?? 'x';
    final spanDeg = (json['spanDeg'] as num?)?.toDouble() ?? 360.0;
    final direction = json['direction'] as String? ?? 'cw';
    final minAngle = (json['minAngle'] as num?)?.toDouble() ?? -180.0;
    final maxAngle = (json['maxAngle'] as num?)?.toDouble() ?? 180.0;
    return OrbitMeta(
      axis: axis,
      spanDeg: spanDeg,
      direction: direction,
      minAngle: minAngle,
      maxAngle: maxAngle,
    );
  }
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
      x: (json['x'] as num).toInt(),
      y: (json['y'] as num).toInt(),
      width: (json['width'] as num).toInt(),
      height: (json['height'] as num).toInt(),
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
      count: (json['count'] as num).toInt(),
      width: (json['width'] as num).toInt(),
      height: (json['height'] as num).toInt(),
      fps: (json['fps'] as num).toDouble(),
      indexStart: (json['indexStart'] as num).toInt(),
    );
  }
}

class VideoMeta {
  final String id;
  final RectMeta rect;
  final OrbitMeta? orbit;
  final VideoFramesMeta frames;
  final Map<String, dynamic> raw;

  const VideoMeta({
    required this.id,
    required this.rect,
    this.orbit,
    required this.frames,
    required this.raw,
  });

  factory VideoMeta.fromJson(Map<String, dynamic> json) {
    return VideoMeta(
      id: json['id'] as String? ?? '',
      rect: RectMeta.fromJson(json['rect'] as Map<String, dynamic>),
      orbit: json['orbit'] != null
          ? OrbitMeta.fromJson(json['orbit'] as Map<String, dynamic>)
          : null,
      frames: VideoFramesMeta.fromJson(json['frames'] as Map<String, dynamic>),
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

  factory BundleMeta.fromJson(Map<String, dynamic> json) {
    final format = json['format'] as String? ?? '';
    final version = (json['version'] as num?)?.toDouble() ?? 1.2;
    final title = json['title'] as String? ?? '';
    final canvas = json['canvas'] as Map<String, dynamic>? ?? {};
    final canvasWidth = (canvas['width'] as num?)?.toInt() ?? 0;
    final canvasHeight = (canvas['height'] as num?)?.toInt() ?? 0;
    final totalFrames = (json['totalFrames'] as num?)?.toInt() ?? 0;
    final codec = json['codec'] as String? ?? '';
    final initialAngle = (json['initialAngle'] as num?)?.toDouble() ?? 0.0;
    final orbit = OrbitMeta.fromJson(json['orbit'] as Map<String, dynamic>?);
    final videosList = (json['videos'] as List<dynamic>? ?? [])
        .map((v) => VideoMeta.fromJson(v as Map<String, dynamic>))
        .toList();

    return BundleMeta(
      format: format,
      version: version,
      title: title,
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      totalFrames: totalFrames,
      codec: codec,
      initialAngle: initialAngle,
      orbit: orbit,
      videos: videosList,
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

class OrbBundle {
  final BundleHeader header;
  final BundleMeta meta;
  final List<FrameEntry> entries;
  final int size;
  final Uint8List? rawBytes;

  const OrbBundle({
    required this.header,
    required this.meta,
    required this.entries,
    required this.size,
    this.rawBytes,
  });

  int get prefixLen => header.prefixLen;

  FrameEntry frameEntry(int videoIndex, int frameIndex) {
    if (videoIndex < 0 || videoIndex >= meta.videos.length) {
      _fail('没有视频 $videoIndex');
    }
    final v = meta.videos[videoIndex];
    if (frameIndex < 0 || frameIndex >= v.frames.count) {
      _fail('视频 $videoIndex 没有第 $frameIndex 帧');
    }
    return entries[v.frames.indexStart + frameIndex];
  }

  Uint8List frameBytes(int videoIndex, int frameIndex) {
    if (rawBytes == null) {
      _fail('当前 Bundle 未保留全量字节，无法直接提取帧');
    }
    final e = frameEntry(videoIndex, frameIndex);
    return rawBytes!.sublist(e.offset, e.offset + e.length);
  }

  static OrbBundle parse(Uint8List bytes) {
    if (bytes.lengthInBytes < headerSize) {
      _fail('头部不足 32 字节');
    }
    final h = BundleHeader.fromBytes(bytes);
    if (bytes.lengthInBytes < h.prefixLen) {
      _fail('Header/Meta/Index 不完整');
    }

    final isWhole = bytes.lengthInBytes > h.prefixLen;
    final parsed = _parsePrefix(
      bytes,
      h,
      isWhole ? bytes.lengthInBytes : null,
      isWhole,
    );

    return OrbBundle(
      header: h,
      meta: parsed.meta,
      entries: parsed.entries,
      size: bytes.lengthInBytes,
      rawBytes: bytes,
    );
  }

  static ({BundleMeta meta, List<FrameEntry> entries}) _parsePrefix(
    Uint8List buffer,
    BundleHeader h,
    int? fileSize,
    bool strictEnd,
  ) {
    if (buffer.lengthInBytes < h.prefixLen) {
      _fail('Header/Meta/Index 不完整');
    }

    final metaBytes = Uint8List.sublistView(
      buffer,
      headerSize,
      headerSize + h.metaLen,
    );

    late final BundleMeta meta;
    try {
      final jsonStr = utf8.decode(metaBytes);
      final jsonMap = json.decode(jsonStr) as Map<String, dynamic>;
      meta = BundleMeta.fromJson(jsonMap);
    } catch (err) {
      _fail('meta 不是合法 JSON: $err');
    }

    if (meta.format != bundleFormat) {
      _fail('meta.format 不是 $bundleFormat');
    }
    if (meta.canvasWidth <= 0 || meta.canvasHeight <= 0) {
      _fail('meta 缺少合法的 canvas.width/height');
    }
    if (meta.totalFrames != h.frameCount) {
      _fail('meta.totalFrames 与头部不一致');
    }
    if (meta.codec.isEmpty) {
      _fail('meta 缺少 codec');
    }
    if (meta.videos.isEmpty) {
      _fail('meta 缺少 videos 数组');
    }

    final sceneAxis = meta.orbit.axis;
    if (sceneAxis != 'x' && sceneAxis != 'y') {
      _fail('meta.orbit.axis 只能是 x / y');
    }
    final sceneMin = meta.orbit.minAngle;
    final sceneMax = meta.orbit.maxAngle;
    if (sceneMin < -180 || sceneMax > 180 || sceneMin >= sceneMax) {
      _fail('meta.orbit.minAngle/maxAngle 必须在 -180..180 且 min < max');
    }

    int sum = 0;
    int expectStart = 0;
    for (int vi = 0; vi < meta.videos.length; vi++) {
      final v = meta.videos[vi];
      final f = v.frames;
      final r = v.rect;
      final videoAxis = v.orbit?.axis ?? sceneAxis;
      if (videoAxis != 'x' && videoAxis != 'y') {
        _fail('视频 $vi 的 orbit.axis 只能是 x / y');
      }
      if (videoAxis != sceneAxis) {
        _fail('视频 $vi 的轴 $videoAxis 与场景的 $sceneAxis 不一致');
      }
      final videoMin = v.orbit?.minAngle ?? sceneMin;
      final videoMax = v.orbit?.maxAngle ?? sceneMax;
      if (videoMin != sceneMin || videoMax != sceneMax) {
        _fail('视频 $vi 的角度限制与场景不一致');
      }
      if (f.count <= 0) {
        _fail('视频 $vi 的 frames.count 非法');
      }
      if (f.indexStart != expectStart) {
        _fail('视频 $vi 的 indexStart 不连续');
      }
      if (r.x < 0 ||
          r.y < 0 ||
          r.width <= 0 ||
          r.height <= 0 ||
          r.x + r.width > meta.canvasWidth ||
          r.y + r.height > meta.canvasHeight) {
        _fail('视频 $vi 的 rect 越界');
      }
      expectStart += f.count;
      sum += f.count;
    }

    if (sum != h.frameCount) {
      _fail('videos 帧数之和与 frameCount 不一致');
    }

    final dv = ByteData.sublistView(buffer);
    final entries = List<FrameEntry>.filled(
      h.frameCount,
      const FrameEntry(video: 0, length: 0, offset: 0),
      growable: false,
    );

    int expectedOff = h.prefixLen;
    int e = 0;
    for (int vi = 0; vi < meta.videos.length; vi++) {
      final count = meta.videos[vi].frames.count;
      for (int k = 0; k < count; k++) {
        final base = headerSize + h.metaLen + e * entrySize;
        final ev = dv.getUint32(base, Endian.little);
        final len = dv.getUint32(base + 4, Endian.little);
        final lo = dv.getUint32(base + 8, Endian.little);
        final hi = dv.getUint32(base + 12, Endian.little);
        final off = hi * 4294967296 + lo;

        if (ev != vi) _fail('第 $e 条索引的 video 编号不对');
        if (len == 0 || off != expectedOff) _fail('第 $e 条索引偏移不连续');
        if (fileSize != null && off + len > fileSize) _fail('第 $e 条索引越界');

        entries[e] = FrameEntry(video: ev, length: len, offset: off);
        expectedOff += len;
        e++;
      }
    }

    if (fileSize != null && strictEnd && expectedOff != fileSize) {
      _fail('索引与文件长度不一致（可能被截断）');
    }

    return (meta: meta, entries: entries);
  }
}
