/* ORB3 v1 parser for Expo / React Native.
 * Validation is shared with sdk/core; this class adds data URI helpers.
 */
import { parse as parseCore, type Bundle as CoreBundle } from "../../core/src/orb";

export { MAGIC, HEADER_SIZE, ENTRY_SIZE, FORMAT, VERSION, META_VERSION } from "../../core/src/orb";
export { OrbError } from "../../core/src/errors";
export type { OrbErrorCode } from "../../core/src/errors";
export type {
  BundleHeader,
  BundleMeta,
  FrameEntry,
  Rect,
  VideoMeta,
  VideoFrames,
  OrbitMeta,
  OrbitAxis,
  OrbitDirection,
} from "../../core/src/orb";

export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 2;

export class OrbMetaError extends Error {
  constructor(message: string) {
    super(`ORB3: ${message}`);
    this.name = "OrbMetaError";
  }
}

export class OrbBundle {
  header: CoreBundle["header"];
  meta: CoreBundle["meta"];
  private _buffer: Uint8Array;
  private _core: CoreBundle;

  private constructor(core: CoreBundle, buffer: Uint8Array) {
    this._core = core;
    this.header = core.header;
    this.meta = core.meta;
    this._buffer = buffer;
  }

  static parse(buffer: ArrayBuffer | ArrayBufferView | Uint8Array): OrbBundle {
    const bytes =
      buffer instanceof Uint8Array
        ? buffer
        : ArrayBuffer.isView(buffer)
          ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
          : new Uint8Array(buffer);
    return new OrbBundle(parseCore(bytes), bytes);
  }

  get totalFrames(): number {
    return this._core.header.frameCount;
  }

  get layers(): CoreBundle["layers"] {
    return this._core.layers;
  }

  get sceneConfig(): CoreBundle["sceneConfig"] {
    return this._core.sceneConfig;
  }

  frameEntry(videoIndex: number, frameIndex: number): CoreBundle["entries"][number] {
    return this._core.frameEntry(videoIndex, frameIndex);
  }

  frameBytes(videoIndex: number, frameIndex: number): Uint8Array {
    return this._core.frameBytes(videoIndex, frameIndex);
  }

  frameDataUri(videoIndex: number, frameIndex: number, mimeType = "image/jpeg"): string {
    return uint8ArrayToDataUri(this.frameBytes(videoIndex, frameIndex), mimeType);
  }
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < bytes.length ? BASE64_CHARS[b2 & 63] : "=";
  }
  return result;
}

export function uint8ArrayToDataUri(bytes: Uint8Array, mimeType = "image/jpeg"): string {
  return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`;
}
