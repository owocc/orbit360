//#region ../core/src/orb.d.ts
export declare const MAGIC: readonly [79, 82, 66, 51];
export declare const HEADER_SIZE = 32;
export declare const ENTRY_SIZE = 16;
export declare const FORMAT = "orbit360.bundle";
declare const VERSION = 65538;
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
//#region ../miniprogram/src/orb.d.ts
export declare const VERSION_MAJOR = 1;
export declare const VERSION_MINOR = 2;
export interface Bundle extends Bundle$1 {
  frameDataUrl(videoIndex: number, frameIndex: number): string;
}
export declare function parse(buffer: ArrayBuffer | ArrayBufferView | Uint8Array): Bundle;
declare const OrbBundle: {
  parse: typeof parse;
  HEADER_SIZE: number;
  ENTRY_SIZE: number;
  VERSION: number;
};
//#endregion
//#region ../core/src/config.d.ts
interface OrbitEngineConfig {
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
    touchScale: number;
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
  pointerMove(x: number, y: number, timeMs: number, scale?: number): this;
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
//#region ../miniprogram/src/client.d.ts
declare const VERSION$1 = "0.1.0";
interface MiniTouch {
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
}
interface MiniTouchEvent {
  timeStamp?: number;
  touches?: MiniTouch[];
  changedTouches?: MiniTouch[];
}
interface MiniMotionEvent {
  alpha?: number;
  beta?: number;
  gamma?: number;
}
interface MiniImage {
  width?: number;
  height?: number;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}
interface MiniCanvasContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  drawImage(image: MiniImage, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): {
    addColorStop(offset: number, color: string): void;
  };
  fillRect(x: number, y: number, width: number, height: number): void;
  fillStyle: string | {
    addColorStop(offset: number, color: string): void;
  };
  imageSmoothingEnabled?: boolean;
  imageSmoothingQuality?: string;
}
interface MiniCanvasNode {
  width: number;
  height: number;
  _width?: number;
  _height?: number;
  getContext(type: "2d"): MiniCanvasContext | null;
  createImage(): MiniImage;
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(id: number): void;
}
interface MiniError {
  errMsg?: string;
}
interface MiniFileSystem {
  readFile(options: {
    filePath: string;
    success: (result: {
      data: ArrayBuffer;
    }) => void;
    fail: (error: MiniError) => void;
  }): void;
  writeFile(options: {
    filePath: string;
    data: ArrayBuffer;
    success: () => void;
    fail: (error: MiniError) => void;
  }): void;
  mkdir(options: {
    dirPath: string;
    recursive?: boolean;
    success: () => void;
    fail?: (error: MiniError) => void;
  }): void;
  rmdir?(options: {
    dirPath: string;
    recursive?: boolean;
  }): void;
}
interface MiniSelectorQuery {
  in?(component: unknown): MiniSelectorQuery;
  select(selector: string): {
    fields(options: {
      node: boolean;
      size: boolean;
    }): {
      exec(callback: (result: Array<{
        node?: MiniCanvasNode;
        width?: number;
        height?: number;
      }>) => void): void;
    };
  };
}
interface MiniProgramApi {
  env?: {
    USER_DATA_PATH?: string;
  };
  getWindowInfo?(): {
    pixelRatio?: number;
    windowWidth?: number;
    windowHeight?: number;
  };
  getSystemInfoSync(): {
    pixelRatio?: number;
    windowWidth?: number;
    windowHeight?: number;
  };
  createSelectorQuery(): MiniSelectorQuery;
  getFileSystemManager(): MiniFileSystem;
  request(options: {
    url: string;
    method?: string;
    responseType?: string;
    dataType?: string;
    timeout?: number;
    success: (result: {
      statusCode: number;
      data: ArrayBuffer;
    }) => void;
    fail: (error: MiniError) => void;
  }): void;
  startDeviceMotionListening(options: {
    interval?: string;
    success?: () => void;
    fail?: (error: MiniError) => void;
  }): void;
  stopDeviceMotionListening(options?: {
    success?: () => void;
    fail?: () => void;
  }): void;
  onDeviceMotionChange(handler: (event: MiniMotionEvent) => void): void;
  offDeviceMotionChange(handler: (event: MiniMotionEvent) => void): void;
}
interface MiniProgramPlatform {
  name: string;
  api: MiniProgramApi;
  localPathPrefixes: string[];
  now(): number;
}
interface MiniClientOptions {
  canvas?: MiniCanvasNode;
  selector?: string;
  component?: unknown;
  width?: number;
  height?: number;
  dpr?: number;
  dprCap?: number;
  concurrency?: number;
  autoStartGyro?: boolean;
  deviceMotionInterval?: string;
  frameSource?: string;
  quality?: string;
  config?: Record<string, unknown>;
}
interface MiniClientState {
  ready: boolean;
  loading: boolean;
  paused: boolean;
  destroyed: boolean;
  format: string | null;
  quality: string | null;
  codec: string | null;
  title: string;
  angle: number;
  target: number;
  targetAngle: number;
  axis: "x" | "y";
  direction: "cw" | "ccw";
  spanDeg: number;
  limits: {
    min: number;
    max: number;
    limited: boolean;
  };
  velocity: number;
  frameIndex: number;
  frameCount: number;
  frameDeg: number;
  degPerFrame: number;
  dragging: boolean;
  missingFrames: number;
  auto: EngineSnapshot["auto"];
  gyro: EngineSnapshot["gyro"] & {
    pending: boolean;
    absolute: boolean;
    supported: boolean;
  };
  inertia: boolean;
  invert: boolean;
  fit: "contain" | "cover";
  mouseFollow: {
    enabled: boolean;
    degPerPx: number;
  };
  progress: {
    progress: number;
    loaded: number;
    total: number;
    phase: string;
  };
  viewport: {
    width: number;
    height: number;
    dpr: number;
  };
  canvas: {
    width: number;
    height: number;
    frameWidth: number;
    frameHeight: number;
  };
  config: OrbitEngineConfig;
  meta: Bundle["meta"] | null;
}
interface FrameImage {
  img: MiniImage;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
interface MiniLayer {
  rect: Rect;
  frames: Array<FrameImage | null>;
  count: number;
}
export declare class MiniOrbitClient {
  canvas: MiniCanvasNode;
  ctx: MiniCanvasContext;
  options: Required<Pick<MiniClientOptions, "dprCap" | "concurrency" | "autoStartGyro" | "deviceMotionInterval">> & MiniClientOptions;
  engine: OrbitEngine;
  _layers: MiniLayer[];
  private _platform;
  private _events;
  private _meta;
  private _format;
  private _quality;
  private _codec;
  private _canvasW;
  private _canvasH;
  private _frameW;
  private _frameH;
  private _viewW;
  private _viewH;
  private _systemDpr;
  private _dpr;
  private _orientation;
  private _drawnIndex;
  private _lastT;
  private _lastEmittedAngle;
  private _raf;
  private _loading;
  private _ready;
  private _destroyed;
  private _paused;
  private _loadToken;
  private _progress;
  private _loaded;
  private _total;
  private _phase;
  private _pressTimer;
  private _pressStart;
  private _suppressMove;
  private _gyroPending;
  private _gyroSeen;
  private _gyroTimer;
  private _tempDirPromise;
  private _motionHandler;
  constructor(canvas: MiniCanvasNode, options: MiniClientOptions, platform: MiniProgramPlatform);
  on(type: string, handler: (payload: unknown) => void): () => void;
  once(type: string, handler: (payload: unknown) => void): () => void;
  off(type: string, handler: (payload: unknown) => void): this;
  private _emit;
  private _emitState;
  private _emitAngle;
  private _emitFrame;
  getConfig(): OrbitEngineConfig;
  getMeta(): Bundle["meta"] | null;
  getState(): MiniClientState;
  getAngle(): number;
  getTargetAngle(): number;
  getFrameIndex(): number;
  getFrameCount(): number;
  setConfig(partial: Record<string, unknown>): this;
  resetConfig(): this;
  setAngle(deg: number, options?: {
    immediate?: boolean;
  }): this;
  rotateBy(deg: number): this;
  reset(angle?: number, options?: {
    immediate?: boolean;
  }): this;
  setAutoRotate(value: boolean | string | {
    enabled?: boolean;
    dir?: string;
  }, direction?: string): string;
  setAuto(value: boolean | string | {
    enabled?: boolean;
    dir?: string;
  }): string;
  stopAuto(): this;
  cycleAuto(): string;
  setAutoSpeed(degPerSec: number): this;
  setAutoConfig(partial: Record<string, unknown>): this;
  setGyroConfig(partial: Record<string, unknown>): this;
  setDragConfig(partial: Record<string, unknown>): this;
  setMotionConfig(partial: Record<string, unknown>): this;
  setOrbitConfig(partial: Record<string, unknown>): this;
  setVideoConfig(partial: Record<string, unknown>): this;
  setInertia(enabled: boolean): this;
  setInvert(enabled: boolean): this;
  setFit(mode: "contain" | "cover"): this;
  setMouseFollow(value: boolean | Record<string, unknown>): this;
  load(source: string | ArrayBuffer | ArrayBufferView | {
    path?: string;
  }, options?: {
    quality?: string;
  }): Promise<this>;
  loadUrl(url: string, options?: {
    quality?: string;
  }): Promise<this>;
  loadFile(filePath: string, options?: {
    quality?: string;
  }): Promise<this>;
  loadBuffer(buffer: ArrayBuffer, options?: {
    quality?: string;
  }): Promise<this>;
  unload(): this;
  private _loadBundle;
  private _loadImage;
  private _loadFrameImage;
  private _decodeJobs;
  private _readSource;
  private _setProgress;
  private _countMissingFrames;
  resize(width?: number, height?: number): this;
  setViewport(width: number, height: number): this;
  private _fillBackdrop;
  private _layout;
  private _paint;
  private _loop;
  private _touchPoint;
  touchStart(event: MiniTouchEvent): this;
  touchMove(event: MiniTouchEvent): this;
  touchEnd(event?: MiniTouchEvent): this;
  touchCancel(event?: MiniTouchEvent): this;
  isGyroSupported(): boolean;
  private _initAutoGyro;
  enableGyro(): Promise<boolean>;
  disableGyro(): this;
  private _stopGyro;
  calibrateGyro(): this;
  private _handleMotion;
  pause(): this;
  resume(): this;
  destroy(): void;
}
//#endregion
//#region src/client.d.ts
export declare class Orbit360Client extends MiniOrbitClient {
  constructor(canvas: MiniCanvasNode, options?: MiniClientOptions);
}
export declare function queryCanvas(options?: MiniClientOptions): Promise<{
  node: MiniCanvasNode;
  width?: number;
  height?: number;
}>;
export declare function createClient(options?: MiniClientOptions): Promise<Orbit360Client>;
//#endregion
export { type BundleHeader, type BundleMeta, type FrameEntry, VERSION as ORB_VERSION, OrbBundle, Orbit360Client as default, type OrbitAxis, type OrbitDirection, type OrbitMeta, type Rect, VERSION$1 as VERSION, type VideoFrames, type VideoLayer, type VideoMeta, parse as parseOrb };