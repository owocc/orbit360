//#region src/client.d.ts
declare const VERSION = "0.1.0";
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
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {HTMLElement} [options.container] 尺寸参考元素，默认 canvas.parentElement
   * @param {HTMLElement} [options.input] 指针事件目标，默认 container
   * @param {object} [options.config] 用户配置覆盖
   * @param {number} [options.dprCap=2]
   * @param {boolean} [options.autoStartGyro=false]
   * @param {number} [options.concurrency=6]
   * @param {string} [options.dragClass='dragging']
   */
  constructor(canvas: HTMLCanvasElement, options?: any);
  on(type: any, handler: any): () => this;
  once(type: any, handler: any): () => this;
  off(type: any, handler: any): this;
  _emit(type: any, payload: any): void;
  _emitState(): void;
  _emitAngle(): void;
  _emitFrame(index: any): void;
  _resolveConfig(): any;
  _applyConfig(): void;
  _recalcFrames(): void;
  _frameSpan(): number;
  _normAngle(value: any): any;
  _angleDelta(from: any, to: any): number;
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
    angle: any;
    target: any;
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
      absolute: any;
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
  getAngle(): any;
  getTargetAngle(): any;
  getFrameIndex(): number;
  getFrameCount(): any;
  setAngle(deg: any, options?: {
    immediate?: boolean;
  }): this;
  rotateBy(deg: any): this;
  reset(angle?: number, options?: {
    immediate?: boolean;
  }): this;
  setAutoRotate(value: any, direction?: string): any;
  cycleAuto(): "cw" | "off" | "ccw";
  setAutoSpeed(degPerSec: any): this;
  setAutoConfig(partial: any): this;
  setGyroConfig(partial: any): this;
  setDragConfig(partial: any): this;
  setMotionConfig(partial: any): this;
  setOrbitConfig(partial: any): this;
  setVideoConfig(partial: any): this;
  setInertia(enabled: any): this;
  setInvert(enabled: any): this;
  setFit(mode: any): this;
  setMouseFollow(value: any): this;
  load(source: any, options?: any): Promise<this>;
  loadUrl(url: any, options?: {}): Promise<this>;
  loadBlob(blob: any, options?: {}): Promise<this>;
  unload(): this;
  _loadOrb(blob: any, token: any, options: any): Promise<void>;
  _loadZip(blob: any, token: any, options: any): Promise<void>;
  _decodeJobs(jobs: any, token: any, from: any, to: any): Promise<void>;
  _setProgress(progress: any, phase: any, loaded: any, total: any): void;
  _countMissingFrames(): number;
  resize(): this;
  _queueResize(): void;
  _fillBackdrop(): void;
  _layout(): void;
  _frameIndex(): number;
  _dirSign(): 1 | -1;
  _layerFrame(layer: any, index: any): any;
  _paint(): void;
  _loop(t: any): void;
  _updateAuto(dt: any, t: any): void;
  _touchActivity(): void;
  _bindEvents(): void;
  _handlePointerDown(e: any): void;
  _handlePointerMove(e: any): void;
  _handlePointerUp(e: any): void;
  isGyroSupported(): boolean;
  _initAutoGyro(): void;
  enableGyro(): Promise<boolean>;
  disableGyro(): this;
  _stopGyro(reason: any): void;
  calibrateGyro(): this;
  _handleOrientation(e: any, absolute: any): void;
  destroy(): void;
}
export declare function createClient(canvas: any, options: any): Orbit360Client;
//#endregion
export { Orbit360Client as Client, Orbit360Client as default, DEFAULTS, VERSION };