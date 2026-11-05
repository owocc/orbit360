/* orb.ts — ORB3 场景包解析（小程序 / 无 DOM 环境，无依赖）
 *
 *   const orb = OrbBundle.parse(arrayBuffer);         // 整文件 ArrayBuffer / 包内文件
 *   orb.meta                                          // JSON meta
 *   orb.frameEntry(videoIndex, frameIndex)            // { video, length, offset }
 *   orb.frameBytes(videoIndex, frameIndex)            // 该帧的 Uint8Array
 *   orb.frameDataUrl(videoIndex, frameIndex)          // 可直接赋给 Canvas Image 的 data URL
 *
 * 小程序没有 Blob / URL.createObjectURL，所以这里直接处理二进制与 base64。
 *
 * 头部 32B：magic "ORB3" / version / prefixLen / metaLen / indexLen /
 *           frameCount / indexEntrySize / flags（全部小端）
 * Index 每帧 16B：<IIQ> videoIndex, length, absoluteOffset
 */

export const MAGIC = [0x4f, 0x52, 0x42, 0x33]; // "ORB3"
export const HEADER_SIZE = 32;
export const ENTRY_SIZE = 16;
export const FORMAT = "orbit360.bundle";
// Header 版本 = major << 16 | minor；1.0 的旧文件写成裸整数 1。
export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 2;
export const VERSION = VERSION_MAJOR * 65536 + VERSION_MINOR;

export type OrbitAxis = "x" | "y";
export type OrbitDirection = "cw" | "ccw";

export interface OrbitMeta {
  axis?: OrbitAxis;
  spanDeg?: number;
  direction?: OrbitDirection;
  minAngle?: number;
  maxAngle?: number;
  [key: string]: unknown;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoFrames {
  count: number;
  width: number;
  height: number;
  fps: number;
  indexStart: number;
}

export interface VideoMeta {
  id: string;
  rect: Rect;
  source?: Record<string, unknown>;
  orbit?: OrbitMeta;
  frames: VideoFrames;
  [key: string]: unknown;
}

export interface BundleMeta {
  format: string;
  version: number;
  title?: string;
  canvas: { width: number; height: number };
  totalFrames: number;
  codec: string;
  initialAngle?: number;
  orbit?: OrbitMeta;
  videos: VideoMeta[];
  [key: string]: unknown;
}

export interface BundleHeader {
  version: number;
  prefixLen: number;
  metaLen: number;
  indexLen: number;
  frameCount: number;
  indexEntrySize: number;
  flags: number;
}

export type Entry = [video: number, length: number, offset: number];

export interface FrameEntry {
  video: number;
  length: number;
  offset: number;
}

export interface Bundle {
  header: BundleHeader;
  meta: BundleMeta;
  entries: Entry[];
  prefixLen: number;
  size: number;
  buffer: ArrayBuffer | null;
  frameEntry(videoIndex: number, frameIndex: number): FrameEntry;
  frameBytes(videoIndex: number, frameIndex: number): Uint8Array;
  frameDataUrl(videoIndex: number, frameIndex: number): string;
}

function fail(msg: string): never {
  throw new Error("ORB3: " + msg);
}

function versionText(raw: number): string {
  return raw === 1 ? "1.0" : `${raw >>> 16}.${raw & 0xffff}`;
}

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Math.floor(n) === n;
}

function decodeUtf8(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f),
      );
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
      const v = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    }
  }
  return out;
}

function parseHeader(buffer: ArrayBuffer): BundleHeader {
  if (buffer.byteLength < HEADER_SIZE) fail("头部不足 32 字节");
  const dv = new DataView(buffer);
  for (let i = 0; i < 4; i++) {
    if (dv.getUint8(i) !== MAGIC[i]) fail("magic 不是 ORB3");
  }
  const h: BundleHeader = {
    version: dv.getUint32(4, true),
    prefixLen: dv.getUint32(8, true),
    metaLen: dv.getUint32(12, true),
    indexLen: dv.getUint32(16, true),
    frameCount: dv.getUint32(20, true),
    indexEntrySize: dv.getUint32(24, true),
    flags: dv.getUint32(28, true),
  };
  if (h.version !== VERSION && h.version !== 0x00010001 && h.version !== 1) {
    fail(`不支持的版本 ${versionText(h.version)}（支持 1.0 / 1.1 / 1.2）`);
  }
  if (h.indexEntrySize !== ENTRY_SIZE) fail(`不支持的索引项大小 ${h.indexEntrySize}`);
  if (h.indexLen !== h.frameCount * ENTRY_SIZE) fail("indexLen 与 frameCount 不一致");
  if (h.prefixLen !== HEADER_SIZE + h.metaLen + h.indexLen) fail("prefixLen 不一致");
  if (h.frameCount <= 0) fail("frameCount 为 0");
  return h;
}

