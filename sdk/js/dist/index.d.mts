//#region src/orb.d.ts
export declare const MAGIC: number[];
export declare const HEADER_SIZE = 32;
export declare const ENTRY_SIZE = 16;
export declare const FORMAT = "orbit360.bundle";
export declare const VERSION_MAJOR = 1;
export declare const VERSION_MINOR = 2;
export declare const VERSION: number;
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
  canvas: {
    width: number;
    height: number;
  };
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
  blob: Blob | null;
  frameEntry(videoIndex: number, frameIndex: number): FrameEntry;
  frameBlob(videoIndex: number, frameIndex: number): Blob;
}
export declare function parse(buffer: ArrayBuffer): Bundle;
export declare function fromBlob(blob: Blob): Promise<Bundle>;
declare const OrbBundle: {
  parse: typeof parse;
  fromBlob: typeof fromBlob;
  HEADER_SIZE: number;
  ENTRY_SIZE: number;
  VERSION: number;
};
//#endregion
export { OrbBundle as default };