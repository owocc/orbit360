#!/usr/bin/env python3
"""从一段环绕视频生成 orbit360 页面所需的全部资产。

    python3 scripts/build.py <视频> --out assets/<id> --title "标题" --catalog catalog.json

产物（写到 --out）：
    meta.json            包外副本，供 catalog 读取 defaults
    packs/std.zip        雪碧图档（长边 --std，默认 512）
    packs/hd.zip         雪碧图档（长边 --hd，默认 640）
    packs/uhd.zip        序列帧档（长边 --uhd，默认 1920，帧数减半；--uhd 0 关掉）

只想要帧不打包：--frames-only --frames-dir DIR
构建时保留中间产物：--keep-raw → frames-<档>/ 与 atlas-<档>/

需要 ffmpeg / ffprobe 在 PATH 中。
"""
import argparse
import json
import os
import shutil
import statistics
import struct
import subprocess
import sys
import tempfile
import zipfile

THUMB_W, THUMB_H = 32, 18
THUMB_SIZE = THUMB_W * THUMB_H


def die(msg):
    print(f"错误: {msg}", file=sys.stderr)
    sys.exit(1)


def have(binary):
    return shutil.which(binary) is not None


def probe(path):
    if not have("ffprobe"):
        die("找不到 ffprobe，请先安装 ffmpeg")
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", path],
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


def thumbs(path):
    """解出每帧 32x18 灰度，用于估算环绕闭合度。"""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path,
         "-vf", f"scale={THUMB_W}:{THUMB_H}:flags=area,format=gray",
         "-f", "rawvideo", "-"],
        capture_output=True, check=True,
    )
    raw = proc.stdout
    return [raw[i * THUMB_SIZE:(i + 1) * THUMB_SIZE] for i in range(len(raw) // THUMB_SIZE)]


def _stats(frames):
    means = [sum(f) / THUMB_SIZE for f in frames]
    devs = []
    for f, m in zip(frames, means):
        devs.append((sum((x - m) ** 2 for x in f) / THUMB_SIZE) ** 0.5)
    return means, devs


def zncc(a, b, ma, mb, da, db):
    if da == 0 or db == 0:
        return 0.0
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (da * db * THUMB_SIZE)


def loop_quality(frames):
    """首尾帧相似度 + 相邻帧相似度中位数。"""
    if len(frames) < 2:
        return None, None
    means, devs = _stats(frames)
    adj = [zncc(frames[i], frames[i + 1], means[i], means[i + 1], devs[i], devs[i + 1])
           for i in range(len(frames) - 1)]
    seam = zncc(frames[0], frames[-1], means[0], means[-1], devs[0], devs[-1])
    return round(seam, 3), round(statistics.median(adj), 3)


def fit(w, h, long_edge):
    """等比缩放到长边 = long_edge，取偶数。"""
    scale = long_edge / max(w, h)
    return max(2, int(round(w * scale / 2)) * 2), max(2, int(round(h * scale / 2)) * 2)


def extract(src, out_dir, width, height, fps, quality, count):
    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        if name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            os.remove(os.path.join(out_dir, name))
    vf = f"fps={fps},scale={width}:{height}:flags=lanczos"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-vf", vf,
         "-q:v", str(quality), "-start_number", "1",
         os.path.join(out_dir, "f%03d.jpg")],
        check=True,
    )
    files = sorted(n for n in os.listdir(out_dir) if n.endswith(".jpg"))
    if len(files) != count:
        print(f"警告: 期望 {count} 帧，实际 {len(files)} 帧（{out_dir}）", file=sys.stderr)
    return len(files)


def load_ui_defaults(path):
    """沿用旧 config 里的手感参数，避免每次重建都把调过的值冲掉。"""
    defaults = {
        "title": "环绕视角",
        "orbit": {"spanDeg": 360, "direction": "cw"},
        "drag": {"degPerPx": 0.42, "invert": False, "inertiaMs": 110, "inertia": True},
        "motion": {"smoothMs": 45},
        "auto": {"enabled": False, "dir": "cw", "degPerSec": 14, "idleDelayMs": 2200,
                 "rampInMs": 700, "rampOutMs": 280},
        "gyro": {"gain": 1.0, "invert": False, "smooth": True, "smoothMs": 80},
        "mouseFollow": {"enabled": True, "degPerPx": 0.3},
        "video": {"displayScale": 1, "portraitScale": 1.25, "fit": "contain"},
        "defaults": {},
    }
    if not os.path.exists(path):
        alt = os.path.join(os.path.dirname(os.path.abspath(path)), "config.json")
        if os.path.exists(alt):
            path = alt
    if not os.path.exists(path):
        return defaults
    try:
        old = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return defaults
    for key in ("title", "orbit", "drag", "motion", "auto", "gyro", "mouseFollow", "video", "defaults"):
        if key in old:
            if isinstance(defaults.get(key), dict) and isinstance(old[key], dict):
                defaults.setdefault(key, {}).update(old[key])
            else:
                defaults[key] = old[key]
    return defaults


