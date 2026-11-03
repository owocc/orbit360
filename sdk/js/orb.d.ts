export = OrbBundle;

declare namespace OrbBundle {
  const HEADER_SIZE: number;
  const ENTRY_SIZE: number;
  const VERSION: number;

  type OrbitDirection = 'cw' | 'ccw';

  interface Point {
    x: number;
    y: number;
  }

  interface Rect extends Point {
    width: number;
    height: number;
  }

  interface SourceInfo {
    file?: string;
    width?: number;
    height?: number;
    fps?: number;
    frames?: number;
    durationSec?: number;
    codec?: string;
    [key: string]: unknown;
  }

  interface VideoFrames {
    count: number;
    width: number;
    height: number;
    fps: number;
    indexStart: number;
  }

  interface Video {
    id: string;
    rect: Rect;
    source?: SourceInfo;
    orbit?: {
      spanDeg?: number;
      direction?: OrbitDirection;
    };
    frames: VideoFrames;
    [key: string]: unknown;
  }

  interface Meta {
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
    orbit?: {
      spanDeg?: number;
      direction?: OrbitDirection;
    };
    videos: Video[];
    [key: string]: unknown;
  }

  interface Header {
    version: number;
    prefixLen: number;
    metaLen: number;
    indexLen: number;
    frameCount: number;
    indexEntrySize: number;
    flags: number;
  }

  type Entry = [video: number, length: number, offset: number];

  interface FrameEntry {
    video: number;
    length: number;
    offset: number;
  }

  interface Bundle {
    header: Header;
    meta: Meta;
    entries: Entry[];
    prefixLen: number;
    size: number;
    blob: Blob | null;
    frameEntry(videoIndex: number, frameIndex: number): FrameEntry;
    frameBlob(videoIndex: number, frameIndex: number): Blob;
  }

  function parse(buffer: ArrayBuffer): Bundle;
  function fromBlob(blob: Blob): Promise<Bundle>;
}