function parsePrefix(
  buffer: ArrayBuffer,
  h: BundleHeader,
  fileSize: number | null,
  strictEnd: boolean,
): { meta: BundleMeta; entries: Entry[] } {
  if (buffer.byteLength < h.prefixLen) fail("Header/Meta/Index 不完整");
  const dv = new DataView(buffer, 0, h.prefixLen);

  let meta: BundleMeta;
  try {
    meta = JSON.parse(decodeUtf8(new Uint8Array(buffer, HEADER_SIZE, h.metaLen)));
  } catch (err) {
    fail(`meta 不是合法 JSON: ${(err as Error).message}`);
  }
  if (!meta || meta.format !== FORMAT) fail(`meta.format 不是 ${FORMAT}`);
  const canvas = meta.canvas || ({} as BundleMeta["canvas"]);
  if (!isInt(canvas.width) || !isInt(canvas.height) || canvas.width <= 0 || canvas.height <= 0) {
    fail("meta 缺少合法的 canvas.width/height");
  }
  if (meta.totalFrames !== h.frameCount) fail("meta.totalFrames 与头部不一致");
  if (typeof meta.codec !== "string" || !meta.codec) fail("meta 缺少 codec");
  if (!Array.isArray(meta.videos) || !meta.videos.length) fail("meta 缺少 videos 数组");

  const sceneOrbit: OrbitMeta = meta.orbit || {};
  const sceneAxis = sceneOrbit.axis !== undefined ? sceneOrbit.axis : "x";
  if (sceneAxis !== "x" && sceneAxis !== "y") fail("meta.orbit.axis 只能是 x / y");
  const sceneMin = sceneOrbit.minAngle === undefined ? -180 : sceneOrbit.minAngle;
  const sceneMax = sceneOrbit.maxAngle === undefined ? 180 : sceneOrbit.maxAngle;
  if (
    typeof sceneMin !== "number" ||
    !Number.isFinite(sceneMin) ||
    typeof sceneMax !== "number" ||
    !Number.isFinite(sceneMax) ||
    sceneMin < -180 ||
    sceneMax > 180 ||
    sceneMin >= sceneMax
  ) {
    fail("meta.orbit.minAngle/maxAngle 必须在 -180..180 且 min < max");
  }

  let sum = 0;
  let expectStart = 0;
  for (let vi = 0; vi < meta.videos.length; vi++) {
    const v = meta.videos[vi];
    const f = v && v.frames;
    const r = v && v.rect;
    if (!v || !f || !r) fail(`视频 ${vi} 缺少 rect/frames`);
    const videoAxis = v.orbit?.axis !== undefined ? v.orbit.axis : sceneAxis;
    if (videoAxis !== "x" && videoAxis !== "y") fail(`视频 ${vi} 的 orbit.axis 只能是 x / y`);
    if (videoAxis !== sceneAxis) {
      fail(`视频 ${vi} 的轴 ${videoAxis} 与场景的 ${sceneAxis} 不一致`);
    }
    const vo = v.orbit || {};
    const videoMin = vo.minAngle === undefined ? sceneMin : vo.minAngle;
    const videoMax = vo.maxAngle === undefined ? sceneMax : vo.maxAngle;
    if (videoMin !== sceneMin || videoMax !== sceneMax) {
      fail(`视频 ${vi} 的角度限制与场景不一致`);
    }
    if (!isInt(f.count) || f.count <= 0) fail(`视频 ${vi} 的 frames.count 非法`);
    if (f.indexStart !== expectStart) fail(`视频 ${vi} 的 indexStart 不连续`);
    if (!isInt(r.x) || !isInt(r.y) || !isInt(r.width) || !isInt(r.height)) {
      fail(`视频 ${vi} 的 rect 不是整数`);
    }
    if (
      r.x < 0 ||
      r.y < 0 ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.x + r.width > canvas.width ||
      r.y + r.height > canvas.height
    ) {
      fail(`视频 ${vi} 的 rect 越界`);
    }
    expectStart += f.count;
    sum += f.count;
  }
  if (sum !== h.frameCount) fail("videos 帧数之和与 frameCount 不一致");

  const entries: Entry[] = Array.from({ length: h.frameCount });
  let expectedOff = h.prefixLen;
  let e = 0;
  for (let vi = 0; vi < meta.videos.length; vi++) {
    const count = meta.videos[vi].frames.count;
    for (let k = 0; k < count; k++) {
      const base = HEADER_SIZE + h.metaLen + e * ENTRY_SIZE;
      const ev = dv.getUint32(base, true);
      const len = dv.getUint32(base + 4, true);
      const lo = dv.getUint32(base + 8, true);
      const hi = dv.getUint32(base + 12, true);
      const off = hi * 4294967296 + lo;
      if (ev !== vi) fail(`第 ${e} 条索引的 video 编号不对`);
      if (!len || off !== expectedOff) fail(`第 ${e} 条索引偏移不连续`);
      if (fileSize != null && off + len > fileSize) fail(`第 ${e} 条索引越界`);
      entries[e] = [ev, len, off];
      expectedOff += len;
      e++;
    }
  }
  if (fileSize != null && strictEnd && expectedOff !== fileSize) {
    fail("索引与文件长度不一致（可能被截断）");
  }
  return { meta, entries };
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = "";
    }
  }
  const left = bytes.length - i;
  if (left === 1) {
    const n = bytes[i] << 16;
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + "==";
  } else if (left === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  parts.push(chunk);
  return parts.join("");
}

