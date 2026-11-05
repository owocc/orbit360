//#region src/client.d.ts
declare const VERSION$1 = "0.1.0";
declare const DEFAULTS: {
  title: string;
  video: {
    displayScale: number;
    portraitScale: number;
    fit: string;
    width: number;
    height: number;
  };
  orbit: {
    axis: string;
    spanDeg: number;
    direction: string;
    minAngle: number;
    maxAngle: number;
  };
  drag: {
    degPerPx: number;
    invert: boolean;
    inertia: boolean;
    inertiaMs: number;
  };
  motion: {
    smoothMs: number;
  };
  auto: {
    enabled: boolean;
    dir: string;
    degPerSec: number;
    idleDelayMs: number;
    rampInMs: number;
    rampOutMs: number;
  };
  gyro: {
    gain: number;
    invert: boolean;
    smooth: boolean;
    smoothMs: number;
  };
  mouseFollow: {
    enabled: boolean;
    degPerPx: number;
  };
};
export declare class Orbit360Client {
  [key: string]: any;
  /**
   * @param canvas 小程序 Canvas 2D 节点（type="2d"）
   * @param options
   * @param options.width 画布 CSS 宽度
   * @param options.height 画布 CSS 高度
   * @param options.config 用户配置覆盖
   * @param options.dprCap=2
   * @param options.concurrency=6
   * @param options.autoStartGyro=false
   * @param options.deviceMotionInterval='game'
   */
  constructor(canvas: any, options?: any);
  on(type: string, handler: (...args: any[]) => void): () => this;
  once(type: string, handler: (...args: any[]) => void): () => this;
  off(type: string, handler: (...args: any[]) => void): this;
  _emit(type: string, payload?: any): void;
  _emitState(): void;
  _emitAngle(): void;
  _emitFrame(index: number): void;
  _resolveConfig(): any;
  _applyConfig(): void;
  _recalcFrames(): void;
  _frameSpan(): number;
  _normAngle(value: any): number;
  _angleDelta(from: number, to: number): number;
  setConfig(partial: any): this;
  resetConfig(): this;
  getConfig(): any;
  getMeta(): any;
  getState(): {
    ready: any;
    loading: any;
    destroyed: any;
    format: any;
    quality: any;
    codec: any;
    title: any;
    angle: number;
    target: number;
    axis: any;
    limits: {
      min: any;
      max: any;
      limited: any;
    };
    velocity: any;
    frameIndex: number;
    frameCount: any;
    frameDeg: any;
    degPerFrame: any;
    dragging: any;
    missingFrames: number;
    auto: {
      state: any;
      enabled: boolean;
      direction: any;
      speed: any;
      weight: any;
      idleDelayMs: any;
      rampInMs: any;
      rampOutMs: any;
    };
    gyro: {
      enabled: any;
      pending: any;
      seen: any;
      absolute: boolean;
      supported: boolean;
      gain: any;
      invert: boolean;
      smooth: any;
      smoothMs: any;
    };
    inertia: any;
    invert: any;
    fit: any;
    mouseFollow: {
      enabled: any;
      degPerPx: any;
    };
    progress: {
      progress: any;
      loaded: any;
      total: any;
      phase: any;
    };
    viewport: {
      width: any;
      height: any;
      dpr: any;
    };
    canvas: {
      width: any;
      height: any;
      frameWidth: any;
      frameHeight: any;
    };
    config: any;
    meta: any;
  };
  getAngle(): number;
  getTargetAngle(): number;
  getFrameIndex(): number;
  getFrameCount(): any;
  setAngle(deg: number, options?: {
    immediate?: boolean;
  }): this;
  rotateBy(deg: number): this;
  reset(angle?: number, options?: {
    immediate?: boolean;
  }): this;
  setAutoRotate(value: any, direction?: string): any;
  cycleAuto(): "cw" | "off" | "ccw";
  setAutoSpeed(degPerSec: number): this;
  setAutoConfig(partial: any): this;
  setGyroConfig(partial: any): this;
  setDragConfig(partial: any): this;
  setMotionConfig(partial: any): this;
  setOrbitConfig(partial: any): this;
  setVideoConfig(partial: any): this;
  setInertia(enabled: boolean): this;
  setInvert(enabled: boolean): this;
  setFit(mode: string): this;
  setMouseFollow(value: any): this;
  load(source: any, options?: any): Promise<this>;
  loadUrl(url: string, options?: any): Promise<this>;
  loadFile(filePath: string, options?: any): Promise<this>;
  loadBuffer(buffer: ArrayBuffer, options?: any): Promise<this>;
  unload(): this;
  _loadOrb(buffer: ArrayBuffer, token: number, options: any): Promise<void>;
  _loadImage(src: string): Promise<any>;
  _loadFrameImage(orb: any, vi: number, fi: number): Promise<any>;
  _decodeJobs(jobs: any[], token: number, from: number, to: number): Promise<void>;
  _setProgress(progress: number, phase: string, loaded: number, total: number): void;
  _countMissingFrames(): number;
  resize(width?: number, height?: number): this;
  setViewport(width: number, height: number): this;
  _fillBackdrop(): void;
  _layout(): void;
  _frameIndex(): number;
  _dirSign(): 1 | -1;
  _layerFrame(layer: any, index: number): any;
  _paint(): void;
  _loop(t: number): void;
  _updateAuto(dt: number, t: number): void;
  _touchActivity(): void;
  _touchPoint(e: any): {
    x: number;
    y: number;
    t: any;
  };
  touchStart(e: any): this;
  touchMove(e: any): this;
  touchEnd(_e?: any): this;
  touchCancel(e?: any): this;
  isGyroSupported(): boolean;
  _initAutoGyro(): void;
  enableGyro(): Promise<boolean>;
  disableGyro(): this;
  _stopGyro(reason: string): void;
  calibrateGyro(): this;
  _handleMotion(e: any): void;
  pause(): this;
  resume(): this;
  destroy(): void;
}
export declare function queryCanvas(options?: any): Promise<any>;
/**
 * 创建微信小程序渲染客户端。
 *
 * 传 selector 时异步查询 Canvas 节点；传 canvas 节点时直接创建。
 *
 *   const client = await createClient({
 *     selector: "#orbit-canvas",
 *     component: this,
 *     config: { auto: { enabled: true } },
 *   });
 */
