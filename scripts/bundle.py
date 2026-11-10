#!/usr/bin/env python3
"""orbit360 场景包（.orb）：抽帧 + meta + 索引表打进一个二进制文件。

    python3 scripts/bundle.py build assets/<id>/scene.orb a.mp4 [b.mp4 ...]
    python3 scripts/bundle.py info scene.orb [--json]
    python3 scripts/bundle.py extract scene.orb --out DIR [--video v1]

这是项目里唯一的资产构建脚本：GUI（apps/gui）和命令行都调它，产物统一是 .orb。

文件布局（小端）：

    Header      32B   见下
    Meta        metaLen 字节，JSON（UTF-8）
    Index       indexLen 字节，每帧一条 16B：<IIQ> video, length, offset
    Payload     帧数据，顺序 = videos[] × frames，offsets 绝对定位

    Header: <4sIIIIIII>
      0  4B   magic  "ORB3"
      4  4B   version（major << 16 | minor，当前 1.2 = 0x00010002）
      8  4B   prefixLen = 32 + metaLen + indexLen
      12 4B   metaLen
      16 4B   indexLen
      20 4B   frameCount
      24 4B   indexEntrySize（当前 16）
      28 4B   flags（保留，0）

prefixLen 覆盖 Header + Meta + Index，HTTP Range 一次拉这么多字节就能拿到
全部元数据和每帧的 offset/length，之后按需取帧。

meta 是一个对象 + 一个数组：

    {
      "format": "orbit360.bundle",
      "version": 1.2,
      "title": "…",
      "canvas": { "width": 1920, "height": 1080 },
      "totalFrames": 240,
      "codec": "image/webp",
      "initialAngle": 0,
      "orbit": { "axis": "x", "spanDeg": 360, "direction": "cw",
                 "minAngle": -180, "maxAngle": 180 },
      "videos": [{
        "id": "v1",
        "rect": { "x": 0, "y": 0, "width": 960, "height": 1080 },
        "source": { "file": "a.mp4", "width": 3840, "height": 2160, … },
        "orbit": { "axis": "x", "spanDeg": 360, "direction": "cw",
                   "minAngle": -180, "maxAngle": 180 },
        "frames": { "count": 120, "width": 960, "height": 540, "fps": 12,
                    "indexStart": 0 }
      }]
    }

单个视频时 canvas 恒等于帧尺寸，rect 恒为 (0, 0, w, h)。
多个视频时 canvas 由 --canvas 指定，或按一行排布自动取包围盒；
每个视频的 rect 决定它画在画布上的位置与尺寸。
文件里没有视频轨，只有帧。

旋转轴（1.1 新增）：orbit.axis 为 "x" 或 "y"，一个场景只能有一个轴，
每条视频记录也带同一个轴。旧版（version 1.0，无 axis）按 "x" 读取。
角度（1.2 起）：orbit.minAngle / maxAngle 分别限制最小/最大角度，范围
[-180, 180]，向右为正、向左为负；缺省 -180 / 180 表示整圈不限。
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile

MAGIC = b"ORB3"
VERSION_MAJOR, VERSION_MINOR = 1, 2
VERSION = (VERSION_MAJOR << 16) | VERSION_MINOR   # 1.2 = 0x00010002
LEGACY_VERSION = 1                                # 1.0 写成裸整数 1
AXES = ("x", "y")
HEADER = struct.Struct("<4sIIIIIII")
INDEX = struct.Struct("<IIQ")          # video, length, offset
FORMAT = "orbit360.bundle"

# 允许通过环境变量指定 ffmpeg / ffprobe；GUI 用它绕开 PATH 里损坏的 scoop shim。
FFMPEG = os.environ.get("ORBIT360_FFMPEG") or "ffmpeg"
FFPROBE = os.environ.get("ORBIT360_FFPROBE") or "ffprobe"

CODECS = {
    "jpeg": ("image/jpeg", "jpg", "mjpeg"),
    "webp": ("image/webp", "webp", "libwebp"),
    "avif": ("image/avif", "avif", "libaom-av1"),
}
EXT_BY_MIME = {mime: ext for mime, ext, _ in CODECS.values()}


def die(msg):
    print(f"错误: {msg}", file=sys.stderr)
    sys.exit(1)


def version_text(raw):
    """Header 里的 u32 版本号 → "1.2"；裸整数 1 视为 1.0。"""
    if raw == LEGACY_VERSION:
        return "1.0"
    return f"{raw >> 16}.{raw & 0xFFFF}"


def wrap_signed(deg):
    """把任意角度归一到 -180..180。"""
    return (deg + 180) % 360 - 180


def have(binary):
    if os.path.isabs(binary):
        return os.path.isfile(binary)
    return shutil.which(binary) is not None


def probe(path):
    """用 ffprobe 读源视频的尺寸 / 帧率 / 时长 / 编码。"""
    if not have(FFPROBE):
        die(f"找不到 ffprobe（{FFPROBE}），请先安装 ffmpeg，或设置 ORBIT360_FFPROBE")
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_format", "-show_streams", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    v = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
    a = next((s for s in data["streams"] if s.get("codec_type") == "audio"), None)
    if v is None:
        die("文件里没有视频轨")
    num, den = (v.get("r_frame_rate") or "0/1").split("/")
    fps = float(num) / float(den) if float(den) else 0.0
    duration = float(data["format"].get("duration") or v.get("duration") or 0)
    return {
        "width": int(v["width"]),
        "height": int(v["height"]),
        "fps": round(fps, 3),
        "frames": int(v.get("nb_frames") or round(fps * duration)),
        "durationSec": round(duration, 3),
        "codec": v.get("codec_name"),
        "audio": (f"{a['codec_name']} {int(a.get('sample_rate', 0)) // 1000}kHz "
                  f"{'stereo' if a.get('channels') == 2 else str(a.get('channels', 0)) + 'ch'}")
        if a else None,
        "bitRate": int(data["format"].get("bit_rate") or 0),
        "size": int(data["format"].get("size") or 0),
    }


def fit(w, h, long_edge):
    """等比缩放到长边 = long_edge，取偶数。"""
    scale = long_edge / max(w, h)
    return max(2, int(round(w * scale / 2)) * 2), max(2, int(round(h * scale / 2)) * 2)


def parse_size(text):
    try:
        w, h = (int(x) for x in text.lower().replace("×", "x").split("x"))
    except ValueError:
        die(f"尺寸要写成 WxH: {text}")
    if w <= 0 or h <= 0:
        die(f"尺寸必须为正: {text}")
    return w, h


def parse_place(text):
    try:
        x, y, w, h = (int(v) for v in text.split(","))
    except ValueError:
        die(f"位置要写成 x,y,w,h: {text}")
    if w <= 0 or h <= 0:
        die(f"视频尺寸必须为正: {text}")
    return x, y, w, h


def _jpeg_q(quality):
    """0–100（越大越好）换算成 ffmpeg -q:v（2 最好，31 最差）。"""
    return max(2, min(31, int(round(31 - 29 * quality / 100))))


def _avif_crf(quality):
    """0–100（越大越好）换算成 AV1 CRF（0 最好，63 最差）。"""
    return max(0, min(63, int(round(63 - 63 * quality / 100))))


def check_encoder(codec):
    encoder = CODECS[codec][2]
    if not have(FFMPEG):
        die(f"找不到 ffmpeg（{FFMPEG}），请先安装 ffmpeg，或设置 ORBIT360_FFMPEG")
    try:
        out = subprocess.run([FFMPEG, "-hide_banner", "-encoders"],
                             capture_output=True, text=True)
    except OSError as e:
        die(f"无法运行 ffmpeg（{FFMPEG}）：{e}；Windows 上 PATH 里的 scoop shim 可能是损坏的脚本，"
            "请改用真实的 ffmpeg.exe，或设置 ORBIT360_FFMPEG")
    if encoder not in out.stdout:
        die(f"当前 ffmpeg 没有 {encoder} 编码器，换 --codec jpeg 或换带该编码器的 ffmpeg")


def extract_frames(src, out_dir, width, height, fps, count, codec, quality):
    """按 fps/尺寸抽帧，编码成 codec 指定的图片格式。"""
    _, ext, _ = CODECS[codec]
    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        if name.endswith("." + ext):
            os.remove(os.path.join(out_dir, name))
    vf = f"fps={fps},scale={width}:{height}:flags=lanczos"
    cmd = [FFMPEG, "-v", "error", "-y", "-i", src, "-an", "-vf", vf,
           "-f", "image2", "-start_number", "1", "-pix_fmt", "yuv420p"]
    if codec == "jpeg":
        cmd += ["-c:v", "mjpeg", "-q:v", str(_jpeg_q(quality))]
    elif codec == "webp":
        cmd += ["-c:v", "libwebp", "-quality", str(quality), "-compression_level", "6"]
    else:
        cmd += ["-c:v", "libaom-av1", "-crf", str(_avif_crf(quality)),
                "-b:v", "0", "-still-picture", "1", "-cpu-used", "8"]
    cmd.append(os.path.join(out_dir, f"f%03d.{ext}"))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode:
        die(f"ffmpeg 编码 {codec} 失败: {proc.stderr.strip()[:500]}")
    names = sorted(n for n in os.listdir(out_dir) if n.endswith("." + ext))
    if len(names) != count:
        print(f"警告: 期望 {count} 帧，实际 {len(names)} 帧（{out_dir}）", file=sys.stderr)
    return [os.path.join(out_dir, n) for n in names]


def _layout(sizes, canvas, places):
    """返回 (canvas_w, canvas_h, [(x, y, w, h), ...])。sizes 是每个视频的帧尺寸。"""
    n = len(sizes)

    if n == 1:
        w, h = sizes[0]
        if canvas and canvas != (w, h):
            die(f"单个视频的画布就是帧尺寸 {w}x{h}，不能改成 {canvas[0]}x{canvas[1]}")
        if places and (len(places) != 1 or places[0] != (0, 0, w, h)):
            die("单个视频只能放在 (0,0)，且宽高等于帧尺寸")
        return w, h, [(0, 0, w, h)]

    if places:
        if len(places) != n:
            die(f"--place 给了 {len(places)} 个，但有 {n} 个视频")
        rects = list(places)
        for (x, y, w, h) in rects:
            if x < 0 or y < 0:
                die(f"位置不能为负: {x},{y}")
        if canvas is None:
            canvas = (max(x + w for x, y, w, h in rects),
                      max(y + h for x, y, w, h in rects))
        cw, ch = canvas
        for (x, y, w, h) in rects:
            if x + w > cw or y + h > ch:
                die(f"视频 {w}x{h} @({x},{y}) 超出画布 {cw}x{ch}")
        return cw, ch, rects

    # 没给位置：一行排开，整体居中（给了画布时）
    block_w = sum(w for w, h in sizes)
    block_h = max(h for w, h in sizes)
    if canvas is None:
        canvas = (block_w, block_h)
    cw, ch = canvas
    if block_w > cw or block_h > ch:
        die(f"一行需要 {block_w}x{block_h}，超出画布 {cw}x{ch}，请用 --place")
    x0 = (cw - block_w) // 2
    y0 = (ch - block_h) // 2
    rects = []
    x = x0
    for w, h in sizes:
        rects.append((x, y0 + (block_h - h) // 2, w, h))
        x += w
    return cw, ch, rects


def build_meta(title, canvas, mime, total_frames, initial_angle, orbit, videos):
    return {
        "format": FORMAT,
        "version": float(f"{VERSION_MAJOR}.{VERSION_MINOR}"),
        "title": title,
        "canvas": {"width": canvas[0], "height": canvas[1]},
        "totalFrames": total_frames,
        "codec": mime,
        "initialAngle": initial_angle,
        "orbit": orbit,
        "videos": videos,
    }


def _dump(meta):
    return json.dumps(meta, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def pack(out, sources, canvas=None, places=None, fps=12.0, long_edge=1280,
         codec="webp", quality=80, title=None, initial_angle=0.0,
         span_deg=360, direction="cw", axis="x",
         min_angle=-180, max_angle=180):
    if axis not in AXES:
        die(f"--axis 只能是 {' / '.join(AXES)}")
    for name, value in (("minAngle", min_angle), ("maxAngle", max_angle)):
        if not -180 <= value <= 180:
            die(f"--{('min' if name == 'minAngle' else 'max')}-angle 必须在 -180..180: {value}")
    if min_angle >= max_angle:
        die(f"--min-angle 必须小于 --max-angle: {min_angle} / {max_angle}")
    if long_edge <= 0:
        die("--long-edge 必须为正")
    if fps <= 0:
        die("--fps 必须为正")
    if not 0 <= quality <= 100:
        die("--quality 要在 0–100 之间")
    if codec not in CODECS:
        die(f"不支持的编码: {codec}")
    check_encoder(codec)
    mime = CODECS[codec][0]
    initial_angle = round(min(max(wrap_signed(initial_angle), min_angle), max_angle), 3)

    tmp = tempfile.mkdtemp(prefix="orb-bundle-")
    try:
        videos = []
        for i, src in enumerate(sources):
            if not os.path.exists(src):
                die(f"找不到文件: {src}")
            info = probe(src)
            fw, fh = fit(info["width"], info["height"], long_edge)
            rate = min(fps, info["fps"]) if info["fps"] else fps
            rate = max(rate, 0.001)
            count = max(1, int(round(info["durationSec"] * rate)))
            paths = extract_frames(src, os.path.join(tmp, f"v{i + 1}"),
                                   fw, fh, rate, count, codec, quality)
            if not paths:
                die(f"{src} 没有抽到任何帧")
            videos.append({
                "id": f"v{i + 1}",
                "width": fw,
                "height": fh,
                "fps": round(rate, 3),
                "paths": paths,
                "sizes": [os.path.getsize(p) for p in paths],
                "source": {
                    "file": os.path.basename(src),
                    "width": info["width"],
                    "height": info["height"],
                    "fps": info["fps"],
                    "frames": info["frames"],
                    "durationSec": info["durationSec"],
                    "codec": info["codec"],
                },
            })

        cw, ch, rects = _layout([(v["width"], v["height"]) for v in videos],
                                canvas, places)

        total = sum(len(v["paths"]) for v in videos)
        index_len = INDEX.size * total
        vmetas = []
        first = 0
        for v, (x, y, w, h) in zip(videos, rects):
            vmetas.append({
                "id": v["id"],
                "rect": {"x": x, "y": y, "width": w, "height": h},
                "source": v["source"],
                "orbit": {"axis": axis, "spanDeg": span_deg, "direction": direction,
                          "minAngle": min_angle, "maxAngle": max_angle},
                "frames": {
                    "count": len(v["paths"]),
                    "width": v["width"],
                    "height": v["height"],
                    "fps": v["fps"],
                    "indexStart": first,
                },
            })
            first += len(v["paths"])

        meta = build_meta(title, (cw, ch), mime, total, initial_angle,
                          {"axis": axis, "spanDeg": span_deg, "direction": direction,
                           "minAngle": min_angle, "maxAngle": max_angle},
                          vmetas)
        meta_bytes = _dump(meta)
        prefix = HEADER.size + len(meta_bytes) + index_len

        entries = []
        off = prefix
        for vi, v in enumerate(videos):
            for size in v["sizes"]:
                entries.append((vi, size, off))
                off += size

        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
        pos = prefix
        with open(out, "wb") as fh:
            fh.write(HEADER.pack(MAGIC, VERSION, prefix, len(meta_bytes),
                                 index_len, total, INDEX.size, 0))
            fh.write(meta_bytes)
            for vi, size, offset in entries:
                fh.write(INDEX.pack(vi, size, offset))
            # 按 meta 顺序写帧，偏移已固定
            entry_at = 0
            for v in videos:
                for path in v["paths"]:
                    _, size, offset = entries[entry_at]
                    if offset != pos:
                        die("内部错误: 写盘位置与索引偏移不一致")
                    with open(path, "rb") as src_fh:
                        shutil.copyfileobj(src_fh, fh, 1024 * 1024)
                    pos += size
                    entry_at += 1
            if fh.tell() != pos:
                die("内部错误: 文件长度与索引不一致")

        print(f"场景包: {out}  {cw}x{ch}  {codec}  {total} 帧  "
              f"{os.path.getsize(out) / 1024 / 1024:.1f} MB")
        print(f"  头部: {prefix} B（Header 32 + Meta {len(meta_bytes)} + Index {index_len}）")
        for vmeta, v in zip(vmetas, videos):
            r = vmeta["rect"]
            print(f"  {vmeta['id']}: {len(v['paths'])} 帧 {v['width']}x{v['height']}  "
                  f"@({r['x']},{r['y']})  {sum(v['sizes']) / 1024 / 1024:.1f} MB")
        return meta
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _read_limits(orbit, who, default=(-180.0, 180.0)):
    """读 orbit.minAngle / maxAngle；缺省继承 default（整圈 [-180, 180]）。"""
    if not isinstance(orbit, dict):
        return default
    lo = orbit.get("minAngle", default[0])
    hi = orbit.get("maxAngle", default[1])
    if not isinstance(lo, (int, float)) or not isinstance(hi, (int, float)):
        die(f"{who}: minAngle/maxAngle 必须是数字")
    if not -180 <= lo <= 180 or not -180 <= hi <= 180:
        die(f"{who}: minAngle/maxAngle 必须在 -180..180: {lo} / {hi}")
    if lo >= hi:
        die(f"{who}: minAngle 必须小于 maxAngle: {lo} / {hi}")
    return float(lo), float(hi)


def load(path):
    """只读 Header + Meta + Index（Range 请求所需的前 prefixLen 字节）。"""
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        head = fh.read(HEADER.size)
        if len(head) < HEADER.size or head[:4] != MAGIC:
            die("不是 .orb 场景包（magic 不是 ORB3）")
        magic, version, prefix, meta_len, index_len, count, entry_size, flags = \
            HEADER.unpack(head)
        if version not in (VERSION, 0x00010001, LEGACY_VERSION):
            die(f"不支持的版本: {version_text(version)}（本工具支持 1.0 / 1.1 / 1.2）")
        if entry_size != INDEX.size:
            die(f"不支持的索引项大小: {entry_size}")
        if index_len != count * entry_size:
            die("indexLen 与 frameCount 不一致")
        if prefix != HEADER.size + meta_len + index_len:
            die("prefixLen 与 metaLen/indexLen 不一致")
        if prefix > size:
            die("文件被截断（prefixLen 超出文件）")
        raw_meta = fh.read(meta_len)
        raw_index = fh.read(index_len)
        if len(raw_meta) != meta_len or len(raw_index) != index_len:
            die("Header/Meta/Index 被截断")

    try:
        meta = json.loads(raw_meta.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        die(f"meta 不是合法 JSON: {exc}")
    if meta.get("format") != FORMAT:
        die(f"meta.format 不是 {FORMAT}")

    canvas = meta.get("canvas") or {}
    cw, ch = canvas.get("width"), canvas.get("height")
    if not isinstance(cw, int) or not isinstance(ch, int) or cw <= 0 or ch <= 0:
        die("meta 缺少合法的 canvas.width/height")
    videos = meta.get("videos")
    if not isinstance(videos, list) or not videos:
        die("meta 缺少 videos 数组")
    if meta.get("totalFrames") != count:
        die("meta.totalFrames 与 Header 不一致")
    if not isinstance(meta.get("codec"), str):
        die("meta 缺少 codec")
    orbit = meta.get("orbit") or {}
    axis = orbit.get("axis", "x") if isinstance(orbit, dict) else "x"
    if axis not in AXES:
        die(f"meta.orbit.axis 只能是 {' / '.join(AXES)}: {axis!r}")
    min_angle, max_angle = _read_limits(orbit, "meta.orbit")

    for v in videos:
        for key in ("id", "rect", "frames"):
            if key not in v:
                die(f"视频缺少 {key}")
        f, r = v["frames"], v["rect"]
        if not all(isinstance(r.get(k), int) for k in ("x", "y", "width", "height")):
            die(f"{v['id']}: rect 缺少整数 x/y/width/height")
        if r["x"] < 0 or r["y"] < 0 or r["width"] <= 0 or r["height"] <= 0:
            die(f"{v['id']}: rect 非法")
        if r["x"] + r["width"] > cw or r["y"] + r["height"] > ch:
            die(f"{v['id']}: rect 超出画布")
        if not isinstance(f.get("count"), int) or not isinstance(f.get("indexStart"), int):
            die(f"{v['id']}: frames.count/indexStart 必须是整数")
        if f["count"] <= 0:
            die(f"{v['id']}: frames.count 非法")
        v_orbit = v.get("orbit") or {}
        v_axis = v_orbit.get("axis", axis) if isinstance(v_orbit, dict) else axis
        if v_axis not in AXES:
            die(f"{v['id']}: orbit.axis 只能是 {' / '.join(AXES)}: {v_axis!r}")
        if v_axis != axis:
            die(f"{v['id']}: 旋转轴是 {v_axis}，与场景的 {axis} 不一致"
                "（一个场景只能用一个轴）")
        v_min, v_max = _read_limits(v_orbit, v["id"], (min_angle, max_angle))
        if (v_min, v_max) != (min_angle, max_angle):
            die(f"{v['id']}: 角度限制 {v_min}..{v_max} 与场景的 "
                f"{min_angle}..{max_angle} 不一致")

    entries = [INDEX.unpack_from(raw_index, i * INDEX.size) for i in range(count)]
    expected_off = prefix
    entry = 0
    for vi, v in enumerate(videos):
        f = v["frames"]
        if f.get("indexStart") != entry:
            die(f"{v['id']}: frames.indexStart 与顺序不一致")
        for _ in range(f["count"]):
            if entry >= count:
                die("videos 帧数之和超过 Header.frameCount")
            evi, length, offset = entries[entry]
            if evi != vi:
                die(f"{v['id']}: 索引里的 video 编号不一致")
            if length <= 0 or offset != expected_off or offset + length > size:
                die(f"{v['id']}: 第 {entry + 1} 条索引越界或偏移不连续")
            expected_off += length
            entry += 1
    if entry != count or expected_off != size:
        die("索引与文件长度不一致（可能被截断）")

    return meta, entries, prefix, size


def info(path, as_json=False):
    meta, entries, prefix, size = load(path)
    if as_json:
        print(json.dumps(meta, ensure_ascii=False, indent=2))
        return meta
    c = meta["canvas"]
    print(f"{path}  {c['width']}x{c['height']}  {meta['codec']}  "
          f"{meta['totalFrames']} 帧  {size / 1024 / 1024:.1f} MB")
    orbit = meta.get("orbit") or {}
    print(f"title: {meta.get('title', '')}  initialAngle: {meta.get('initialAngle')}°  "
          f"axis: {orbit.get('axis', 'x')}  orbit: {orbit.get('direction')}  "
          f"angle: {orbit.get('minAngle', -180)}..{orbit.get('maxAngle', 180)}°")
    print(f"prefix: {prefix} B（Header+Meta+Index）")
    for v in meta["videos"]:
        f, r = v["frames"], v["rect"]
        start = f["indexStart"]
        nbytes = sum(entries[i][1] for i in range(start, start + f["count"]))
        print(f"  {v['id']}: {f['count']} 帧  {f['width']}x{f['height']} @{f['fps']}fps  "
              f"放在 ({r['x']},{r['y']}) {r['width']}x{r['height']}  "
              f"{nbytes / 1024 / 1024:.1f} MB")
    return meta


def extract_frames_from_bundle(path, out_dir, video_id=None):
    meta, entries, _, _ = load(path)
    picked = meta["videos"]
    if video_id:
        picked = [v for v in picked if v["id"] == video_id]
        if not picked:
            die(f"没有 id 为 {video_id} 的视频")
    ext = EXT_BY_MIME.get(meta["codec"], "bin")
    for v in picked:
        dest = os.path.join(out_dir, v["id"])
        os.makedirs(dest, exist_ok=True)
        start = v["frames"]["indexStart"]
        with open(path, "rb") as fh:
            for i in range(v["frames"]["count"]):
                _, length, offset = entries[start + i]
                fh.seek(offset)
                data = fh.read(length)
                if len(data) != length:
                    die(f"{v['id']} 第 {i + 1} 帧被截断")
                with open(os.path.join(dest, f"f{i + 1:03d}.{ext}"), "wb") as out:
                    out.write(data)
        print(f"{v['id']}: {v['frames']['count']} 帧 → {dest}")
    return picked


def read_meta(path):
    """从 .orb 头部读 meta；文件不存在或格式不对时返回 None。"""
    try:
        with open(path, "rb") as fh:
            head = fh.read(HEADER.size)
            if len(head) < HEADER.size or head[:4] != MAGIC:
                return None
            meta_len = HEADER.unpack(head)[3]
            if meta_len <= 0:
                return None
            return json.loads(fh.read(meta_len).decode("utf-8"))
    except (OSError, ValueError, UnicodeDecodeError):
        return None


def default_assets_root(out):
    """assets/<id>/scene.orb → assets；scene.orb 在根目录时退回它所在目录。"""
    out_dir = os.path.dirname(os.path.abspath(out))
    parent = os.path.dirname(out_dir)
    return parent if parent and parent != out_dir else out_dir


def write_catalog(root, path, default_id=None):
    """扫描 root 下的 <id>/scene.orb，生成页面示例清单（只认 .orb）。"""
    base = os.path.dirname(os.path.abspath(path))
    old_default = None
    old_items = {}
    try:
        old = json.load(open(path, encoding="utf-8"))
        old_default = old.get("default")
        old_items = {i.get("id"): i for i in old.get("items", []) if isinstance(i, dict)}
    except (OSError, ValueError):
        pass

    items = []
    try:
        names = sorted(os.listdir(root))
    except OSError:
        die(f"找不到示例资产根目录: {root}")
    for name in names:
        item_dir = os.path.join(root, name)
        orb = os.path.join(item_dir, "scene.orb")
        if not os.path.isdir(item_dir) or not os.path.isfile(orb):
            continue
        meta = read_meta(orb) or {}
        old_item = old_items.get(name, {})
        videos = meta.get("videos") or []
        source = (videos[0].get("source") if videos else None) or old_item.get("source") or {}
        orbit = meta.get("orbit") or {}
        defaults = dict(old_item.get("defaults") or {})
        defaults["auto"] = {
            "enabled": True,
            "dir": "ccw" if orbit.get("direction") == "ccw" else "cw",
        }
        item = {
            "id": name,
            "title": meta.get("title") or old_item.get("title") or name,
            "orb": os.path.relpath(orb, base).replace(os.sep, "/"),
            "defaults": defaults,
        }
        if source:
            item["source"] = {k: source.get(k) for k in
                              ("width", "height", "frames", "durationSec")}
        items.append(item)
    if not items:
        die(f"{root} 下没有可用的 scene.orb")
    ids = [i["id"] for i in items]
    default = default_id if default_id in ids else (old_default if old_default in ids else ids[0])
    doc = {"default": default, "items": items}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"清单: {path}（{len(items)} 个示例: {', '.join(ids)}）")
    return doc


def main():
    ap = argparse.ArgumentParser(description="多视频帧 + meta + 索引打成 .orb")
    sub = ap.add_subparsers(dest="cmd", required=True)

    bp = sub.add_parser("build", help="抽帧并打包")
    bp.add_argument("out", help="输出 .orb")
    bp.add_argument("videos", nargs="+", help="一个或多个源视频，按顺序成为 v1, v2, …")
    bp.add_argument("--canvas", type=parse_size, default=None,
                    help="画布尺寸 WxH；单个视频时必须是帧尺寸，多个视频默认一行包围盒")
    bp.add_argument("--place", type=parse_place, action="append", default=None,
                    help="视频在画布上的 x,y,w,h，按视频顺序重复；不给则一行排开")
    bp.add_argument("--fps", type=float, default=12.0, help="采样帧率（默认 12）")
    bp.add_argument("--long-edge", type=int, default=1280, help="每帧长边（默认 1280）")
    bp.add_argument("--codec", choices=sorted(CODECS), default="webp",
                    help="帧编码（默认 webp）")
    bp.add_argument("--quality", type=int, default=80,
                    help="0–100，越大越清晰（默认 80；webp 原生，jpeg/avif 会换算）")
    bp.add_argument("--initial-angle", type=float, default=0.0, help="初始视角角度（默认 0）")
    bp.add_argument("--title", default=None, help="场景标题；默认取输出文件名")
    bp.add_argument("--orbit-span", type=float, default=360, help="meta.orbit.spanDeg（默认 360）")
    bp.add_argument("--orbit-dir", choices=["cw", "ccw"], default="cw",
                    help="meta.orbit.direction（默认 cw）")
    bp.add_argument("--axis", choices=list(AXES), default="x",
                    help="旋转轴：x（水平环绕）/ y（垂直环绕，默认 x）；一个场景只能有一个轴")
    bp.add_argument("--min-angle", type=float, default=-180,
                    help="最小角度 -180..180（默认 -180；向左为负）")
    bp.add_argument("--max-angle", type=float, default=180,
                    help="最大角度 -180..180（默认 180；与 --min-angle 分别限制）")
    bp.add_argument("--catalog", default=None,
                    help="构建后刷新示例清单，例如 catalog.json")
    bp.add_argument("--assets-root", default=None,
                    help="示例资产根目录（默认取输出目录的父目录）")

    ip = sub.add_parser("info", help="查看画布、视频与帧信息")
    ip.add_argument("bundle")
    ip.add_argument("--json", action="store_true", help="直接输出完整 meta")

    ep = sub.add_parser("extract", help="把帧还原成目录")
    ep.add_argument("bundle")
    ep.add_argument("--out", required=True, help="输出目录，每视频一个子目录")
    ep.add_argument("--video", default=None, help="只导出某个 id")

    args = ap.parse_args()
    if args.cmd == "build":
        title = args.title or os.path.splitext(os.path.basename(args.out))[0]
        meta = pack(args.out, args.videos, canvas=args.canvas, places=args.place,
                    fps=args.fps, long_edge=args.long_edge, codec=args.codec,
                    quality=args.quality, title=title, initial_angle=args.initial_angle,
                    span_deg=args.orbit_span, direction=args.orbit_dir, axis=args.axis,
                    min_angle=args.min_angle, max_angle=args.max_angle)
        if args.catalog:
            root = args.assets_root or default_assets_root(args.out)
            out_dir = os.path.dirname(os.path.abspath(args.out))
            default_id = os.path.basename(out_dir) if os.path.dirname(out_dir) == \
                os.path.abspath(root) else None
            write_catalog(root, args.catalog, default_id)
        print(f"meta: title={meta.get('title')}  orbit={meta.get('orbit')}  "
              f"codec={meta.get('codec')}")
    elif args.cmd == "info":
        info(args.bundle, args.json)
    else:
        extract_frames_from_bundle(args.bundle, args.out, args.video)


if __name__ == "__main__":
    main()
