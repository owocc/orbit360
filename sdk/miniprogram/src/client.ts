/* Shared mini program client (WeChat / Douyin / any Canvas 2D miniprogram).
 *
 * Platform APIs are injected through MiniProgramPlatform. The motion model is
 * the shared OrbitEngine; this file only owns canvas, image, file and gyro glue.
 */
import {
  createEngine,
  computeLayout,
  DEFAULTS,
  clone,
  type EngineSnapshot,
  type OrbitEngine,
  type OrbitEngineConfig,
  type Rect,
} from "../../core/src/index";
import { parse as parseOrb, type Bundle } from "./orb";

const VERSION = "0.1.0";
const RAD = Math.PI / 180;

export interface MiniTouch {
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
}

export interface MiniTouchEvent {
  timeStamp?: number;
  touches?: MiniTouch[];
  changedTouches?: MiniTouch[];
}

export interface MiniMotionEvent {
  alpha?: number;
  beta?: number;
  gamma?: number;
}

export interface MiniImage {
  width?: number;
  height?: number;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

export interface MiniCanvasContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  drawImage(
    image: MiniImage,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): {
    addColorStop(offset: number, color: string): void;
  };
  fillRect(x: number, y: number, width: number, height: number): void;
  fillStyle: string | { addColorStop(offset: number, color: string): void };
  imageSmoothingEnabled?: boolean;
  imageSmoothingQuality?: string;
}

export interface MiniCanvasNode {
  width: number;
  height: number;
  _width?: number;
  _height?: number;
  getContext(type: "2d"): MiniCanvasContext | null;
  createImage(): MiniImage;
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(id: number): void;
}

export interface MiniError {
  errMsg?: string;
}

