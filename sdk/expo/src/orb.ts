/* ORB3 scene bundle parser for Expo / React Native
 * 头部 32B：magic "ORB3" / version / prefixLen / metaLen / indexLen /
 *           frameCount / indexEntrySize / flags（全部小端）
 * Index 每帧 16B：<IIQ> videoIndex, length, absoluteOffset
 */

export const MAGIC = [0x4f, 0x52, 0x42, 0x33]; // "ORB3"
export const HEADER_SIZE = 32;
export const ENTRY_SIZE = 16;
export const FORMAT = "orbit360.bundle";
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

export interface FrameEntry {
  video: number;
  length: number;
  offset: number;
}

export class OrbMetaError extends Error {
  constructor(message: string) {
    super(`ORB3: ${message}`);
    this.name = "OrbMetaError";
  }
}

function versionText(raw: number): string {
  return raw === 1 ? "1.0" : `${raw >>> 16}.${raw & 0xffff}`;
}

export class BundleHeader {
  version: number;
  prefixLen: number;
  metaLen: number;
  indexLen: number;
  frameCount: number;
  indexEntrySize: number;
  flags: number;

  constructor(
    version: number,
    prefixLen: number,
    metaLen: number,
    indexLen: number,
    frameCount: number,
    indexEntrySize: number,
    flags: number,
  ) {
    this.version = version;
    this.prefixLen = prefixLen;
    this.metaLen = metaLen;
    this.indexLen = indexLen;
    this.frameCount = frameCount;
    this.indexEntrySize = indexEntrySize;
    this.flags = flags;
  }

  static parse(buffer: ArrayBuffer | Uint8Array): BundleHeader {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.byteLength < HEADER_SIZE) {
      throw new OrbMetaError("头部不足 32 字节");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < 4; i++) {
      if (view.getUint8(i) !== MAGIC[i]) {
        throw new OrbMetaError("magic 不是 ORB3");
      }
    }
    const version = view.getUint32(4, true);
    const prefixLen = view.getUint32(8, true);
    const metaLen = view.getUint32(12, true);
    const indexLen = view.getUint32(16, true);
    const frameCount = view.getUint32(20, true);
    const indexEntrySize = view.getUint32(24, true);
    const flags = view.getUint32(28, true);

    if (version !== VERSION && version !== 0x00010001 && version !== 1) {
      throw new OrbMetaError(`不支持的版本 ${versionText(version)}（支持 1.0 / 1.1 / 1.2）`);
    }
    if (indexEntrySize !== ENTRY_SIZE) {
      throw new OrbMetaError(`不支持的索引项大小 ${indexEntrySize}`);
    }
    if (indexLen !== frameCount * ENTRY_SIZE) {
      throw new OrbMetaError("indexLen 与 frameCount 不一致");
    }
    if (prefixLen !== HEADER_SIZE + metaLen + indexLen) {
      throw new OrbMetaError("prefixLen 不一致");
    }
    if (frameCount <= 0) {
      throw new OrbMetaError("frameCount 为 0");
    }

    return new BundleHeader(
      version,
      prefixLen,
      metaLen,
      indexLen,
      frameCount,
      indexEntrySize,
      flags,
    );
  }
}

export class OrbBundle {
  header: BundleHeader;
  meta: BundleMeta;
  private _buffer: Uint8Array;
  private _entries: FrameEntry[];
  private _videoEntries: FrameEntry[][];

  constructor(header: BundleHeader, meta: BundleMeta, buffer: Uint8Array, entries: FrameEntry[]) {
    this.header = header;
    this.meta = meta;
    this._buffer = buffer;
    this._entries = entries;

    const byVideo: FrameEntry[][] = [];
    for (const entry of entries) {
      if (!byVideo[entry.video]) byVideo[entry.video] = [];
      byVideo[entry.video].push(entry);
    }
    this._videoEntries = byVideo;
  }

  static parse(buffer: ArrayBuffer | Uint8Array): OrbBundle {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const header = BundleHeader.parse(bytes);

    if (bytes.byteLength < header.prefixLen) {
      throw new OrbMetaError("文件过小，索引不完整");
    }

    const metaOffset = HEADER_SIZE;
    const metaBytes = bytes.subarray(metaOffset, metaOffset + header.metaLen);
    const metaText = new TextDecoder("utf-8").decode(metaBytes);

    let meta: BundleMeta;
    try {
      meta = JSON.parse(metaText);
    } catch {
      throw new OrbMetaError("Meta JSON 解析失败");
    }

    if (meta.format !== FORMAT) {
      throw new OrbMetaError(`不支持的格式 ${meta.format}`);
    }

    const indexOffset = HEADER_SIZE + header.metaLen;
    const view = new DataView(bytes.buffer, bytes.byteOffset + indexOffset, header.indexLen);
    const entries: FrameEntry[] = [];

    for (let i = 0; i < header.frameCount; i++) {
      const off = i * ENTRY_SIZE;
      const video = view.getUint32(off, true);
      const length = view.getUint32(off + 4, true);
      const low = view.getUint32(off + 8, true);
      const high = view.getUint32(off + 12, true);
      const absoluteOffset = high * 4294967296 + low;

      entries.push({
        video,
        length,
        offset: absoluteOffset,
      });
    }

    return new OrbBundle(header, meta, bytes, entries);
  }

  get totalFrames(): number {
    return this.header.frameCount;
  }

  frameEntry(videoIndex: number, frameIndex: number): FrameEntry {
    const list = this._videoEntries[videoIndex];
    if (!list || frameIndex < 0 || frameIndex >= list.length) {
      throw new Error(`帧超出范围: video=${videoIndex}, frame=${frameIndex}`);
    }
    return list[frameIndex];
  }

  frameBytes(videoIndex: number, frameIndex: number): Uint8Array {
    const entry = this.frameEntry(videoIndex, frameIndex);
    return this._buffer.subarray(entry.offset, entry.offset + entry.length);
  }

  /**
   * 将指定帧转换为 base64 data URI（如 data:image/jpeg;base64,...）
   * 针对 React Native / Expo Image 组件友好
   */
  frameDataUri(videoIndex: number, frameIndex: number, mimeType = "image/jpeg"): string {
    const bytes = this.frameBytes(videoIndex, frameIndex);
    return uint8ArrayToDataUri(bytes, mimeType);
  }
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < len ? BASE64_CHARS[b2 & 63] : "=";
  }
  return result;
}

export function uint8ArrayToDataUri(bytes: Uint8Array, mimeType = "image/jpeg"): string {
  return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`;
}
