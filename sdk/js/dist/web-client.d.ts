//#region ../core/src/orb.d.ts
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
interface EngineLayerInput {
  rect: Rect;
  frameCount: number;
}
interface EngineBundle {
  canvas: {
    width: number;
    height: number;
  };
  initialAngle?: number;
  videos: EngineLayerInput[];
  sceneConfig?: Record<string, unknown>;
}
interface EngineLayerSnapshot {
  layerIndex: number;
  frameIndex: number;
  frameCount: number;
  rect: Rect;
}
interface EngineSnapshot {
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
interface EngineOptions {
  config?: Record<string, unknown>;
}
declare class OrbitEngine {
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
//#endregion
//#region src/orb.d.ts
interface Bundle extends Bundle$1 {
  blob: Blob | null;
  frameBlob(videoIndex: number, frameIndex: number): Blob;
}
//#endregion
//#region src/client.d.ts
declare const VERSION = "0.1.0";
export interface Orbit360ClientOptions {
  container?: HTMLElement;
  input?: HTMLElement;
  dragClassTarget?: HTMLElement;
  config?: Record<string, unknown>;
  dprCap?: number;
  autoStartGyro?: boolean;
  concurrency?: number;
  dragClass?: string;
  preventContextMenu?: boolean;
}
export interface Orbit360ClientState {
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
export interface LoadOptions {
  cache?: RequestCache;
  quality?: string;
}
export declare class Orbit360Client {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  container: HTMLElement;
  input: HTMLElement;
  dragTarget: HTMLElement;
  options: Orbit360ClientOptions & {
    dprCap: number;
    autoStartGyro: boolean;
    concurrency: number;
    dragClass: string;
    preventContextMenu: boolean;
  };
  engine: OrbitEngine;
  private _events;
  private _layers;
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
  private _dpr;
  private _drawnIndex;
  private _lastT;
  private _lastEmittedAngle;
  private _raf;
  private _visible;
  private _intersectionObserver;
  private _loading;
  private _ready;
  private _destroyed;
  private _paused;
  private _loadToken;
  private _progress;
  private _loaded;
  private _total;
  private _phase;
  private _lastPointerType;
  private _hoverX;
  private _hoverY;
  private _pressTimer;
  private _pressStart;
  private _suppressMove;
  private _resizeQueued;
  private _gyroPending;
  private _gyroTimer;
  private _gyroSeen;
  private _hasAbsolute;
  private _onResize;
  private _onPointerDown;
  private _onPointerMove;
  private _onPointerUp;
  private _onPointerLeave;
  private _onDblClick;
  private _onContextMenu;
  private _onAbsolute;
  private _onRelative;
  private _resizeObserver;
  constructor(canvas: HTMLCanvasElement, options?: Orbit360ClientOptions);
  on(type: string, handler: (payload: unknown) => void): () => void;
  once(type: string, handler: (payload: unknown) => void): () => void;
  off(type: string, handler: (payload: unknown) => void): this;
  private _emit;
  private _emitState;
  private _emitAngle;
  private _emitFrame;
  getConfig(): OrbitEngineConfig;
  getMeta(): Bundle["meta"] | null;
  getState(): Orbit360ClientState;
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
  load(source: string | Blob | ArrayBuffer | ArrayBufferView, options?: LoadOptions): Promise<this>;
  loadUrl(url: string, options?: LoadOptions): Promise<this>;
  loadBlob(blob: Blob, options?: LoadOptions): Promise<this>;
  unload(): this;
  private _decodeJobs;
  private _setProgress;
  private _countMissingFrames;
  resize(): this;
  private _queueResize;
  private _fillBackdrop;
  private _layout;
  private _paint;
  private _loop;
  private _bindEvents;
  private _setVisible;
  private _pointerTime;
  private _handlePointerDown;
  private _handlePointerMove;
  private _handlePointerUp;
  isGyroSupported(): boolean;
  private _initAutoGyro;
  enableGyro(): Promise<boolean>;
  disableGyro(): this;
  private _stopGyro;
  calibrateGyro(): this;
  private _handleOrientation;
  pause(): this;
  resume(): this;
  destroy(): void;
}
export declare function createClient(canvas: HTMLCanvasElement, options?: Orbit360ClientOptions): Orbit360Client;
//#endregion
export { Orbit360Client as Client, Orbit360Client as default, VERSION };