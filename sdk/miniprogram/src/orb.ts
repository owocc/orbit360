/* ORB3 v1 parser for Canvas 2D mini programs.
 * Core validation lives in sdk/core; this wrapper adds data URL helpers.
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
  VideoLayer,
  VideoMeta,
  VideoFrames,
  OrbitMeta,
  OrbitAxis,
  OrbitDirection,
} from "../../core/src/orb";

export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 2;

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = "";
  let index = 0;
  for (; index + 2 < bytes.length; index += 3) {
    const n = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = "";
    }
  }
  const left = bytes.length - index;
  if (left === 1) {
    const n = bytes[index] << 16;
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + "==";
  } else if (left === 2) {
    const n = (bytes[index] << 16) | (bytes[index + 1] << 8);
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  parts.push(chunk);
  return parts.join("");
}

export interface Bundle extends CoreBundle {
  frameDataUrl(videoIndex: number, frameIndex: number): string;
}

export function parse(buffer: ArrayBuffer | ArrayBufferView | Uint8Array): Bundle {
  const core = parseCore(buffer);
  const bundle: Bundle = {
    ...core,
    frameEntry: (videoIndex, frameIndex) => core.frameEntry(videoIndex, frameIndex),
    frameBytes: (videoIndex, frameIndex) => core.frameBytes(videoIndex, frameIndex),
    frameDataUrl(videoIndex: number, frameIndex: number): string {
      const mime =
        typeof core.meta.codec === "string" && core.meta.codec ? core.meta.codec : "image/webp";
      return `data:${mime};base64,${bytesToBase64(core.frameBytes(videoIndex, frameIndex))}`;
    },
  };
  return bundle;
}

const OrbBundle = {
  parse,
  HEADER_SIZE: 32,
  ENTRY_SIZE: 16,
  VERSION: 0x00010002,
};

export default OrbBundle;