export declare function createClient(options?: any): Promise<Orbit360Client>;
//#endregion
//#region src/orb.d.ts
export declare const MAGIC: number[];
export declare const HEADER_SIZE = 32;
export declare const ENTRY_SIZE = 16;
export declare const FORMAT = "orbit360.bundle";
export declare const VERSION_MAJOR = 1;
export declare const VERSION_MINOR = 2;
declare const VERSION: number;
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
  width: number;
  height: number;
  fps: number;
  indexStart: number;
}
interface VideoMeta {
  id: string;
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
type Entry = [video: number, length: number, offset: number];
interface FrameEntry {
  video: number;
  length: number;
  offset: number;
}
interface Bundle {
  header: BundleHeader;
  meta: BundleMeta;
  entries: Entry[];
  prefixLen: number;
  size: number;
  buffer: ArrayBuffer | null;
  frameEntry(videoIndex: number, frameIndex: number): FrameEntry;
  frameBytes(videoIndex: number, frameIndex: number): Uint8Array;
  frameDataUrl(videoIndex: number, frameIndex: number): string;
}
declare function parse(buffer: ArrayBuffer): Bundle;
declare const OrbBundle: {
  parse: typeof parse;
  HEADER_SIZE: number;
  ENTRY_SIZE: number;
  VERSION: number;
};
//#endregion
export { type Bundle, type BundleHeader, type BundleMeta, Orbit360Client as Client, Orbit360Client as default, DEFAULTS, type Entry, type FrameEntry, VERSION as ORB_VERSION, OrbBundle, type OrbitAxis, type OrbitDirection, type OrbitMeta, type Rect, VERSION$1 as VERSION, type VideoFrames, type VideoMeta, parse as parseOrb };