export interface MiniFileSystem {
  readFile(options: {
    filePath: string;
    success: (result: { data: ArrayBuffer }) => void;
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
  rmdir?(options: { dirPath: string; recursive?: boolean }): void;
}

export interface MiniSelectorQuery {
  in?(component: unknown): MiniSelectorQuery;
  select(selector: string): {
    fields(options: { node: boolean; size: boolean }): {
      exec(
        callback: (
          result: Array<{ node?: MiniCanvasNode; width?: number; height?: number }>,
        ) => void,
      ): void;
    };
  };
}

export interface MiniProgramApi {
  env?: { USER_DATA_PATH?: string };
  getWindowInfo?(): { pixelRatio?: number; windowWidth?: number; windowHeight?: number };
  getSystemInfoSync(): { pixelRatio?: number; windowWidth?: number; windowHeight?: number };
  createSelectorQuery(): MiniSelectorQuery;
  getFileSystemManager(): MiniFileSystem;
  request(options: {
    url: string;
    method?: string;
    responseType?: string;
    dataType?: string;
    timeout?: number;
    success: (result: { statusCode: number; data: ArrayBuffer }) => void;
    fail: (error: MiniError) => void;
  }): void;
  startDeviceMotionListening(options: {
    interval?: string;
    success?: () => void;
    fail?: (error: MiniError) => void;
  }): void;
  stopDeviceMotionListening(options?: { success?: () => void; fail?: () => void }): void;
  onDeviceMotionChange(handler: (event: MiniMotionEvent) => void): void;
  offDeviceMotionChange(handler: (event: MiniMotionEvent) => void): void;
}

export interface MiniProgramPlatform {
  name: string;
  api: MiniProgramApi;
  localPathPrefixes: string[];
  now(): number;
}

export interface MiniClientOptions {
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

export interface MiniClientState {
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
  limits: { min: number; max: number; limited: boolean };
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
  mouseFollow: { enabled: boolean; degPerPx: number };
  progress: { progress: number; loaded: number; total: number; phase: string };
  viewport: { width: number; height: number; dpr: number };
  canvas: { width: number; height: number; frameWidth: number; frameHeight: number };
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

interface TouchPoint {
  x: number;
  y: number;
  t: number;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  let padding = 0;
  if (clean.endsWith("==")) padding = 2;
  else if (clean.endsWith("=")) padding = 1;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let position = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) |
      (B64.indexOf(clean[i + 3]) & 63);
    bytes[position++] = (n >> 16) & 255;
    if (position < bytes.length) bytes[position++] = (n >> 8) & 255;
    if (position < bytes.length) bytes[position++] = n & 255;
  }
  return bytes.buffer;
}

function extForCodec(codec: string): string {
  if (/jpe?g/i.test(codec)) return "jpg";
  if (/avif/i.test(codec)) return "avif";
  if (/png/i.test(codec)) return "png";
  return "webp";
}

function miniWindowSize(api: MiniProgramApi): { width: number; height: number } {
  try {
    const info =
      typeof api.getWindowInfo === "function" ? api.getWindowInfo() : api.getSystemInfoSync();
    return { width: Number(info.windowWidth) || 0, height: Number(info.windowHeight) || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

function miniDpr(api: MiniProgramApi): number {
  try {
    const info =
      typeof api.getWindowInfo === "function" ? api.getWindowInfo() : api.getSystemInfoSync();
    return Number(info.pixelRatio) || 1;
  } catch {
    return 1;
  }
}

function screenOrientation(api: MiniProgramApi): number {
  const size = miniWindowSize(api);
  return size.width > size.height ? 90 : 0;
}

function headingOf(event: MiniMotionEvent, orientation: number): number | null {
  const alpha = event.alpha;
  const beta = event.beta;
  const gamma = event.gamma;
  if (typeof alpha !== "number") return null;
  if (typeof beta !== "number" || typeof gamma !== "number") return (360 - alpha) % 360;
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  const vx = Math.sin(g) * Math.cos(a) + Math.cos(g) * Math.sin(b) * Math.sin(a);
  const vy = Math.sin(g) * Math.sin(a) - Math.cos(g) * Math.sin(b) * Math.cos(a);
  if (Math.hypot(vx, vy) < 0.25) {
    return orientation === 90 || orientation === 270 ? alpha % 360 : (360 - alpha) % 360;
  }
  return (((Math.atan2(-vx, -vy) / RAD) % 360) + 360) % 360;
}

function pitchOf(event: MiniMotionEvent): number | null {
  return typeof event.beta === "number" && !Number.isNaN(event.beta) ? event.beta % 360 : null;
}

function normalizeSource(
  source: string | ArrayBuffer | ArrayBufferView | { path?: string },
): string | ArrayBuffer | ArrayBufferView {
  if (
    source &&
    typeof source === "object" &&
    !(source instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(source)
  ) {
    if (typeof source.path === "string") return source.path;
    throw new Error("load: 对象参数需要 path");
  }
  return source;
}

export class MiniOrbitClient {
  canvas: MiniCanvasNode;
  ctx: MiniCanvasContext;
  options: Required<
    Pick<MiniClientOptions, "dprCap" | "concurrency" | "autoStartGyro" | "deviceMotionInterval">
  > &
    MiniClientOptions;
  engine: OrbitEngine;
  _layers: MiniLayer[] = [];

  private _platform: MiniProgramPlatform;
  private _events = new Map<string, Array<(payload: unknown) => void>>();
  private _meta: Bundle["meta"] | null = null;
  private _format: string | null = null;
  private _quality: string | null = null;
  private _codec: string | null = null;
  private _canvasW = 0;
  private _canvasH = 0;
  private _frameW = 0;
  private _frameH = 0;
  private _viewW = 0;
  private _viewH = 0;
  private _systemDpr = 1;
  private _dpr = 1;
  private _orientation = 0;
  private _drawnIndex = -1;
  private _lastT = 0;
  private _lastEmittedAngle = Number.NaN;
  private _raf = 0;
  private _loading = false;
  private _ready = false;
  private _destroyed = false;
  private _paused = false;
  private _loadToken = 0;
  private _progress = 0;
  private _loaded = 0;
  private _total = 0;
  private _phase = "idle";
  private _pressTimer: ReturnType<typeof setTimeout> | null = null;
  private _pressStart: { x: number; y: number } | null = null;
  private _suppressMove = false;
  private _gyroPending = false;
  private _gyroSeen = false;
  private _gyroTimer: ReturnType<typeof setTimeout> | null = null;
  private _tempDirPromise: Promise<string> | null = null;
  private _motionHandler = (event: MiniMotionEvent) => this._handleMotion(event);

  constructor(canvas: MiniCanvasNode, options: MiniClientOptions, platform: MiniProgramPlatform) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new Error("Orbit360Client: 需要小程序 Canvas 2D 节点");
    }
    this._platform = platform;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Orbit360Client: 无法获取 2D context");
    this.ctx = ctx;
    this.options = {
      dprCap: 2,
      concurrency: 6,
      autoStartGyro: false,
      deviceMotionInterval: "game",
      ...options,
    };
    this._systemDpr = options.dpr && options.dpr > 0 ? options.dpr : miniDpr(platform.api);
    const fallback = miniWindowSize(platform.api);
    this._viewW = options.width || fallback.width || 1;
    this._viewH = options.height || fallback.height || 1;
    this._orientation = screenOrientation(platform.api);
    this.engine = createEngine(
      { canvas: { width: 0, height: 0 }, videos: [] },
      { config: options.config || {} },
    );
    this.engine.unload();
    this.resize();
    this._raf = canvas.requestAnimationFrame(() => this._loop());
    if (this.options.autoStartGyro) this._initAutoGyro();
  }

  /* ---------- events / state ---------- */

  on(type: string, handler: (payload: unknown) => void): () => void {
    if (typeof handler !== "function") throw new Error("Orbit360Client: handler 必须是函数");
    let list = this._events.get(type);
    if (!list) {
      list = [];
      this._events.set(type, list);
    }
    list.push(handler);
    return () => this.off(type, handler);
  }

  once(type: string, handler: (payload: unknown) => void): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type: string, handler: (payload: unknown) => void): this {
    const list = this._events.get(type);
    if (!list) return this;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
    if (!list.length) this._events.delete(type);
    return this;
  }

  private _emit(type: string, payload: unknown): void {
    const list = this._events.get(type);
    if (!list || !list.length) return;
    for (const handler of list.slice()) {
      try {
        handler(payload);
      } catch (error) {
        console.error(error);
      }
    }
  }

  private _emitState(): void {
    this._emit("state", this.getState());
  }

  private _emitAngle(): void {
    const snapshot = this.engine.getSnapshot();
    this._emit("angle", {
      angle: snapshot.angle,
      target: snapshot.targetAngle,
      axis: snapshot.axis,
      frameIndex: snapshot.frameIndex,
    });
  }

  private _emitFrame(index: number): void {
    const snapshot = this.engine.getSnapshot();
    this._emit("frame", { index, count: snapshot.frameCount, frameDeg: snapshot.frameDeg });
  }

  getConfig(): OrbitEngineConfig {
    return this.engine.getConfig();
  }

  getMeta(): Bundle["meta"] | null {
    return this._meta ? clone(this._meta) : null;
  }

  getState(): MiniClientState {
    const snapshot = this.engine.getSnapshot();
    const config = this.engine.getConfig();
    return {
      ready: this._ready,
      loading: this._loading,
      paused: this._paused,
      destroyed: this._destroyed,
      format: this._format,
      quality: this._quality,
      codec: this._codec,
      title: config.title || "环绕视角",
      angle: snapshot.angle,
      target: snapshot.targetAngle,
      targetAngle: snapshot.targetAngle,
      axis: snapshot.axis,
      direction: snapshot.direction,
      spanDeg: snapshot.spanDeg,
      limits: { min: snapshot.minAngle, max: snapshot.maxAngle, limited: snapshot.limited },
      velocity: snapshot.velocity,
      frameIndex: snapshot.frameIndex,
      frameCount: snapshot.frameCount,
      frameDeg: snapshot.frameDeg,
      degPerFrame: snapshot.frameDeg,
      dragging: snapshot.dragging,
      missingFrames: this._countMissingFrames(),
      auto: snapshot.auto,
      gyro: {
        ...snapshot.gyro,
        pending: this._gyroPending,
        absolute: false,
        supported: this.isGyroSupported(),
      },
      inertia: config.drag.inertia,
      invert: config.drag.invert,
      fit: config.video.fit,
      mouseFollow: {
        enabled: config.mouseFollow.enabled,
        degPerPx: config.mouseFollow.degPerPx,
      },
      progress: {
        progress: this._progress,
        loaded: this._loaded,
        total: this._total,
        phase: this._phase,
      },
      viewport: { width: this._viewW, height: this._viewH, dpr: this._dpr },
      canvas: {
        width: this._canvasW,
        height: this._canvasH,
        frameWidth: this._frameW,
        frameHeight: this._frameH,
      },
      config: this.getConfig(),
      meta: this.getMeta(),
    };
  }

  getAngle(): number {
    return this.engine.getAngle();
  }

  getTargetAngle(): number {
    return this.engine.getTargetAngle();
  }

  getFrameIndex(): number {
    return this.engine.getFrameIndex();
  }

  getFrameCount(): number {
    return this.engine.getFrameCount();
  }

  setConfig(partial: Record<string, unknown>): this {
    this.engine.setConfig(partial);
    if (partial.video || partial.orbit) this._layout();
    this._emitState();
    return this;
  }

  resetConfig(): this {
    this.engine.resetConfig();
    this._layout();
    this._emitState();
    return this;
  }

  setAngle(deg: number, options: { immediate?: boolean } = {}): this {
    this.engine.setAngle(deg, options.immediate === true);
    if (options.immediate) this._paint(true);
    this._emitAngle();
    this._emitState();
    return this;
  }

  rotateBy(deg: number): this {
    this.engine.rotateBy(deg);
    this._emitState();
    return this;
  }

  reset(angle = 0, options: { immediate?: boolean } = {}): this {
    this.engine.reset(angle, options.immediate !== false);
    this._paint(true);
    this._emitAngle();
    this._emitState();
    return this;
  }

  setAutoRotate(
    value: boolean | string | { enabled?: boolean; dir?: string },
    direction?: string,
  ): string {
    let enabled = !!value;
    let dir = direction;
    if (typeof value === "string") {
      if (value === "off" || value === "false") enabled = false;
      else if (value === "on" || value === "true") enabled = true;
      else if (value === "cw" || value === "ccw") {
        enabled = true;
        dir = value;
      } else throw new Error("setAutoRotate: 期望 off / on / cw / ccw");
    } else if (value && typeof value === "object") {
      enabled = !!value.enabled;
      if (typeof value.dir === "string") dir = value.dir;
    }
    const auto: { enabled: boolean; dir?: string } = { enabled };
    if (dir) {
      if (dir !== "cw" && dir !== "ccw") throw new Error("setAutoRotate: dir 必须是 cw / ccw");
      auto.dir = dir;
    }
    this.setConfig({ auto });
    return this.engine.getSnapshot().auto.state;
  }

  setAuto(value: boolean | string | { enabled?: boolean; dir?: string }): string {
    return this.setAutoRotate(value);
  }

  stopAuto(): this {
    this.setAutoRotate(false);
    return this;
  }

  cycleAuto(): string {
    const state = this.engine.getSnapshot().auto.state;
    const next = state === "off" ? "cw" : state === "cw" ? "ccw" : "off";
    this.setAutoRotate(next);
    return next;
  }

  setAutoSpeed(degPerSec: number): this {
    return this.setAutoConfig({ degPerSec });
  }

  setAutoConfig(partial: Record<string, unknown>): this {
    return this.setConfig({ auto: partial });
  }

  setGyroConfig(partial: Record<string, unknown>): this {
    return this.setConfig({ gyro: partial });
  }

  setDragConfig(partial: Record<string, unknown>): this {
    return this.setConfig({ drag: partial });
  }

  setMotionConfig(partial: Record<string, unknown>): this {
    return this.setConfig({ motion: partial });
  }

  setOrbitConfig(partial: Record<string, unknown>): this {
    return this.setConfig({ orbit: partial });
  }

  setVideoConfig(partial: Record<string, unknown>): this {
    return this.setConfig({ video: partial });
  }

  setInertia(enabled: boolean): this {
    return this.setDragConfig({ inertia: !!enabled });
  }

  setInvert(enabled: boolean): this {
    return this.setDragConfig({ invert: !!enabled });
  }

  setFit(mode: "contain" | "cover"): this {
    if (mode !== "contain" && mode !== "cover") throw new Error("setFit: 期望 contain / cover");
    return this.setVideoConfig({ fit: mode });
  }

  setMouseFollow(value: boolean | Record<string, unknown>): this {
    if (typeof value === "boolean") return this.setConfig({ mouseFollow: { enabled: value } });
    return this.setConfig({ mouseFollow: value });
  }

  /* ---------- loading ---------- */

  async load(
    source: string | ArrayBuffer | ArrayBufferView | { path?: string },
    options: { quality?: string } = {},
  ): Promise<this> {
    const normalized = normalizeSource(source);
    const token = ++this._loadToken;
    this._loading = true;
    this._ready = false;
    this._phase = "load";
    this._loaded = 0;
    this._total = 0;
    this._setProgress(0, "load", 0, 0);
    this._emit("loadstart", { source: normalized });
    this._emitState();

    try {
      let buffer: ArrayBuffer;
      if (typeof normalized === "string") {
        this._setProgress(0.03, "fetch", 0, 0);
        buffer = await this._readSource(normalized);
        this._setProgress(0.38, "fetch", 0, 0);
      } else if (normalized instanceof ArrayBuffer) {
        buffer = normalized;
        this._setProgress(0.38, "read", 0, 0);
      } else if (ArrayBuffer.isView(normalized)) {
        const copy = new Uint8Array(normalized.byteLength);
        copy.set(new Uint8Array(normalized.buffer, normalized.byteOffset, normalized.byteLength));
        buffer = copy.buffer;
        this._setProgress(0.38, "read", 0, 0);
      } else {
        throw new Error("load: 需要 URL / 本地路径 / ArrayBuffer / Uint8Array");
      }

      if (token !== this._loadToken || this._destroyed) return this;
      const bundle = parseOrb(buffer);
      if (token !== this._loadToken || this._destroyed) return this;
      await this._loadBundle(bundle, token, options);
      if (token !== this._loadToken || this._destroyed) return this;

      this._loading = false;
      this._ready = true;
      this._phase = "ready";
      this._loaded = this._total;
      this._setProgress(1, "ready", this._loaded, this._total);
      this.resize();
      this._emitAngle();
      this._emitFrame(this.engine.getFrameIndex());
      this._emit("ready", {
        meta: this.getMeta(),
        config: this.getConfig(),
        state: this.getState(),
      });
      this._emitState();
      return this;
    } catch (error) {
      if (token === this._loadToken && !this._destroyed) {
        this._loading = false;
        this._ready = false;
        this._phase = "error";
        this._emit("error", error);
        this._emitState();
      }
      throw error;
    }
  }

  loadUrl(url: string, options: { quality?: string } = {}): Promise<this> {
    return this.load(url, options);
  }

  loadFile(filePath: string, options: { quality?: string } = {}): Promise<this> {
    return this.load(filePath, options);
  }

  loadBuffer(buffer: ArrayBuffer, options: { quality?: string } = {}): Promise<this> {
    return this.load(buffer, options);
  }

  unload(): this {
    this._loadToken++;
    this._meta = null;
    this._format = null;
    this._quality = null;
    this._codec = null;
    this._layers = [];
    this._canvasW = 0;
    this._canvasH = 0;
    this._frameW = 0;
    this._frameH = 0;
    this._ready = false;
    this._loading = false;
    this._paused = false;
    this._progress = 0;
    this._loaded = 0;
    this._total = 0;
    this._drawnIndex = -1;
    this.engine.unload();
    this._layout();
    this._emitState();
    return this;
  }

  private async _loadBundle(
    bundle: Bundle,
    token: number,
    options: { quality?: string },
  ): Promise<void> {
    const meta = bundle.meta;
    const layers: MiniLayer[] = [];
    const jobs: Array<{
      run: () => Promise<MiniImage | null>;
      set: (image: MiniImage | null) => void;
    }> = [];
    meta.videos.forEach((video, videoIndex) => {
      const frames: Array<FrameImage | null> = Array.from({ length: video.frames.count });
      layers.push({ rect: video.rect, frames, count: video.frames.count });
      for (let frameIndex = 0; frameIndex < video.frames.count; frameIndex++) {
        jobs.push({
          run: async () => {
            try {
              return await this._loadFrameImage(bundle, videoIndex, frameIndex);
            } catch {
              return null;
            }
          },
          set: (image) => {
            if (!image) {
              frames[frameIndex] = null;
              return;
            }
            frames[frameIndex] = {
              img: image,
              sx: 0,
              sy: 0,
              sw: Number(image.width) || video.frames.width || video.rect.width,
              sh: Number(image.height) || video.frames.height || video.rect.height,
            };
          },
        });
      }
    });

    this._total = jobs.length;
    this._loaded = 0;
    await this._decodeJobs(jobs, token, 0.4, 0.98);
    if (token !== this._loadToken) return;

    this._meta = meta;
    this._format = "orb";
    this._quality = options.quality || null;
    this._codec = meta.codec || null;
    this._canvasW = meta.canvas.width;
    this._canvasH = meta.canvas.height;
    this._frameW = this._canvasW;
    this._frameH = this._canvasH;
    this._layers = layers;
    this.engine.load({
      canvas: meta.canvas,
      initialAngle: meta.initialAngle,
      videos: bundle.layers.map((layer) => ({ rect: layer.rect, frameCount: layer.frameCount })),
      sceneConfig: bundle.sceneConfig,
    });
  }

  private _loadImage(src: string): Promise<MiniImage | null> {
    return new Promise((resolve) => {
      const image = this.canvas.createImage();
      let done = false;
      const finish = (value: MiniImage | null) => {
        if (done) return;
        done = true;
        resolve(value);
      };
      image.onload = () => setTimeout(() => finish(image), 0);
      image.onerror = () => finish(null);
      image.src = src;
    });
  }

  private async _loadFrameImage(
    bundle: Bundle,
    videoIndex: number,
    frameIndex: number,
  ): Promise<MiniImage | null> {
    const fs = this._platform.api.getFileSystemManager?.();
    const userDataPath = this._platform.api.env?.USER_DATA_PATH;
    if (this.options.frameSource !== "data-url" && fs && userDataPath) {
      try {
        if (!this._tempDirPromise) {
          this._tempDirPromise = new Promise<string>((resolve) => {
            const dir = `${userDataPath}/orbit360-frames`;
            fs.mkdir({
              dirPath: dir,
              recursive: true,
              success: () => resolve(dir),
              fail: () => resolve(dir),
            });
          });
        }
        const dir = await this._tempDirPromise;
        const ext = extForCodec(String(bundle.meta.codec || ""));
        const filePath = `${dir}/${this._loadToken}-${videoIndex}-${frameIndex}.${ext}`;
        const bytes = bundle.frameBytes(videoIndex, frameIndex);
        await new Promise<void>((resolve, reject) => {
          fs.writeFile({
            filePath,
            data: bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
            success: () => resolve(),
            fail: reject,
          });
        });
        const image = await this._loadImage(filePath);
        if (image) return image;
      } catch {
        /* fall through to data URL */
      }
    }
    return await this._loadImage(bundle.frameDataUrl(videoIndex, frameIndex));
  }

  private async _decodeJobs(
    jobs: Array<{ run: () => Promise<MiniImage | null>; set: (image: MiniImage | null) => void }>,
    token: number,
    from: number,
    to: number,
  ): Promise<void> {
    const total = Math.max(1, jobs.length);
    let done = 0;
    let next = 0;
    const concurrency = Math.max(1, Number(this.options.concurrency) || 6);
    const worker = async () => {
      while (next < jobs.length) {
        if (token !== this._loadToken || this._destroyed) return;
        const job = jobs[next++];
        const image = await job.run();
        if (token !== this._loadToken || this._destroyed) return;
        job.set(image);
        done++;
        this._setProgress(from + (done / total) * (to - from), "decode", done, total);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  private async _readSource(source: string): Promise<ArrayBuffer> {
    if (source.startsWith("data:")) {
      const comma = source.indexOf(",");
      if (comma < 0) throw new Error("data URL 格式不正确");
      return base64ToBuffer(source.slice(comma + 1));
    }
    if (
      /^https?:\/\//i.test(source) &&
      !this._platform.localPathPrefixes.some((prefix) => source.startsWith(prefix))
    ) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        this._platform.api.request({
          url: source,
          method: "GET",
          responseType: "arraybuffer",
          dataType: "其他",
          timeout: 60000,
          success: (result) => {
            if (
              result.statusCode >= 200 &&
              result.statusCode < 300 &&
              result.data instanceof ArrayBuffer
            ) {
              resolve(result.data);
            } else {
              reject(new Error(`包下载失败（HTTP ${result.statusCode}）`));
            }
          },
          fail: (error) => reject(new Error(error.errMsg || "网络请求失败")),
        });
      });
    }
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const fs = this._platform.api.getFileSystemManager();
      const candidates = [source];
      if (source.startsWith("/")) candidates.push(source.slice(1));
      else candidates.push(`/${source}`);
      let index = 0;
      let lastError: MiniError | null = null;
      const tryNext = () => {
        if (index >= candidates.length) {
          reject(new Error(lastError?.errMsg || `读取文件失败：${source}`));
          return;
        }
        fs.readFile({
          filePath: candidates[index++],
          success: (result) => resolve(result.data),
          fail: (error) => {
            lastError = error;
            tryNext();
          },
        });
      };
      tryNext();
    });
  }

  private _setProgress(progress: number, phase: string, loaded: number, total: number): void {
    this._progress = Math.max(0, Math.min(1, Number(progress) || 0));
    this._phase = phase;
    this._loaded = loaded;
    this._total = total;
    this._emit("progress", { progress: this._progress, phase, loaded, total });
  }

  private _countMissingFrames(): number {
    let missing = 0;
    for (const layer of this._layers) for (const frame of layer.frames) if (!frame) missing++;
    return missing;
  }

  /* ---------- canvas ---------- */

  resize(width?: number, height?: number): this {
    if (typeof width === "number" && width > 0) this._viewW = width;
    if (typeof height === "number" && height > 0) this._viewH = height;
    if (!this._viewW || !this._viewH) {
      const size = miniWindowSize(this._platform.api);
      this._viewW = this._viewW || size.width || 1;
      this._viewH = this._viewH || size.height || 1;
    }
    const cap = Number(this.options.dprCap) || 2;
    const dpr = Math.min(this._systemDpr || 1, cap);
    this._dpr = dpr;
    const backingWidth = Math.round(this._viewW * dpr);
    const backingHeight = Math.round(this._viewH * dpr);
    const resized = this.canvas.width !== backingWidth || this.canvas.height !== backingHeight;
    if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
    if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
    if (resized) {
      const ctx = this.canvas.getContext("2d");
      if (ctx) this.ctx = ctx;
    }
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "medium";
    this._layout();
    return this;
  }

  setViewport(width: number, height: number): this {
    return this.resize(width, height);
  }

  private _fillBackdrop(): void {
    const width = this._viewW;
    const height = this._viewH;
    const gradient = this.ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      0,
      width * 0.5,
      height * 0.42,
      Math.max(width, height) * 0.78,
    );
    gradient.addColorStop(0, "#1b1f27");
    gradient.addColorStop(0.62, "#0a0b0e");
    gradient.addColorStop(1, "#050608");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  private _layout(): void {
    if (!this._viewW || !this._viewH) return;
    const config = this.engine.getConfig();
    const width = this._canvasW || this._frameW || config.video.width || 1280;
    const height = this._canvasH || this._frameH || config.video.height || 720;
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._fillBackdrop();
    this._drawnIndex = -1;
    if (this._layers.length) this._paint(true);
  }

  private _paint(force = false): void {
    if (!this._layers.length) return;
    const snapshot = this.engine.getSnapshot();
    if (!force && snapshot.frameIndex === this._drawnIndex) return;
    this._drawnIndex = snapshot.frameIndex;
    const config = this.engine.getConfig();
    const width = this._canvasW || this._frameW || config.video.width || 1280;
    const height = this._canvasH || this._frameH || config.video.height || 720;
    const plan = computeLayout({
      canvas: { width, height },
      viewport: { width: this._viewW, height: this._viewH },
      fit: config.video.fit,
      displayScale: config.video.displayScale,
      portraitScale: config.video.portraitScale,
      layers: this._layers.map((layer, layerIndex) => ({ layerIndex, rect: layer.rect })),
    });
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    for (let layerIndex = 0; layerIndex < this._layers.length; layerIndex++) {
      const layer = this._layers[layerIndex];
      const layerSnapshot = snapshot.layers[layerIndex];
      const destination = plan.layers[layerIndex]?.rect;
      if (!layerSnapshot || !destination) continue;
      const frame = layer.frames[layerSnapshot.frameIndex];
      if (!frame) continue;
      this.ctx.drawImage(
        frame.img,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        destination.x,
        destination.y,
        destination.width,
        destination.height,
      );
    }
    this._emitFrame(snapshot.frameIndex);
  }

  private _loop(): void {
    if (this._destroyed || this._paused) return;
    const time = this._platform.now();
    const dt = this._lastT ? Math.min(time - this._lastT, 64) : 0;
    this._lastT = time;
    this.engine.advance(dt);
    this._paint();
    const snapshot = this.engine.getSnapshot();
    if (snapshot.angle !== this._lastEmittedAngle) {
      this._lastEmittedAngle = snapshot.angle;
      this._emitAngle();
    }
    this._raf = this.canvas.requestAnimationFrame(() => this._loop());
  }

  /* ---------- touch ---------- */

  private _touchPoint(event: MiniTouchEvent): TouchPoint | null {
    const list = event?.touches || event?.changedTouches || [];
    const touch = list[0];
    if (!touch) return null;
    const x = typeof touch.x === "number" ? touch.x : touch.clientX;
    const y = typeof touch.y === "number" ? touch.y : touch.clientY;
    if (typeof x !== "number" || typeof y !== "number") return null;
    return { x, y, t: event.timeStamp || this._platform.now() };
  }

  touchStart(event: MiniTouchEvent): this {
    const point = this._touchPoint(event);
    if (!point) return this;
    if (this._gyroPending) {
      this._gyroPending = false;
      void this.enableGyro();
    }
    this.engine.pointerDown(point.x, point.y, point.t);
    this._emit("dragstart", { pointerType: "touch" });
    clearTimeout(this._pressTimer ?? undefined);
    this._pressTimer = null;
    this._pressStart = { x: point.x, y: point.y };
    this._pressTimer = setTimeout(() => {
      this._pressTimer = null;
      this._suppressMove = true;
      this.engine.pointerUp(this._platform.now());
      this._emit("longpress", {});
      this._emitState();
    }, 420);
    this._emitState();
    return this;
  }

  touchMove(event: MiniTouchEvent): this {
    const point = this._touchPoint(event);
    if (!point) return this;
    if (this._pressStart) {
      if (Math.hypot(point.x - this._pressStart.x, point.y - this._pressStart.y) > 8) {
        clearTimeout(this._pressTimer ?? undefined);
        this._pressTimer = null;
        this._pressStart = null;
      }
    }
    if (this._suppressMove) return this;
    this.engine.pointerMove(point.x, point.y, point.t);
    this._emitState();
    return this;
  }

  touchEnd(event?: MiniTouchEvent): this {
    clearTimeout(this._pressTimer ?? undefined);
    this._pressTimer = null;
    this._pressStart = null;
    if (this._suppressMove) {
      this._suppressMove = false;
      this._emitState();
      return this;
    }
    if (!this.engine.getSnapshot().dragging) return this;
    this.engine.pointerUp(event?.timeStamp || this._platform.now());
    this._emit("dragend", { velocity: this.engine.getSnapshot().velocity });
    this._emitState();
    return this;
  }

  touchCancel(event?: MiniTouchEvent): this {
    return this.touchEnd(event);
  }

  /* ---------- gyro ---------- */

  isGyroSupported(): boolean {
    const api = this._platform.api;
    return (
      typeof api.startDeviceMotionListening === "function" &&
      typeof api.onDeviceMotionChange === "function"
    );
  }

  private _initAutoGyro(): void {
    if (this._destroyed || !this.isGyroSupported()) return;
    this._gyroPending = true;
    this._emit("gyrochange", {
      enabled: false,
      pending: true,
      reason: "permission",
      state: this.getState(),
    });
    this._emitState();
  }

  enableGyro(): Promise<boolean> {
    if (this.engine.getSnapshot().gyro.enabled) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      if (!this.isGyroSupported()) {
        this._gyroPending = false;
        this._emit("gyrochange", {
          enabled: false,
          pending: false,
          reason: "unsupported",
          state: this.getState(),
        });
        this._emitState();
        resolve(false);
        return;
      }
      this._platform.api.startDeviceMotionListening({
        interval: this.options.deviceMotionInterval || "game",
        success: () => {
          this._orientation = screenOrientation(this._platform.api);
          this._platform.api.onDeviceMotionChange(this._motionHandler);
          this.engine.enableGyro();
          this._gyroPending = false;
          this._gyroSeen = false;
          this._emit("gyrochange", {
            enabled: true,
            pending: false,
            reason: "enabled",
            state: this.getState(),
          });
          this._emitState();
          clearTimeout(this._gyroTimer ?? undefined);
          this._gyroTimer = setTimeout(() => {
            if (this._destroyed || this._gyroSeen) return;
            this._stopGyro("no-readings");
          }, 2200);
          resolve(true);
        },
        fail: (error) => {
          this._gyroPending = false;
          this._emit("gyrochange", {
            enabled: false,
            pending: false,
            reason: "error",
            error,
            state: this.getState(),
          });
          this._emitState();
          resolve(false);
        },
      });
    });
  }

  disableGyro(): this {
    this._stopGyro("disabled");
    return this;
  }

  private _stopGyro(reason: string): void {
    clearTimeout(this._gyroTimer ?? undefined);
    this._gyroTimer = null;
    const wasEnabled = this.engine.getSnapshot().gyro.enabled;
    if (wasEnabled) {
      try {
        this._platform.api.offDeviceMotionChange(this._motionHandler);
        this._platform.api.stopDeviceMotionListening();
      } catch {
        /* ignore */
      }
    }
    this.engine.disableGyro();
    this._gyroPending = false;
    if (wasEnabled || reason === "no-readings") {
      this._emit("gyrochange", {
        enabled: false,
        pending: false,
        reason,
        state: this.getState(),
      });
      this._emitState();
    }
  }

  calibrateGyro(): this {
    this.engine.calibrateGyro();
    return this;
  }

  private _handleMotion(event: MiniMotionEvent): void {
    const snapshot = this.engine.getSnapshot();
    const heading = snapshot.axis === "y" ? pitchOf(event) : headingOf(event, this._orientation);
    if (heading === null) return;
    this._gyroSeen = true;
    clearTimeout(this._gyroTimer ?? undefined);
    this._gyroTimer = null;
    this.engine.gyro({ heading, timeMs: this._platform.now() });
    this._emitState();
  }

  /* ---------- lifecycle ---------- */

  pause(): this {
    if (this._paused) return this;
    this._paused = true;
    this.engine.pause();
    this.canvas.cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._emitState();
    return this;
  }

  resume(): this {
    if (!this._paused || this._destroyed) return this;
    this._paused = false;
    this._lastT = 0;
    this.engine.resume();
    this._raf = this.canvas.requestAnimationFrame(() => this._loop());
    this._emitState();
    return this;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._loadToken++;
    this.canvas.cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._stopGyro("destroyed");
    clearTimeout(this._pressTimer ?? undefined);
    this._pressTimer = null;
    const userDataPath = this._platform.api.env?.USER_DATA_PATH;
    if (userDataPath) {
      try {
        this._platform.api
          .getFileSystemManager()
          .rmdir?.({ dirPath: `${userDataPath}/orbit360-frames`, recursive: true });
      } catch {
        /* ignore */
      }
    }
    this.engine.destroy();
    this._layers = [];
    this._meta = null;
    this._ready = false;
    this._loading = false;
    this._emit("destroy", {});
    this._events.clear();
  }
}

