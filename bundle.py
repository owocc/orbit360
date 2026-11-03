#!/usr/bin/env python3
"""orbit360 多视频场景包（.orb）：抽帧 + meta + 索引表打进一个二进制文件。

    python3 bundle.py build scene.orb a.mp4 [b.mp4 ...] [--canvas WxH]
    python3 bundle.py info scene.orb [--json]
    python3 bundle.py extract scene.orb --out DIR [--video v1]

文件布局（小端）：

    Header      32B   见下
    Meta        metaLen 字节，JSON（UTF-8）
    Index       indexLen 字节，每帧一条 16B：<IIQ> video, length, offset
    Payload     帧数据，顺序 = videos[] × frames，offsets 绝对定位

    Header: <4sIIIIIII>
      0  4B   magic  "ORB3"
      4  4B   version（当前 1）
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
      "version": 1,
      "title": "…",
      "canvas": { "width": 1920, "height": 1080 },
      "totalFrames": 240,
      "codec": "image/webp",
      "initialAngle": 0,
      "orbit": { "spanDeg": 360, "direction": "cw" },
      "videos": [{
        "id": "v1",
        "rect": { "x": 0, "y": 0, "width": 960, "height": 1080 },
        "source": { "file": "a.mp4", "width": 3840, "height": 2160, … },
        "orbit": { "spanDeg": 360, "direction": "cw" },
        "frames": { "count": 120, "width": 960, "height": 540, "fps": 12,
                    "indexStart": 0 }
      }]
    }

单个视频时 canvas 恒等于帧尺寸，rect 恒为 (0, 0, w, h)。
多个视频时 canvas 由 --canvas 指定，或按一行排布自动取包围盒；
每个视频的 rect 决定它画在画布上的位置与尺寸。
文件里没有视频轨，只有帧。
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile

from build import die, fit, probe

MAGIC = b"ORB3"
VERSION = 1
HEADER = struct.Struct("<4sIIIIIII")
INDEX = struct.Struct("<IIQ")          # video, length, offset
FORMAT = "orbit360.bundle"

CODECS = {
    "jpeg": ("image/jpeg", "jpg", "mjpeg"),
    "webp": ("image/webp", "webp", "libwebp"),
    "avif": ("image/avif", "avif", "libaom-av1"),
}
EXT_BY_MIME = {mime: ext for mime, ext, _ in CODECS.values()}


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
    out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"],
                         capture_output=True, text=True)
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
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-vf", vf,
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
        "version": VERSION,
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
         span_deg=360, direction="cw"):
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
    initial_angle = round(initial_angle % 360, 3)

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
                "orbit": {"spanDeg": span_deg, "direction": direction},
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
                          {"spanDeg": span_deg, "direction": direction}, vmetas)
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


def load(path):
    """只读 Header + Meta + Index（Range 请求所需的前 prefixLen 字节）。"""
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        head = fh.read(HEADER.size)
        if len(head) < HEADER.size or head[:4] != MAGIC:
            die("不是 .orb 场景包（magic 不是 ORB3）")
        magic, version, prefix, meta_len, index_len, count, entry_size, flags = \
            HEADER.unpack(head)
        if version != VERSION:
            die(f"不支持的版本: {version}")
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
    print(f"title: {meta.get('title', '')}  initialAngle: {meta.get('initialAngle')}°  "
          f"orbit: {meta.get('orbit', {}).get('direction')}")
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
        pack(args.out, args.videos, canvas=args.canvas, places=args.place,
             fps=args.fps, long_edge=args.long_edge, codec=args.codec,
             quality=args.quality, title=title, initial_angle=args.initial_angle,
             span_deg=args.orbit_span, direction=args.orbit_dir)
    elif args.cmd == "info":
        info(args.bundle, args.json)
    else:
        extract_frames_from_bundle(args.bundle, args.out, args.video)


if __name__ == "__main__":
    main()
