export type OrbitDirection = 'cw' | 'ccw';
export type AutoState = 'off' | 'cw' | 'ccw';
export type FitMode = 'contain' | 'cover';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface VideoConfig {
  displayScale: number;
  portraitScale: number;
  fit: FitMode;
  width: number;
  height: number;
}

export interface OrbitConfig {
  spanDeg: number;
  direction: OrbitDirection;
}

export interface DragConfig {
  degPerPx: number;
  invert: boolean;
  inertia: boolean;
  inertiaMs: number;
}

export interface MotionConfig {
  smoothMs: number;
}

export interface AutoConfig {
  enabled: boolean;
  dir: OrbitDirection;
  degPerSec: number;
  idleDelayMs: number;
  rampInMs: number;
  rampOutMs: number;
}

export interface GyroConfig {
  gain: number;
  invert: boolean;
  smooth: boolean;
  smoothMs: number;
}

export interface MouseFollowConfig {
  enabled: boolean;
  degPerPx: number;
}

export interface ClientConfig {
  title?: string;
  video: VideoConfig;
  orbit: OrbitConfig;
  drag: DragConfig;
  motion: MotionConfig;
  auto: AutoConfig;
  gyro: GyroConfig;
  mouseFollow: MouseFollowConfig;
  defaults?: {
    auto?: Partial<AutoConfig>;
    quality?: string;
  };
  quality?: string;
}

export interface LoadOptions {
  quality?: string;
  cache?: RequestCache;
}

export interface ProgressState {
  progress: number;
  phase: string;
  loaded: number;
  total: number;
}

export interface AutoStateInfo {
  state: AutoState;
  enabled: boolean;
  direction: OrbitDirection;
  speed: number;
  weight: number;
  idleDelayMs: number;
  rampInMs: number;
  rampOutMs: number;
}

export interface GyroState {
  enabled: boolean;
  pending: boolean;
  seen: boolean;
  absolute: boolean;
  supported: boolean;
  gain: number;
  invert: boolean;
  smooth: boolean;
  smoothMs: number;
}

export interface ClientState {
  ready: boolean;
  loading: boolean;
  destroyed: boolean;
  format: string | null;
  quality: string | null;
  codec: string | null;
  title: string;
  angle: number;
  target: number;
  velocity: number;
  frameIndex: number;
  frameCount: number;
  frameDeg: number;
  degPerFrame: number;
  dragging: boolean;
  missingFrames: number;
  auto: AutoStateInfo;
  gyro: GyroState;
  inertia: boolean;
  invert: boolean;
  fit: FitMode;
  mouseFollow: MouseFollowConfig;
  progress: ProgressState;
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
  config: ClientConfig;
  meta: unknown;
}

export interface AngleEvent {
  angle: number;
  target: number;
  frameIndex: number;
}

export interface FrameEvent {
  index: number;
  count: number;
  frameDeg: number;
}

export interface GyroChangeEvent {
  enabled: boolean;
  pending: boolean;
  reason: string;
  error?: Error;
  state: ClientState;
}

export interface ClientEvents {
  loadstart: { source: string | Blob | ArrayBuffer | ArrayBufferView };
  progress: ProgressState;
  ready: { meta: unknown; config: ClientConfig; state: ClientState };
  error: Error;
  state: ClientState;
  angle: AngleEvent;
  frame: FrameEvent;
  gyrochange: GyroChangeEvent;
  dragstart: { pointerType: string };
  dragend: { velocity: number };
  longpress: Record<string, never>;
  doubletap: Record<string, never>;
  destroy: Record<string, never>;
}

export type Unsubscribe = () => void;

export interface Orbit360ClientOptions {
  container?: HTMLElement;
  input?: HTMLElement;
  dragClassTarget?: HTMLElement;
  config?: DeepPartial<ClientConfig>;
  dprCap?: number;
  autoStartGyro?: boolean;
  concurrency?: number;
  dragClass?: string;
  preventContextMenu?: boolean;
}

export class Orbit360Client {
  constructor(canvas: HTMLCanvasElement, options?: Orbit360ClientOptions);

  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly input: HTMLElement;

  on<K extends keyof ClientEvents>(type: K, handler: (payload: ClientEvents[K]) => void): Unsubscribe;
  once<K extends keyof ClientEvents>(type: K, handler: (payload: ClientEvents[K]) => void): Unsubscribe;
  off<K extends keyof ClientEvents>(type: K, handler: (payload: ClientEvents[K]) => void): this;

  load(source: string | Blob | ArrayBuffer | ArrayBufferView, options?: LoadOptions): Promise<this>;
  loadUrl(url: string, options?: LoadOptions): Promise<this>;
  loadBlob(blob: Blob, options?: LoadOptions): Promise<this>;
  unload(): this;

  setConfig(partial: DeepPartial<ClientConfig>): this;
  resetConfig(): this;
  getConfig(): ClientConfig;
  getMeta(): unknown;
  getState(): ClientState;

  getAngle(): number;
  getTargetAngle(): number;
  getFrameIndex(): number;
  getFrameCount(): number;
  setAngle(deg: number, options?: { immediate?: boolean }): this;
  rotateBy(deg: number): this;
  reset(angle?: number, options?: { immediate?: boolean }): this;

  setAutoRotate(
    value: boolean | AutoState | 'on' | 'off' | Partial<AutoConfig>,
    direction?: OrbitDirection,
  ): AutoState;
  cycleAuto(): AutoState;
  setAutoSpeed(degPerSec: number): this;
  setAutoConfig(partial: Partial<AutoConfig>): this;

  setGyroConfig(partial: Partial<GyroConfig>): this;
  isGyroSupported(): boolean;
  enableGyro(): Promise<boolean>;
  disableGyro(): this;
  calibrateGyro(): this;

  setDragConfig(partial: Partial<DragConfig>): this;
  setMotionConfig(partial: Partial<MotionConfig>): this;
  setOrbitConfig(partial: Partial<OrbitConfig>): this;
  setVideoConfig(partial: Partial<VideoConfig>): this;
  setInertia(enabled: boolean): this;
  setInvert(enabled: boolean): this;
  setFit(mode: FitMode): this;
  setMouseFollow(value: boolean | Partial<MouseFollowConfig>): this;

  resize(): this;
  destroy(): void;
}

export function createClient(
  canvas: HTMLCanvasElement,
  options?: Orbit360ClientOptions,
): Orbit360Client;

export { Orbit360Client as Client };
export const VERSION: string;
export const DEFAULTS: ClientConfig;
export default Orbit360Client;
