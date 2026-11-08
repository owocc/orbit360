//#region ../core/src/orb.d.ts
export declare const MAGIC: readonly [79, 82, 66, 51];
export declare const HEADER_SIZE = 32;
export declare const ENTRY_SIZE = 16;
export declare const FORMAT = "orbit360.bundle";
export declare const VERSION = 65538;
export declare const META_VERSION = 1.2;
type OrbitAxis = "x" | "y";
type OrbitDirection = "cw" | "ccw";
interface OrbitMeta {
  axis?: OrbitAxis;
  spanDeg?: number;
  direction?: OrbitDirection;
  minAngle?: number;
  maxAngle?: number;
  [key: string]: unknown;
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface VideoFrames {
  count: number;
  width?: number;
  height?: number;
  fps?: number;
  indexStart: number;
  [key: string]: unknown;
}
interface VideoMeta {
  id?: string;
  rect: Rect;
  source?: Record<string, unknown>;
  orbit?: OrbitMeta;
  frames: VideoFrames;
  [key: string]: unknown;
}
interface BundleMeta {
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
interface BundleHeader {
  version: number;
  prefixLen: number;
  metaLen: number;
  indexLen: number;
  frameCount: number;
  indexEntrySize: number;
  flags: number;
}
interface FrameEntry {
  video: number;
  length: number;
  offset: number;
}
interface VideoLayer {
  videoIndex: number;
  rect: Rect;
  frameCount: number;
  indexStart: number;
}
interface Bundle$1 {
  header: BundleHeader;
  meta: BundleMeta;
  entries: FrameEntry[];
  layers: VideoLayer[];
  size: number;
  sceneConfig: Record<string, unknown>;
  frameEntry(videoIndex: number, frameIndex: number): FrameEntry;
  frameBytes(videoIndex: number, frameIndex: number): Uint8Array;
}
//#endregion
//#region ../core/src/errors.d.ts
export type OrbErrorCode = "ORB_TRUNCATED_HEADER" | "ORB_INVALID_MAGIC" | "ORB_UNSUPPORTED_VERSION" | "ORB_INVALID_INDEX_ENTRY_SIZE" | "ORB_INVALID_FRAME_COUNT" | "ORB_INVALID_INDEX_LENGTH" | "ORB_INVALID_PREFIX_LENGTH" | "ORB_TRUNCATED_PREFIX" | "ORB_INVALID_META_JSON" | "ORB_INVALID_META" | "ORB_INVALID_FORMAT" | "ORB_INVALID_META_VERSION" | "ORB_INVALID_CANVAS" | "ORB_FRAME_COUNT_MISMATCH" | "ORB_INVALID_CODEC" | "ORB_INVALID_VIDEOS" | "ORB_INVALID_ORBIT" | "ORB_INVALID_AXIS" | "ORB_INVALID_DIRECTION" | "ORB_INVALID_SPAN" | "ORB_INVALID_ANGLE_RANGE" | "ORB_INVALID_VIDEO_ORBIT" | "ORB_INVALID_INDEX_START" | "ORB_INVALID_RECT" | "ORB_INVALID_INDEX" | "ORB_TRUNCATED_FRAME" | "ORB_INVALID_ARGUMENT";
export declare class OrbError extends Error {
  code: OrbErrorCode;
  offset?: number;
  constructor(code: OrbErrorCode, message: string, offset?: number);
}
export declare function fail(code: OrbErrorCode, message: string, offset?: number): never;
//#endregion
//#region src/orb.d.ts
export declare const VERSION_MAJOR = 1;
export declare const VERSION_MINOR = 2;
export interface Bundle extends Bundle$1 {
  blob: Blob | null;
  frameBlob(videoIndex: number, frameIndex: number): Blob;
}
export declare function parse(buffer: ArrayBuffer | ArrayBufferView | Uint8Array): Bundle;
export declare function fromBlob(blob: Blob): Promise<Bundle>;
declare const OrbBundle: {
  parse: typeof parse;
  fromBlob: typeof fromBlob;
  HEADER_SIZE: number;
  ENTRY_SIZE: number;
  VERSION: number;
};
//#endregion
//#region ../core/src/config.d.ts
export interface OrbitEngineConfig {
  title: string;
  video: {
    displayScale: number;
    portraitScale: number;
    fit: "contain" | "cover";
    width: number;
    height: number;
    [key: string]: unknown;
  };
  orbit: {
    axis: OrbitAxis;
    spanDeg: number;
    direction: OrbitDirection;
    minAngle: number;
    maxAngle: number;
    [key: string]: unknown;
  };
  drag: {
    degPerPx: number;
    invert: boolean;
    inertia: boolean;
    inertiaMs: number;
    [key: string]: unknown;
  };
  motion: {
    smoothMs: number;
    [key: string]: unknown;
  };
  auto: {
    enabled: boolean;
    dir: OrbitDirection;
    degPerSec: number;
    idleDelayMs: number;
    rampInMs: number;
    rampOutMs: number;
    [key: string]: unknown;
  };
  gyro: {
    gain: number;
    invert: boolean;
    smooth: boolean;
    smoothMs: number;
    [key: string]: unknown;
  };
  mouseFollow: {
    enabled: boolean;
    degPerPx: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export declare const DEFAULTS: OrbitEngineConfig;
export declare const CONFIG_KEYS: readonly ["title", "video", "orbit", "drag", "motion", "auto", "gyro", "mouseFollow", "defaults", "quality"];
export declare function clone<T>(value: T): T;
export declare function deepMerge<T>(base: T, ...sources: unknown[]): T;
export declare function resolveConfig(sceneConfig?: Record<string, unknown>, userConfig?: Record<string, unknown>): OrbitEngineConfig;
export declare function assertFiniteNumber(value: unknown, label: string): number;
//#endregion
//#region ../core/src/engine.d.ts
export declare const ENGINE_VERSION = "engine/v1";
export interface EngineLayerInput {
  rect: Rect;
  frameCount: number;
}
export interface EngineBundle {
  canvas: {
    width: number;
    height: number;
  };
  initialAngle?: number;
  videos: EngineLayerInput[];
  sceneConfig?: Record<string, unknown>;
}
export interface EngineLayerSnapshot {
  layerIndex: number;
  frameIndex: number;
  frameCount: number;
  rect: Rect;
}
export interface EngineSnapshot {
  ready: boolean;
  loading: boolean;
  paused: boolean;
  destroyed: boolean;
  angle: number;
  targetAngle: number;
  velocity: number;
  axis: "x" | "y";
  direction: OrbitDirection;
  spanDeg: number;
  minAngle: number;
  maxAngle: number;
  limited: boolean;
  frameIndex: number;
  frameCount: number;
  frameDeg: number;
  dragging: boolean;
  auto: {
    state: "off" | "cw" | "ccw";
    enabled: boolean;
    direction: OrbitDirection;
    speed: number;
    weight: number;
    idleDelayMs: number;
    rampInMs: number;
    rampOutMs: number;
  };
  gyro: {
    enabled: boolean;
    seen: boolean;
    gain: number;
    invert: boolean;
    smooth: boolean;
    smoothMs: number;
  };
  layers: EngineLayerSnapshot[];
}
export interface EngineOptions {
  config?: Record<string, unknown>;
}
export declare class OrbitEngine {
  private _sceneConfig;
  private _userConfig;
  private _config;
  private _ready;
  private _paused;
  private _destroyed;
  private _angle;
  private _target;
  private _velocity;
  private _dragging;
  private _limited;
  private _axis;
  private _minAngle;
  private _maxAngle;
  private _frameCount;
  private _degPerFrame;
  private _layers;
  private _lastPointerX;
  private _lastPointerY;
  private _lastPointerTime;
  private _now;
  private _lastActivity;
  private _autoState;
  private _autoDir;
  private _autoSpeed;
  private _autoWeight;
  private _gyroActive;
  private _gyroSeen;
  private _gyroRef;
  private _gyroBase;
  private _lastGyroTime;
  constructor(bundle: EngineBundle, options?: EngineOptions);
  load(bundle: EngineBundle): this;
  setConfig(partial?: Record<string, unknown>): this;
  resetConfig(): this;
  setAngle(deg: number, immediate?: boolean): this;
  rotateBy(deg: number): this;
  pointerDown(x: number, y: number, timeMs: number): this;
  pointerMove(x: number, y: number, timeMs: number): this;
  pointerUp(timeMs: number): this;
  enableGyro(): this;
  gyro(sample: {
    heading: number;
    timeMs: number;
  }): this;
  disableGyro(): this;
  calibrateGyro(): this;
  pause(): this;
  resume(): this;
  reset(angle?: number, immediate?: boolean): this;
  unload(): this;
  destroy(): this;
  advance(dtMs: number): this;
  getAngle(): number;
  getTargetAngle(): number;
  getFrameIndex(): number;
  getFrameCount(): number;
  getConfig(): OrbitEngineConfig;
  getSnapshot(): EngineSnapshot;
  private _eventTime;
  private _frameSpan;
  private _recalcFrames;
  private _applyConfig;
  private _normAngle;
  private _angleDelta;
  private _frameIndex;
}
export declare function createEngine(bundle: EngineBundle, options?: EngineOptions): OrbitEngine;
//#endregion
//#region ../core/src/layout.d.ts
export interface LayoutLayerInput {
  layerIndex: number;
  rect: Rect;
}
export interface LayoutInput {
  canvas: {
    width: number;
    height: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  fit?: "contain" | "cover";
  displayScale?: number;
  portraitScale?: number;
  layers?: LayoutLayerInput[];
}
export interface LayoutLayer {
  layerIndex: number;
  rect: Rect;
}
export interface LayoutPlan {
  scale: number;
  destinationRect: Rect;
  layers: LayoutLayer[];
}
export declare function computeLayout(input: LayoutInput): LayoutPlan;
//#endregion
export { type BundleHeader, type BundleMeta, type FrameEntry, type OrbitAxis, type OrbitDirection, type OrbitMeta, type Rect, type VideoFrames, type VideoLayer, type VideoMeta, OrbBundle as default };