export function queryCanvas(
  platform: MiniProgramPlatform,
  options: MiniClientOptions = {},
): Promise<{ node: MiniCanvasNode; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const selector = options.selector || "#orbit-canvas";
    const query = platform.api.createSelectorQuery();
    if (options.component && typeof query.in === "function") {
      try {
        query.in(options.component);
      } catch {
        /* Page instances do not support in() */
      }
    }
    query
      .select(selector)
      .fields({ node: true, size: true })
      .exec((result) => {
        const info = result?.[0];
        if (!info?.node) {
          reject(new Error(`找不到 Canvas 节点：${selector}`));
          return;
        }
        resolve({ node: info.node, width: info.width, height: info.height });
      });
  });
}

export function createMiniProgramClient(
  platform: MiniProgramPlatform,
  options: MiniClientOptions = {},
): Promise<MiniOrbitClient> {
  if (options.canvas) {
    return Promise.resolve(
      new MiniOrbitClient(
        options.canvas,
        {
          ...options,
          width: options.width || options.canvas._width,
          height: options.height || options.canvas._height,
        },
        platform,
      ),
    );
  }
  return queryCanvas(platform, options).then(
    (info) =>
      new MiniOrbitClient(
        info.node,
        { ...options, width: info.width || options.width, height: info.height || options.height },
        platform,
      ),
  );
}

export { DEFAULTS, VERSION };