def make_atlas(frame_dir, atlas_dir, cols, rows, frame_w, frame_h, count, quality):
    """把序列帧拼成若干张雪碧图：移动端只用少数几块 GPU 纹理，避免逐帧换纹理造成闪动。"""
    os.makedirs(atlas_dir, exist_ok=True)
    for name in os.listdir(atlas_dir):
        if name.lower().endswith(".jpg"):
            os.remove(os.path.join(atlas_dir, name))
    per = cols * rows
    sheets = 0
    for start in range(0, count, per):
        sheets += 1
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y",
             "-start_number", str(start + 1),
             "-i", os.path.join(frame_dir, "f%03d.jpg"),
             "-vf", f"tile={cols}x{rows}:padding=0:margin=0",
             "-frames:v", "1", "-q:v", str(quality),
             os.path.join(atlas_dir, f"sheet{sheets:02d}.jpg")],
            check=True,
        )
    sheet_w, sheet_h = cols * frame_w, rows * frame_h
    if sheet_w > 4096 or sheet_h > 4096:
        print(f"警告: 雪碧图 {sheet_w}x{sheet_h} 超过 iOS 纹理上限 4096", file=sys.stderr)
    return sheets, sheet_w, sheet_h


def write_pack(path, meta, entries):
    """写一个 ZIP_STORED 包：meta.json + 图片。不压缩，浏览器端无需 inflate。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as zf:
        zf.writestr("meta.json", json.dumps(meta, ensure_ascii=False, indent=2).encode("utf-8"))
        for arc, fp in entries:
            zf.write(fp, arc)
    return os.path.getsize(path)


def build_atlas_pack(src, out_zip, quality_tag, long_edge, fps, jpeg_q, count, base_meta,
                     cols=6, rows=10, frames_out=None, atlas_out=None):
    """frames_out / atlas_out 给定时中间产物留在该目录（--keep-raw），否则随临时目录删掉。"""
    tmp = tempfile.mkdtemp(prefix="orbit-atlas-")
    try:
        frames_dir = frames_out or os.path.join(tmp, "frames")
        atlas_dir = atlas_out or os.path.join(tmp, "atlas")
        fw, fh = fit(base_meta["source"]["width"], base_meta["source"]["height"], long_edge)
        n = extract(src, frames_dir, fw, fh, fps, jpeg_q, count)
        sheets, sw, sh = make_atlas(frames_dir, atlas_dir, cols, rows, fw, fh, n, jpeg_q)
        entries = [(f"sheet{i:02d}.jpg", os.path.join(atlas_dir, f"sheet{i:02d}.jpg"))
                   for i in range(1, sheets + 1)]
        meta = dict(base_meta)
        meta["quality"] = quality_tag
        meta["pack"] = {
            "type": "atlas", "count": n, "cols": cols, "rows": rows,
            "frameW": fw, "frameH": fh, "pattern": "sheet%02d.jpg", "start": 1,
            "files": [e[0] for e in entries],
        }
        size = write_pack(out_zip, meta, entries)
        return meta["pack"], size, (sw, sh)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def build_sequence_pack(src, out_zip, quality_tag, long_edge, fps, jpeg_q, count, base_meta,
                        frames_out=None):
    tmp = tempfile.mkdtemp(prefix="orbit-seq-")
    try:
        fw, fh = fit(base_meta["source"]["width"], base_meta["source"]["height"], long_edge)
        frames_dir = frames_out or os.path.join(tmp, "frames")
        n = extract(src, frames_dir, fw, fh, fps, jpeg_q, count)
        names = sorted(x for x in os.listdir(frames_dir) if x.endswith(".jpg"))
        entries = [(name, os.path.join(frames_dir, name)) for name in names]
        meta = dict(base_meta)
        meta["quality"] = quality_tag
        meta["pack"] = {
            "type": "sequence", "count": n,
            "frameW": fw, "frameH": fh, "pattern": "f%03d.jpg", "start": 1,
            "files": [e[0] for e in entries],
        }
        size = write_pack(out_zip, meta, entries)
        return meta["pack"], size, None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def source_ref(src, out):
    """meta.source.file 用相对 --out 的路径；源视频离得远时退回文件名，别塞一串 ../../..。"""
    rel = os.path.relpath(src, out).replace(os.sep, "/")
    return os.path.basename(src) if rel.count("..") > 2 else rel


def read_orb_meta(path):
    """从 .orb 头部读 meta；文件不存在或格式不对时返回 None。"""
    try:
        with open(path, "rb") as fh:
            head = fh.read(32)
            if len(head) < 32 or head[:4] != b"ORB3":
                return None
            meta_len = struct.unpack_from("<I", head, 12)[0]
            if meta_len <= 0:
                return None
            return json.loads(fh.read(meta_len).decode("utf-8"))
    except (OSError, ValueError, UnicodeDecodeError):
        return None


def write_catalog(root, path, default_id=None):
    """扫描 root 下的 <id>/scene.orb 与 <id>/meta.json，生成页面示例清单。

    发布示例只要求 scene.orb；zip 字段仅在旧版 packs 存在时保留。
    """
    base = os.path.dirname(os.path.abspath(path))
    existing = {}
    old_default = None
    try:
        old = json.load(open(path, encoding="utf-8"))
        old_default = old.get("default")
        existing = {i.get("id"): i for i in old.get("items", []) if isinstance(i, dict)}
    except (OSError, ValueError):
        pass

    items = []
    for name in sorted(os.listdir(root)):
        item_dir = os.path.join(root, name)
        if not os.path.isdir(item_dir):
            continue
        old_item = existing.get(name, {})
        meta = {}
        try:
            meta = json.load(open(os.path.join(item_dir, "meta.json"), encoding="utf-8"))
        except (OSError, ValueError):
            pass
        orb = os.path.join(item_dir, "scene.orb")
        orb_meta = read_orb_meta(orb)
        if not meta and orb_meta:
            meta = orb_meta

        packs = {}
        for q in ("std", "hd", "uhd"):
            p = os.path.join(item_dir, "packs", f"{q}.zip")
            if os.path.isfile(p):
                packs[q] = os.path.relpath(p, base).replace(os.sep, "/")
        if not packs and not orb_meta:
            continue

        source = meta.get("source") or {}
        if not source and orb_meta:
            videos = orb_meta.get("videos") or []
            if videos:
                source = videos[0].get("source") or {}
        defaults = meta.get("defaults") or old_item.get("defaults")

        item = {"id": name, "title": meta.get("title") or old_item.get("title") or name}
        if orb_meta:
            item["orb"] = os.path.relpath(orb, base).replace(os.sep, "/")
        if defaults:
            item["defaults"] = defaults
        if source:
            item["source"] = {k: source.get(k) for k in ("width", "height", "frames", "durationSec")}
        if packs:
            item["packs"] = packs
        items.append(item)
    if not items:
        die(f"{root} 下没有可用的示例资产")
    ids = [i["id"] for i in items]
    default = default_id if default_id in ids else (old_default if old_default in ids else ids[0])
    doc = {"default": default, "items": items}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"清单: {path}（{len(items)} 个示例: {', '.join(ids)}）")
    return doc


def main():
    ap = argparse.ArgumentParser(description="环绕视频 → orbit360 资源包")
    ap.add_argument("video", help="源视频路径")
    ap.add_argument("--out", default=os.path.dirname(os.path.abspath(__file__)),
                    help="输出目录（默认脚本所在目录）")
    ap.add_argument("--fps", type=float, default=12.0, help="标准/高清档采样帧率（默认 12）")
    ap.add_argument("--std", type=int, default=512, help="标准档长边（默认 512）")
    ap.add_argument("--hd", type=int, default=640, help="高清档长边（默认 640）")
    ap.add_argument("--uhd", type=int, default=1920, help="超清档长边（默认 1920，帧数减半）")
    ap.add_argument("--quality", type=int, default=6, help="JPEG 质量 2-31，越小越清晰（默认 6）")
    ap.add_argument("--title", help="示例标题，写入 meta.title")
    ap.add_argument("--default-quality", default="uhd",
                    help="meta.defaults.quality，页面默认画质（默认 uhd）")
    ap.add_argument("--default-auto", choices=["off", "cw", "ccw"], default="cw",
                    help="meta.defaults.auto.dir，打开后的自动旋转方向（默认 cw）")
    ap.add_argument("--catalog", help="构建后生成示例清单，例如 catalog.json")
    ap.add_argument("--assets-root", default=None,
                    help="示例资产根目录（默认取 --out 的父目录）")
    ap.add_argument("--keep-raw", action="store_true",
                    help="把中间帧留在 out/frames-<档>、雪碧图留在 out/atlas-<档>")
    ap.add_argument("--frames-dir", default=None,
                    help="配合 --frames-only：只抽帧到这个目录，不打包")
    ap.add_argument("--frames-only", action="store_true",
                    help="只抽帧不生成 zip（长边/帧率取 --std/--fps）")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        die(f"找不到文件: {args.video}")
    for tool in ("ffmpeg", "ffprobe"):
        if not have(tool):
            die(f"找不到 {tool}，请先安装 ffmpeg")

    src = os.path.abspath(args.video)
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    meta = probe(src)
    fps = args.fps if meta["fps"] >= args.fps else meta["fps"]
    count = max(1, int(round(meta["durationSec"] * fps)))

    print(f"源: {os.path.basename(src)}  {meta['width']}x{meta['height']}  "
          f"{meta['fps']}fps  {meta['frames']}帧  {meta['durationSec']}s  {meta['codec']}")
    seam, adjacent = loop_quality(thumbs(src))
    print(f"闭环: 首尾相似度 {seam}（相邻帧 {adjacent}）"
          + ("" if seam is not None and adjacent is not None and seam >= adjacent - 0.12
             else "  ⚠ 首尾不闭合，环回会有一次跳变"))

    if args.frames_only:
        fw, fh = fit(meta["width"], meta["height"], args.std)
        frames_dir = args.frames_dir or os.path.join(out, "frames")
        n = extract(src, frames_dir, fw, fh, fps, min(31, args.quality + 1), count)
        print(f"帧: {frames_dir}  {fw}x{fh} × {n} 帧  {360 / max(1, n):.2f}°/帧")
        return

    meta_path = os.path.join(out, "meta.json")
    ui = load_ui_defaults(meta_path)
    if args.title:
        ui["title"] = args.title

    base_meta = {
        "title": ui["title"],
        "source": {
            "file": source_ref(src, out),
            "width": meta["width"],
            "height": meta["height"],
            "fps": meta["fps"],
            "frames": meta["frames"],
            "durationSec": meta["durationSec"],
            "codec": meta["codec"],
            "bitRate": meta["bitRate"],
            "loopSimilarity": seam,
        },
        "orbit": ui["orbit"],
        "video": ui["video"],
        "drag": ui["drag"],
        "motion": ui["motion"],
        "auto": ui["auto"],
        "gyro": ui["gyro"],
        "mouseFollow": ui["mouseFollow"],
        "defaults": {
            "quality": args.default_quality,
            "auto": {"enabled": args.default_auto != "off", "dir": "ccw" if args.default_auto == "ccw" else "cw"},
        },
    }
    if meta["audio"]:
        base_meta["source"]["audio"] = meta["audio"]
    if seam is not None:
        base_meta["source"]["sampledEveryNthFrame"] = int(round(meta["fps"] / fps)) if fps else 1

    packs_dir = os.path.join(out, "packs")
    built = {}
    keep = args.keep_raw

    spec_std, size_std, _ = build_atlas_pack(
        src, os.path.join(packs_dir, "std.zip"), "std", args.std, fps,
        min(31, args.quality + 1), count, base_meta,
        frames_out=os.path.join(out, "frames-std") if keep else None,
        atlas_out=os.path.join(out, "atlas-std") if keep else None)
    built["std"] = (spec_std, size_std)

    spec_hd, size_hd, _ = build_atlas_pack(
        src, os.path.join(packs_dir, "hd.zip"), "hd", args.hd, fps,
        min(31, args.quality + 1), count, base_meta,
        frames_out=os.path.join(out, "frames-hd") if keep else None,
        atlas_out=os.path.join(out, "atlas-hd") if keep else None)
    built["hd"] = (spec_hd, size_hd)

    if args.uhd:
        spec_uhd, size_uhd, _ = build_sequence_pack(
            src, os.path.join(packs_dir, "uhd.zip"), "uhd", args.uhd,
            max(fps / 2, 1), args.quality, max(1, count // 2), base_meta,
            frames_out=os.path.join(out, "frames-uhd") if keep else None)
        built["uhd"] = (spec_uhd, size_uhd)

    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(base_meta, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    if args.catalog:
        root = args.assets_root or os.path.dirname(out.rstrip(os.sep))
        write_catalog(root, args.catalog, os.path.basename(out.rstrip(os.sep)))

    for q, (spec, size) in built.items():
        print(f"  {q:>4}: {spec['frameW']}x{spec['frameH']} × {spec['count']} 帧  "
              f"{spec['type']:8}  {size/1024/1024:.1f} MB  packs/{q}.zip")
    if keep:
        print(f"原始帧: {out}/frames-<std|hd|uhd>   雪碧图: {out}/atlas-<std|hd>")
    print(f"meta: {meta_path}")
    print(f"角度: {360 / max(1, built['std'][0]['count']):.2f}°/帧（标准档）")
    print("启动: python3 scripts/serve.py 8787    或    python3 scripts/serve_tls.py 8443（手机陀螺仪）")


if __name__ == "__main__":
    main()