function makeResult(
  h: BundleHeader,
  meta: BundleMeta,
  entries: Entry[],
  size: number,
  buffer: ArrayBuffer | null,
): Bundle {
  function frameEntry(vi: number, fi: number): FrameEntry {
    const v = meta.videos[vi];
    if (!v) fail(`没有视频 ${vi}`);
    if (!isInt(fi) || fi < 0 || fi >= v.frames.count) fail(`视频 ${vi} 没有第 ${fi} 帧`);
    const e = entries[v.frames.indexStart + fi];
    return { video: e[0], length: e[1], offset: e[2] };
  }
  function frameBytes(vi: number, fi: number): Uint8Array {
    if (!buffer) fail("解析结果没有完整文件数据");
    const e = frameEntry(vi, fi);
    if (e.offset + e.length > buffer.byteLength) fail("帧数据超出文件长度（可能被截断）");
    return new Uint8Array(buffer, e.offset, e.length);
  }
  function frameDataUrl(vi: number, fi: number): string {
    const mime = typeof meta.codec === "string" && meta.codec ? meta.codec : "image/webp";
    return `data:${mime};base64,${bytesToBase64(frameBytes(vi, fi))}`;
  }
  return {
    header: h,
    meta,
    entries,
    prefixLen: h.prefixLen,
    size,
    buffer,
    frameEntry,
    frameBytes,
    frameDataUrl,
  };
}

export function parse(buffer: ArrayBuffer): Bundle {
  if (!buffer || typeof buffer.byteLength !== "number") fail("需要 ArrayBuffer");
  const h = parseHeader(buffer);
  if (buffer.byteLength < h.prefixLen) fail("Header/Meta/Index 不完整");
  const whole = buffer.byteLength > h.prefixLen;
  const parts = parsePrefix(buffer, h, whole ? buffer.byteLength : null, whole);
  return makeResult(h, parts.meta, parts.entries, buffer.byteLength, buffer);
}

const OrbBundle = {
  parse,
  HEADER_SIZE,
  ENTRY_SIZE,
  VERSION,
};

export default OrbBundle;
