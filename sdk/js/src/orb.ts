/* orb.ts — ORB3 v1 parser for browsers / Node.
 *
 *   const orb = await OrbBundle.fromBlob(file);
 *   orb.frameEntry(0, 0)  // { video, length, offset }
 *   orb.frameBlob(0, 0)   // Blob sliced by offset/length
 *
 * The parser itself lives in sdk/core and is shared by every TypeScript SDK.
 */
import {
  parse as parseCore,
  type Bundle as CoreBundle,
  type BundleHeader,
  type BundleMeta,
  type FrameEntry,
  type Rect,
  type VideoLayer,
  type VideoMeta,
  type VideoFrames,
  type OrbitMeta,
  type OrbitAxis,
  type OrbitDirection,
} from "../../core/src/orb";

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
};

export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 2;

export interface Bundle extends CoreBundle {
  blob: Blob | null;
  frameBlob(videoIndex: number, frameIndex: number): Blob;
}

function blobBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (blob.arrayBuffer) return blob.arrayBuffer();
  const { promise, resolve, reject } = Promise.withResolvers<ArrayBuffer>();
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as ArrayBuffer);
  reader.onerror = () => reject(reader.error || new Error("读取失败"));
  reader.readAsArrayBuffer(blob);
  return promise;
}

function attach(core: CoreBundle, blob: Blob | null): Bundle {
  const bundle: Bundle = {
    ...core,
    blob,
    frameEntry: (videoIndex, frameIndex) => core.frameEntry(videoIndex, frameIndex),
    frameBytes: (videoIndex, frameIndex) => core.frameBytes(videoIndex, frameIndex),
    frameBlob(videoIndex: number, frameIndex: number): Blob {
      const entry = core.frameEntry(videoIndex, frameIndex);
      if (!blob) {
        const bytes = core.frameBytes(videoIndex, frameIndex);
        const copy = new Uint8Array(bytes.length);
        copy.set(bytes);
        return new Blob([copy.buffer]);
      }
      return blob.slice(entry.offset, entry.offset + entry.length);
    },
  };
  return bundle;
}

export function parse(buffer: ArrayBuffer | ArrayBufferView | Uint8Array): Bundle {
  return attach(parseCore(buffer), null);
}

export async function fromBlob(blob: Blob): Promise<Bundle> {
  return attach(parseCore(await blobBuffer(blob)), blob);
}

const OrbBundle = {
  parse,
  fromBlob,
  HEADER_SIZE: 32,
  ENTRY_SIZE: 16,
  VERSION: 0x00010002,
};

export default OrbBundle;
