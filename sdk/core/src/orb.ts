import { fail } from "./errors";

export const MAGIC = [0x4f, 0x52, 0x42, 0x33] as const; // "ORB3"
export const HEADER_SIZE = 32;
export const ENTRY_SIZE = 16;
export const FORMAT = "orbit360.bundle";
export const VERSION = 0x00010002; // 1.2
export const META_VERSION = 1.2;
export const MAX_SAFE = Number.MAX_SAFE_INTEGER;

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
  width?: number;
  height?: number;
  fps?: number;
  indexStart: number;
  [key: string]: unknown;
}

export interface VideoMeta {
  id?: string;
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

export interface FrameEntry {
  video: number;
  length: number;
  offset: number;
}

export interface VideoLayer {
  videoIndex: number;
  rect: Rect;
  frameCount: number;
  indexStart: number;
}

export interface Bundle {
  header: BundleHeader;
  meta: BundleMeta;
  entries: FrameEntry[];
  layers: VideoLayer[];
  size: number;
  sceneConfig: Record<string, unknown>;
  frameEntry(videoIndex: number, frameIndex: number): FrameEntry;
  frameBytes(videoIndex: number, frameIndex: number): Uint8Array;
}

export interface NormalizedOrbit {
  axis: OrbitAxis;
  direction: OrbitDirection;
  spanDeg: number;
  minAngle: number;
  maxAngle: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.floor(value) === value;
}

function decodeUtf8(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b < 0xe0) {
      if (i >= bytes.length) fail("ORB_INVALID_META_JSON", "截断的 UTF-8");
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b < 0xf0) {
      if (i + 1 >= bytes.length) fail("ORB_INVALID_META_JSON", "截断的 UTF-8");
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f),
      );
    } else {
      if (i + 2 >= bytes.length) fail("ORB_INVALID_META_JSON", "截断的 UTF-8");
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

function normalizeOrbit(raw: unknown, where: string): NormalizedOrbit {
  if (raw === undefined || raw === null) raw = {};
  if (!isObject(raw)) fail("ORB_INVALID_ORBIT", `${where} 不是对象`);
  const axis = raw.axis === undefined ? "x" : raw.axis;
  if (axis !== "x" && axis !== "y") fail("ORB_INVALID_AXIS", `${where}.axis 非法`);
  const direction = raw.direction === undefined ? "cw" : raw.direction;
  if (direction !== "cw" && direction !== "ccw") {
    fail("ORB_INVALID_DIRECTION", `${where}.direction 非法`);
  }
  const spanDeg = raw.spanDeg === undefined ? 360 : raw.spanDeg;
  if (typeof spanDeg !== "number" || !Number.isFinite(spanDeg) || spanDeg <= 0 || spanDeg > 360) {
    fail("ORB_INVALID_SPAN", `${where}.spanDeg 非法`);
  }
  const minAngle = raw.minAngle === undefined ? -180 : raw.minAngle;
  const maxAngle = raw.maxAngle === undefined ? 180 : raw.maxAngle;
  if (
    typeof minAngle !== "number" ||
    !Number.isFinite(minAngle) ||
    typeof maxAngle !== "number" ||
    !Number.isFinite(maxAngle) ||
    minAngle < -180 ||
    maxAngle > 180 ||
    minAngle >= maxAngle
  ) {
    fail("ORB_INVALID_ANGLE_RANGE", `${where}.minAngle/maxAngle 非法`);
  }
  return { axis, direction, spanDeg, minAngle, maxAngle };
}

function sceneConfigFromMeta(meta: BundleMeta): Record<string, unknown> {
  const keys = [
    "title",
    "video",
    "orbit",
    "drag",
    "motion",
    "auto",
    "gyro",
    "mouseFollow",
    "defaults",
    "quality",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (meta[key] !== undefined) out[key] = meta[key];
  }
  return out;
}

function toBytes(input: ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  fail("ORB_INVALID_ARGUMENT", "parse 需要 ArrayBuffer / Uint8Array");
}

export function parse(input: ArrayBuffer | ArrayBufferView | Uint8Array): Bundle {
  const bytes = toBytes(input);
  const size = bytes.length;
  if (size < HEADER_SIZE) fail("ORB_TRUNCATED_HEADER", "头部不足 32 字节");
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) fail("ORB_INVALID_MAGIC", "magic 不是 ORB3");
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header: BundleHeader = {
    version: dv.getUint32(4, true),
    prefixLen: dv.getUint32(8, true),
    metaLen: dv.getUint32(12, true),
    indexLen: dv.getUint32(16, true),
    frameCount: dv.getUint32(20, true),
    indexEntrySize: dv.getUint32(24, true),
    flags: dv.getUint32(28, true),
  };
  if (header.version !== VERSION) {
    fail(
      "ORB_UNSUPPORTED_VERSION",
      `不支持的版本 ${header.version >>> 16}.${header.version & 0xffff}`,
      4,
    );
  }
  if (header.indexEntrySize !== ENTRY_SIZE) {
    fail("ORB_INVALID_INDEX_ENTRY_SIZE", "不支持的索引项大小", 24);
  }
  if (header.frameCount <= 0) fail("ORB_INVALID_FRAME_COUNT", "frameCount 为 0", 20);
  if (header.indexLen !== header.frameCount * ENTRY_SIZE) {
    fail("ORB_INVALID_INDEX_LENGTH", "indexLen 与 frameCount 不一致", 16);
  }
  if (header.prefixLen !== HEADER_SIZE + header.metaLen + header.indexLen) {
    fail("ORB_INVALID_PREFIX_LENGTH", "prefixLen 不一致", 8);
  }
  if (size < header.prefixLen) fail("ORB_TRUNCATED_PREFIX", "Header/Meta/Index 不完整");

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(bytes.subarray(HEADER_SIZE, HEADER_SIZE + header.metaLen)));
  } catch (err) {
    fail("ORB_INVALID_META_JSON", `meta 不是合法 JSON: ${(err as Error).message}`);
  }
  if (!isObject(parsed)) fail("ORB_INVALID_META", "meta 不是对象");
  const meta = parsed as BundleMeta;
  if (meta.format !== FORMAT) fail("ORB_INVALID_FORMAT", "meta.format 非法");
  if (meta.version !== META_VERSION) fail("ORB_INVALID_META_VERSION", "meta.version 非法");
  const canvas = isObject(meta.canvas) ? meta.canvas : null;
  if (
    !canvas ||
    !isInt(canvas.width) ||
    !isInt(canvas.height) ||
    canvas.width <= 0 ||
    canvas.height <= 0
  ) {
    fail("ORB_INVALID_CANVAS", "meta 缺少合法的 canvas");
  }
  if (meta.totalFrames !== header.frameCount) {
    fail("ORB_FRAME_COUNT_MISMATCH", "meta.totalFrames 与头部不一致");
  }
  if (typeof meta.codec !== "string" || !meta.codec) fail("ORB_INVALID_CODEC", "meta 缺少 codec");
  if (!Array.isArray(meta.videos) || !meta.videos.length) {
    fail("ORB_INVALID_VIDEOS", "meta 缺少 videos 数组");
  }

  const sceneOrbit = normalizeOrbit(meta.orbit, "meta.orbit");
  const layers: VideoLayer[] = [];
  let sum = 0;
  let expectStart = 0;

  for (let vi = 0; vi < meta.videos.length; vi++) {
    const video = meta.videos[vi];
    if (!isObject(video) || !isObject(video.frames) || !isObject(video.rect)) {
      fail("ORB_INVALID_VIDEOS", `视频 ${vi} 缺少 rect/frames`);
    }
    const frames = video.frames as unknown as VideoFrames;
    const rect = video.rect as unknown as Rect;
    if (!isInt(frames.count) || frames.count <= 0) {
      fail("ORB_INVALID_FRAME_COUNT", `视频 ${vi} 的 frames.count 非法`);
    }
    if (frames.indexStart !== expectStart) {
      fail("ORB_INVALID_INDEX_START", `视频 ${vi} 的 indexStart 不连续`);
    }
    const videoOrbit = normalizeOrbit(video.orbit, `视频 ${vi} 的 orbit`);
    if (
      videoOrbit.axis !== sceneOrbit.axis ||
      videoOrbit.direction !== sceneOrbit.direction ||
      videoOrbit.spanDeg !== sceneOrbit.spanDeg ||
      videoOrbit.minAngle !== sceneOrbit.minAngle ||
      videoOrbit.maxAngle !== sceneOrbit.maxAngle
    ) {
      fail("ORB_INVALID_VIDEO_ORBIT", `视频 ${vi} 的 orbit 与场景不一致`);
    }
    if (!isInt(rect.x) || !isInt(rect.y) || !isInt(rect.width) || !isInt(rect.height)) {
      fail("ORB_INVALID_RECT", `视频 ${vi} 的 rect 不是整数`);
    }
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.x + rect.width > canvas.width ||
      rect.y + rect.height > canvas.height
    ) {
      fail("ORB_INVALID_RECT", `视频 ${vi} 的 rect 越界`);
    }
    layers.push({
      videoIndex: vi,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      frameCount: frames.count,
      indexStart: frames.indexStart,
    });
    expectStart += frames.count;
    sum += frames.count;
  }
  if (sum !== header.frameCount) {
    fail("ORB_FRAME_COUNT_MISMATCH", "videos 帧数之和与 frameCount 不一致");
  }

  const entries: FrameEntry[] = [];
  let expectedOff = header.prefixLen;
  let e = 0;
  for (let vi = 0; vi < layers.length; vi++) {
    const count = layers[vi].frameCount;
    for (let k = 0; k < count; k++) {
      const base = HEADER_SIZE + header.metaLen + e * ENTRY_SIZE;
      const video = dv.getUint32(base, true);
      const length = dv.getUint32(base + 4, true);
      const lo = dv.getUint32(base + 8, true);
      const hi = dv.getUint32(base + 12, true);
      const offset = hi * 4294967296 + lo;
      if (offset > MAX_SAFE) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 offset 超出安全整数`);
      if (video !== vi) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 video 编号不对`);
      if (length === 0) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 length 为 0`);
      if (offset !== expectedOff) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 offset 不连续`);
      if (offset + length > size) fail("ORB_TRUNCATED_FRAME", `第 ${e} 条索引越界`);
      entries.push({ video, length, offset });
      expectedOff += length;
      e++;
    }
  }
  if (expectedOff !== size) fail("ORB_INVALID_INDEX", "索引与文件长度不一致");

  const bundle: Bundle = {
    header,
    meta,
    entries,
    layers,
    size,
    sceneConfig: sceneConfigFromMeta(meta),
    frameEntry(videoIndex: number, frameIndex: number): FrameEntry {
      if (!isInt(videoIndex) || videoIndex < 0 || videoIndex >= layers.length) {
        fail("ORB_INVALID_ARGUMENT", `没有视频 ${videoIndex}`);
      }
      const layer = layers[videoIndex];
      if (!isInt(frameIndex) || frameIndex < 0 || frameIndex >= layer.frameCount) {
        fail("ORB_INVALID_ARGUMENT", `视频 ${videoIndex} 没有第 ${frameIndex} 帧`);
      }
      return entries[layer.indexStart + frameIndex];
    },
    frameBytes(videoIndex: number, frameIndex: number): Uint8Array {
      const entry = bundle.frameEntry(videoIndex, frameIndex);
      return bytes.subarray(entry.offset, entry.offset + entry.length);
    },
  };
  return bundle;
}

export type Entry = FrameEntry;
