#!/usr/bin/env python3
"""从一段环绕视频生成 orbit360 页面所需的全部资产。

    python3 build.py ../Camera_orbiting_frozen_subject_xxx.mp4

产物（默认写到本脚本所在目录）：
    source.mp4        原始视频副本
    frames/           桌面帧集（长边 800）
    frames-small/     移动帧集（长边 512）
    config.json       源视频 meta + 环绕/手感配置

需要 ffmpeg / ffprobe 在 PATH 中。
"""
import argparse
import json
import os
import shutil
import statistics
import subprocess
import sys

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
    }
    if not os.path.exists(path):
        return defaults
    try:
        old = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return defaults
    for key in ("title", "orbit", "drag", "motion", "auto", "gyro", "mouseFollow", "video"):
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


def write_catalog(root, path, default_id=None):
    """扫描 root 下的 <id>/config.json，生成页面用的示例清单。"""
    base = os.path.dirname(os.path.abspath(path))
    items = []
    for name in sorted(os.listdir(root)):
        cfg_path = os.path.join(root, name, "config.json")
        if not os.path.isfile(cfg_path):
            continue
        try:
            cfg = json.load(open(cfg_path, encoding="utf-8"))
        except (OSError, ValueError):
            continue
        items.append({
            "id": name,
            "title": cfg.get("title", name),
            "dir": os.path.relpath(os.path.join(root, name), base).replace(os.sep, "/") + "/",
            "frames": cfg.get("frames", {}).get("count"),
        })
    if not items:
        die(f"{root} 下没有可用的示例配置")
    ids = [i["id"] for i in items]
    doc = {"default": default_id if default_id in ids else ids[0], "items": items}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"清单: {path}（{len(items)} 个示例: {', '.join(ids)}）")
    return doc


def main():
    ap = argparse.ArgumentParser(description="环绕视频 → orbit360 资产")
    ap.add_argument("video", help="源视频路径")
    ap.add_argument("--out", default=os.path.dirname(os.path.abspath(__file__)),
                    help="输出目录（默认脚本所在目录）")
    ap.add_argument("--fps", type=float, default=12.0, help="采样帧率（默认 12）")
    ap.add_argument("--desktop", type=int, default=1280, help="桌面帧长边（默认 1280）")
    ap.add_argument("--mobile", type=int, default=512, help="移动帧长边（默认 512）")
    ap.add_argument("--mobile-hd", type=int, default=640,
                    help="移动端高清档长边（默认 640，设 0 则不生成）")
    ap.add_argument("--desktop-hd", type=int, default=1920,
                    help="桌面超清档长边（默认 1920，帧数减半；设 0 则不生成）")
    ap.add_argument("--quality", type=int, default=6, help="JPEG 质量 2-31，越小越清晰（默认 6）")
    ap.add_argument("--title", help="示例标题，写入 config.title")
    ap.add_argument("--catalog", help="构建后生成示例清单，例如 catalog.json")
    ap.add_argument("--assets-root", default=None,
                    help="示例资产根目录（默认取 --out 的父目录）")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        die(f"找不到文件: {args.video}")
    if not have("ffmpeg"):
        die("找不到 ffmpeg，请先安装")

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

    dw, dh = fit(meta["width"], meta["height"], args.desktop)
    mw, mh = fit(meta["width"], meta["height"], args.mobile)
    hw, hh = (fit(meta["width"], meta["height"], args.mobile_hd)
              if args.mobile_hd else (0, 0))
    uw, uh = (fit(meta["width"], meta["height"], args.desktop_hd)
              if args.desktop_hd else (0, 0))

    n_desktop = extract(src, os.path.join(out, "frames"), dw, dh, fps, args.quality, count)
    # 桌面超清档：分辨率翻倍、帧数减半，解压内存与标准档相近（约 500 MB）
    n_desktop_hd = 0
    if uw:
        n_desktop_hd = extract(src, os.path.join(out, "frames-hd"), uw, uh,
                               max(fps / 2, 1), args.quality, max(1, count // 2))
    n_mobile = extract(src, os.path.join(out, "frames-small"), mw, mh, fps,
                       min(31, args.quality + 1), count)
    # 移动端雪碧图：6 列 × 10 行，512×288 时单张 3072×2880，正好在 iOS 纹理上限内
    cols, rows = 6, 10
    sheets, sw, sh = make_atlas(os.path.join(out, "frames-small"), os.path.join(out, "atlas"),
                                cols, rows, mw, mh, n_mobile, min(31, args.quality + 1))
    # 高清档只保留雪碧图（序列帧是中间产物，用完即删，避免仓库翻倍）
    hd_sheets = 0
    if hw:
        tmp = os.path.join(out, ".hd-tmp")
        n_hd = extract(src, tmp, hw, hh, fps, args.quality, count)
        hd_sheets, hd_sw, hd_sh = make_atlas(tmp, os.path.join(out, "atlas-hd"),
                                             cols, rows, hw, hh, n_hd, args.quality)
        shutil.rmtree(tmp, ignore_errors=True)

    cfg_path = os.path.join(out, "config.json")
    ui = load_ui_defaults(cfg_path)
    if args.title:
        ui["title"] = args.title
    cfg = {
        "title": ui["title"],
        "source": {
            "file": os.path.relpath(src, out),
            "width": meta["width"],
            "height": meta["height"],
            "fps": meta["fps"],
            "frames": meta["frames"],
            "durationSec": meta["durationSec"],
            "codec": meta["codec"],
            "bitRate": meta["bitRate"],
            "loopSimilarity": seam,
            "sampledEveryNthFrame": int(round(meta["fps"] / fps)) if fps else 1,
        },
        "video": {
            **ui["video"],
            "width": dw,          # 帧尺寸跟着本次抽帧走，不能沿用旧配置
            "height": dh,
        },
        "orbit": {
            **ui["orbit"],
            "spanDeg": ui["orbit"].get("spanDeg", 360),
        },
        "frames": {
            "count": n_desktop,
            "desktop": {
                "type": "sequence",
                "dir": "frames/",
                "pattern": "f%03d.jpg",
                "start": 1,
            },
            "mobile": {
                "type": "atlas",
                "dir": "frames-small/",
                "pattern": "f%03d.jpg",
                "start": 1,
                "atlasDir": "atlas/",
                "atlasPattern": "sheet%02d.jpg",
                "atlasCount": sheets,
                "cols": cols,
                "rows": rows,
                "frameW": mw,
                "frameH": mh,
            },
            "mobileMaxScreenPx": 1100,
            **({
                "desktopHd": {
                    "type": "sequence",
                    "dir": "frames-hd/",
                    "pattern": "f%03d.jpg",
                    "start": 1,
                    "count": n_desktop_hd,
                }
            } if n_desktop_hd else {}),
            **({
                "mobileHd": {
                    "type": "atlas",
                    "dir": "atlas-hd/",
                    "atlasDir": "atlas-hd/",
                    "atlasPattern": "sheet%02d.jpg",
                    "atlasCount": hd_sheets,
                    "cols": cols,
                    "rows": rows,
                    "frameW": hw,
                    "frameH": hh,
                }
            } if hd_sheets else {}),
        },
        "drag": ui["drag"],
        "motion": ui["motion"],
        "auto": ui["auto"],
        "gyro": ui["gyro"],
        "mouseFollow": ui["mouseFollow"],
    }
    if meta["audio"]:
        cfg["source"]["audio"] = meta["audio"]

    with open(cfg_path, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"帧集: 桌面 {dw}x{dh} × {n_desktop}  (frames/)   "
          f"移动 {mw}x{mh} × {n_mobile}  (frames-small/)")
    print(f"雪碧图: {sheets} 张 {sw}x{sh}（atlas/）")
    if hd_sheets:
        print(f"高清雪碧图: {hd_sheets} 张 {hd_sw}x{hd_sh}（atlas-hd/，{hw}x{hh}）")
    if n_desktop_hd:
        print(f"桌面超清: {uw}x{uh} × {n_desktop_hd} 帧（frames-hd/，{360/max(1,n_desktop_hd):.1f}°/帧）")
    print(f"角度: {360 / max(1, n_desktop):.2f}°/帧   spanDeg={cfg['orbit']['spanDeg']}")
    print(f"配置: {cfg_path}")
    if args.catalog:
        root = args.assets_root or os.path.dirname(out.rstrip(os.sep))
        write_catalog(root, args.catalog, os.path.basename(out.rstrip(os.sep)))
    print("启动: python3 serve.py 8787    或    python3 serve_tls.py 8443（手机陀螺仪）")


if __name__ == "__main__":
    main()
