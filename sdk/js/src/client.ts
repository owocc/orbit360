/* Orbit360 web client — Canvas 2D adapter over the shared OrbitEngine.
 *
 * Only ORB3/v1 is supported. There is no ZIP path, no format probing and no
 * fallback: the core parser throws an OrbError with a stable code.
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
import { fromBlob, type Bundle } from "./orb";

const VERSION = "0.1.0";
const RAD = Math.PI / 180;

interface FrameImage {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface WebLayer {
  rect: Rect;
  count: number;
  frames: Array<FrameImage | null>;
}

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
  limits: { min: number; max: number; limited: boolean };
  velocity: number;
  frameIndex: number;
  frameCount: number;
  frameDeg: number;
  degPerFrame: number;
  dragging: boolean;
  missingFrames: number;
  auto: EngineSnapshot["auto"];
  gyro: EngineSnapshot["gyro"] & { pending: boolean; absolute: boolean; supported: boolean };
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

export interface LoadOptions {
  cache?: RequestCache;
  quality?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function loadImageBlob(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function isTouchDevice(): boolean {
  if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return true;
  if (typeof navigator === "undefined") return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function screenAngle(): number {
  const so = typeof screen !== "undefined" ? screen.orientation : null;
  if (so && typeof so.angle === "number") return ((so.angle % 360) + 360) % 360;
  return typeof window !== "undefined" && typeof window.orientation === "number"
    ? ((window.orientation % 360) + 360) % 360
    : 0;
}

function headingOf(event: DeviceOrientationEvent): number | null {
  const compass = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading;
  if (typeof compass === "number" && !Number.isNaN(compass) && compass >= 0) return compass;
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
    const angle = screenAngle();
    return angle === 90 || angle === 270 ? alpha % 360 : (360 - alpha) % 360;
  }
  return (((Math.atan2(-vx, -vy) / RAD) % 360) + 360) % 360;
}

function pitchOf(event: DeviceOrientationEvent): number | null {
  return typeof event.beta === "number" && !Number.isNaN(event.beta) ? event.beta % 360 : null;
}

interface DeviceOrientationStatic {
  requestPermission?: () => Promise<PermissionState>;
}

export class Orbit360Client {
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

  private _events = new Map<string, Array<(payload: unknown) => void>>();
  private _layers: WebLayer[] = [];
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
  private _dpr = 1;
  private _drawnIndex = -1;
  private _lastT = 0;
  private _lastEmittedAngle = Number.NaN;
  private _raf = 0;
  private _visible = true;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _loading = false;
  private _ready = false;
  private _destroyed = false;
  private _paused = false;
  private _loadToken = 0;
  private _progress = 0;
  private _loaded = 0;
  private _total = 0;
  private _phase = "idle";
  private _lastPointerType = "";
  private _hoverX: number | null = null;
  private _hoverY: number | null = null;
  private _pressTimer: ReturnType<typeof setTimeout> | null = null;
  private _pressStart: { x: number; y: number } | null = null;
  private _suppressMove = false;
  private _resizeQueued = false;
  private _gyroPending = false;
  private _gyroTimer: ReturnType<typeof setTimeout> | null = null;
  private _gyroSeen = false;
  private _hasAbsolute = false;
  private _onResize: () => void;
  private _onPointerDown: (event: PointerEvent) => void;
  private _onPointerMove: (event: PointerEvent) => void;
  private _onPointerUp: (event: PointerEvent) => void;
  private _onPointerLeave: () => void;
  private _onDblClick: (event: MouseEvent) => void;
  private _onContextMenu: (event: MouseEvent) => void;
  private _onAbsolute: (event: DeviceOrientationEvent) => void;
  private _onRelative: (event: DeviceOrientationEvent) => void;
  private _resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, options: Orbit360ClientOptions = {}) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new Error("Orbit360Client: 需要 canvas 元素");
    }
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Orbit360Client: 无法获取 2D context");
    this.ctx = ctx;
    this.options = {
      dprCap: 2,
      autoStartGyro: false,
      concurrency: 6,
      dragClass: "dragging",
      preventContextMenu: true,
      ...options,
    };
    this.container = options.container || canvas.parentElement || canvas;
    this.input = options.input || this.container;
    this.dragTarget = options.dragClassTarget || this.input;

    this.engine = createEngine(
      { canvas: { width: 0, height: 0 }, videos: [] },
      { config: options.config || {} },
    );
    this.engine.unload();

    this._onResize = () => this._queueResize();
    this._onPointerDown = (event) => this._handlePointerDown(event);
    this._onPointerMove = (event) => this._handlePointerMove(event);
    this._onPointerUp = (event) => this._handlePointerUp(event);
    this._onPointerLeave = () => {
      this._hoverX = null;
      this._hoverY = null;
    };
    this._onDblClick = () => {
      if (this._lastPointerType === "touch") return;
      this._emit("doubletap", {});
    };
    this._onContextMenu = (event) => {
      if (this.options.preventContextMenu) event.preventDefault();
    };
    this._onAbsolute = (event) => this._handleOrientation(event, true);
    this._onRelative = (event) => this._handleOrientation(event, false);

    this._bindEvents();
    this.resize();
    this._raf = requestAnimationFrame(this._loop);
    if (this.options.autoStartGyro) this._initAutoGyro();
  }

  /* ---------- events ---------- */

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
    this._emit("frame", {
      index,
      count: this.engine.getSnapshot().frameCount,
      frameDeg: this.engine.getSnapshot().frameDeg,
    });
  }

  /* ---------- config / state ---------- */

  getConfig(): OrbitEngineConfig {
    return this.engine.getConfig();
  }

  getMeta(): Bundle["meta"] | null {
    return this._meta ? clone(this._meta) : null;
  }

  getState(): Orbit360ClientState {
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
        absolute: this._hasAbsolute,
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
    } else if (isPlainObject(value)) {
      enabled = !!value.enabled;
      if (value.dir) dir = value.dir as string;
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
    source: string | Blob | ArrayBuffer | ArrayBufferView,
    options: LoadOptions = {},
  ): Promise<this> {
    const token = ++this._loadToken;
    this._loading = true;
    this._ready = false;
    this._phase = "load";
    this._loaded = 0;
    this._total = 0;
    this._setProgress(0, "load", 0, 0);
    this._emit("loadstart", { source });
    this._emitState();

    try {
      let blob: Blob;
      if (typeof source === "string") {
        this._setProgress(0.03, "fetch", 0, 0);
        const response = await fetch(source, { cache: options.cache || "default" });
        if (!response.ok) throw new Error(`包下载失败（HTTP ${response.status}）`);
        this._setProgress(0.12, "fetch", 0, 0);
        blob = await response.blob();
        this._setProgress(0.38, "fetch", 0, 0);
      } else if (typeof Blob !== "undefined" && source instanceof Blob) {
        blob = source;
        this._setProgress(0.38, "read", 0, 0);
      } else if (source instanceof ArrayBuffer) {
        blob = new Blob([source]);
        this._setProgress(0.38, "read", 0, 0);
      } else if (ArrayBuffer.isView(source)) {
        const copy = new Uint8Array(source.byteLength);
        copy.set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
        blob = new Blob([copy.buffer]);
        this._setProgress(0.38, "read", 0, 0);
      } else {
        throw new Error("load: 需要 URL / Blob / File / ArrayBuffer");
      }

      if (token !== this._loadToken || this._destroyed) return this;
      const orb = await fromBlob(blob);
      if (token !== this._loadToken || this._destroyed) return this;

      const meta = orb.meta;
      const layers: WebLayer[] = [];
      const jobs: Array<{
        run: () => Promise<HTMLImageElement | null>;
        set: (img: HTMLImageElement | null) => void;
      }> = [];
      meta.videos.forEach((video, videoIndex) => {
        const frames: Array<FrameImage | null> = Array.from({ length: video.frames.count });
        layers.push({ rect: video.rect, frames, count: video.frames.count });
        for (let frameIndex = 0; frameIndex < video.frames.count; frameIndex++) {
          jobs.push({
            run: () => loadImageBlob(orb.frameBlob(videoIndex, frameIndex)),
            set: (img) => {
              frames[frameIndex] = img
                ? {
                    img,
                    sx: 0,
                    sy: 0,
                    sw: video.frames.width ?? video.rect.width,
                    sh: video.frames.height ?? video.rect.height,
                  }
                : null;
            },
          });
        }
      });

      this._total = jobs.length;
      this._loaded = 0;
      await this._decodeJobs(jobs, token, 0.4, 0.98);
      if (token !== this._loadToken || this._destroyed) return this;

      this._meta = meta;
      this._format = "orb";
      this._quality = options.quality || null;
      this._codec = meta.codec || null;
      this._canvasW = meta.canvas.width;
      this._canvasH = meta.canvas.height;
      this._frameW = meta.canvas.width;
      this._frameH = meta.canvas.height;
      this._layers = layers;
      this.engine.load({
        canvas: meta.canvas,
        initialAngle: meta.initialAngle,
        videos: orb.layers.map((layer) => ({ rect: layer.rect, frameCount: layer.frameCount })),
        sceneConfig: orb.sceneConfig,
      });

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

  loadUrl(url: string, options: LoadOptions = {}): Promise<this> {
    return this.load(url, options);
  }

  loadBlob(blob: Blob, options: LoadOptions = {}): Promise<this> {
    return this.load(blob, options);
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

  private async _decodeJobs(
    jobs: Array<{
      run: () => Promise<HTMLImageElement | null>;
      set: (img: HTMLImageElement | null) => void;
    }>,
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
        const img = await job.run();
        if (token !== this._loadToken || this._destroyed) return;
        job.set(img);
        done++;
        this._setProgress(from + (done / total) * (to - from), "decode", done, total);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
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
    for (const layer of this._layers) {
      for (const frame of layer.frames) if (!frame) missing++;
    }
    return missing;
  }

  /* ---------- canvas / layout ---------- */

  resize(): this {
    const width =
      this.container.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0) || 1;
    const height =
      this.container.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || 1;
    const cap = Number(this.options.dprCap) || 2;
    const dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, cap);
    this._dpr = dpr;
    this._viewW = width;
    this._viewH = height;
    const backingWidth = Math.round(width * dpr);
    const backingHeight = Math.round(height * dpr);
    if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
    if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "medium";
    this._layout();
    return this;
  }

  private _queueResize(): void {
    if (this._resizeQueued) return;
    this._resizeQueued = true;
    requestAnimationFrame(() => {
      this._resizeQueued = false;
      this.resize();
    });
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
    if (!this._layers.length) {
      this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      this._fillBackdrop();
      this._drawnIndex = -1;
      return;
    }
    const plan = computeLayout({
      canvas: { width, height },
      viewport: { width: this._viewW, height: this._viewH },
      fit: config.video.fit,
      displayScale: config.video.displayScale,
      portraitScale: config.video.portraitScale,
      layers: this._layers.map((layer, index) => ({ layerIndex: index, rect: layer.rect })),
    });
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._fillBackdrop();
    this._drawnIndex = -1;
    this._paint(true, plan);
  }

  private _paint(force = false, planOverride?: ReturnType<typeof computeLayout>): void {
    if (!this._layers.length) return;
    const snapshot = this.engine.getSnapshot();
    const index = snapshot.frameIndex;
    if (!force && index === this._drawnIndex) return;
    this._drawnIndex = index;

    const config = this.engine.getConfig();
    const width = this._canvasW || this._frameW || config.video.width || 1280;
    const height = this._canvasH || this._frameH || config.video.height || 720;
    const plan =
      planOverride ||
      computeLayout({
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
      const layerFrame = snapshot.layers[layerIndex];
      if (!layerFrame) continue;
      const frame = layer.frames[layerFrame.frameIndex];
      const destination = plan.layers[layerIndex]?.rect;
      if (!frame || !destination) continue;
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
    this._emitFrame(index);
  }

  /* ---------- main loop ---------- */

  private _loop = (time: number): void => {
    if (this._destroyed || this._paused) return;
    if (!this._visible) {
      this._raf = 0;
      return;
    }
    const dt = this._lastT ? Math.min(time - this._lastT, 64) : 0;
    this._lastT = time;
    this.engine.advance(dt);
    this._paint();
    const snapshot = this.engine.getSnapshot();
    if (snapshot.angle !== this._lastEmittedAngle) {
      this._lastEmittedAngle = snapshot.angle;
      this._emitAngle();
    }
    this._raf = requestAnimationFrame(this._loop);
  };

  private _bindEvents(): void {
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", this._onResize);
    if (typeof ResizeObserver === "function") {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.container);
    }
    if (typeof IntersectionObserver === "function") {
      this._intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (entry) this._setVisible(entry.isIntersecting);
      });
      this._intersectionObserver.observe(this.container);
    }
    this.input.addEventListener("pointerdown", this._onPointerDown);
    this.input.addEventListener("pointermove", this._onPointerMove);
    this.input.addEventListener("pointerup", this._onPointerUp);
    this.input.addEventListener("pointercancel", this._onPointerUp);
    this.input.addEventListener("pointerleave", this._onPointerLeave);
    this.input.addEventListener("dblclick", this._onDblClick);
    this.input.addEventListener("contextmenu", this._onContextMenu);
  }

  private _setVisible(visible: boolean): void {
    if (visible === this._visible || this._destroyed) return;
    this._visible = visible;
    if (visible) {
      if (!this._paused && !this._raf) {
        this._lastT = 0;
        this._raf = requestAnimationFrame(this._loop);
      }
    } else {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  private _pointerTime(event: PointerEvent | MouseEvent): number {
    return typeof event.timeStamp === "number" ? event.timeStamp : performance.now();
  }

  private _handlePointerDown(event: PointerEvent): void {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === "mouse") return;
    this._lastPointerType = event.pointerType || "";
    if (this._gyroPending) {
      this._gyroPending = false;
      void this.enableGyro();
    }
    this._hoverX = null;
    this._hoverY = null;
    this.engine.pointerDown(event.clientX, event.clientY, this._pointerTime(event));
    this.dragTarget.classList.add(this.options.dragClass);
    try {
      this.input.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events have no active pointer */
    }
    this._emit("dragstart", { pointerType: event.pointerType || "" });

    clearTimeout(this._pressTimer ?? undefined);
    this._pressTimer = null;
    this._pressStart = { x: event.clientX, y: event.clientY };
    if (event.pointerType !== "mouse") {
      this._pressTimer = setTimeout(() => {
        this._pressTimer = null;
        this._suppressMove = true;
        this.engine.pointerUp(performance.now());
        this.dragTarget.classList.remove(this.options.dragClass);
        this._emit("longpress", {});
        this._emitState();
      }, 420);
    }
    this._emitState();
  }

  private _handlePointerMove(event: PointerEvent): void {
    if (this._pressStart) {
      const dx = event.clientX - this._pressStart.x;
      const dy = event.clientY - this._pressStart.y;
      if (Math.hypot(dx, dy) > 8) {
        clearTimeout(this._pressTimer ?? undefined);
        this._pressTimer = null;
        this._pressStart = null;
      }
    }
    if (this._suppressMove) return;

    const snapshot = this.engine.getSnapshot();
    const config = this.engine.getConfig();
    if (!snapshot.dragging) {
      if (config.mouseFollow.enabled && event.pointerType === "mouse" && event.buttons === 0) {
        if (this._hoverX === null || this._hoverY === null) {
          this._hoverX = event.clientX;
          this._hoverY = event.clientY;
          return;
        }
        const dx = event.clientX - this._hoverX;
        const dy = event.clientY - this._hoverY;
        this._hoverX = event.clientX;
        this._hoverY = event.clientY;
        const px = snapshot.axis === "y" ? dy : dx;
        if (px) {
          const deg = px * config.mouseFollow.degPerPx * (config.drag.invert ? -1 : 1);
          this.engine.rotateBy(deg);
          this._emitState();
        }
      }
      return;
    }
    const scale = event.pointerType && event.pointerType !== "mouse" ? config.drag.touchScale : 1;
    this.engine.pointerMove(event.clientX, event.clientY, this._pointerTime(event), scale);
    this._emitState();
  }

  private _handlePointerUp(event: PointerEvent): void {
    clearTimeout(this._pressTimer ?? undefined);
    this._pressTimer = null;
    this._pressStart = null;
    this._hoverX = null;
    this._hoverY = null;
    this.dragTarget.classList.remove(this.options.dragClass);
    if (event && event.pointerId !== undefined && this.input.hasPointerCapture?.(event.pointerId)) {
      try {
        this.input.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (this._suppressMove) {
      this._suppressMove = false;
      this._emitState();
      return;
    }
    const wasDragging = this.engine.getSnapshot().dragging;
    if (!wasDragging) return;
    this.engine.pointerUp(this._pointerTime(event));
    this._emit("dragend", { velocity: this.engine.getSnapshot().velocity });
    this._emitState();
  }

  /* ---------- gyro ---------- */

  isGyroSupported(): boolean {
    return typeof DeviceOrientationEvent !== "undefined";
  }

  private _initAutoGyro(): void {
    if (!isTouchDevice() || !this.isGyroSupported()) return;
    const requestPermission = (DeviceOrientationEvent as unknown as DeviceOrientationStatic)
      .requestPermission;
    if (typeof requestPermission === "function") {
      this._gyroPending = true;
      this._emit("gyrochange", {
        enabled: false,
        pending: true,
        reason: "permission",
        state: this.getState(),
      });
      this._emitState();
    } else {
      void this.enableGyro();
    }
  }

  async enableGyro(): Promise<boolean> {
    if (this.engine.getSnapshot().gyro.enabled) return true;
    try {
      if (!this.isGyroSupported()) {
        const error = new Error("unsupported") as Error & { code?: string };
        error.code = "unsupported";
        throw error;
      }
      const requestPermission = (DeviceOrientationEvent as unknown as DeviceOrientationStatic)
        .requestPermission;
      if (typeof requestPermission === "function") {
        const permission = await requestPermission();
        if (permission !== "granted") {
          const error = new Error("permission denied") as Error & { code?: string };
          error.code = "denied";
          throw error;
        }
      }
      window.addEventListener("deviceorientationabsolute", this._onAbsolute, true);
      window.addEventListener("deviceorientation", this._onRelative, true);
      this.engine.enableGyro();
      this._gyroPending = false;
      this._gyroSeen = false;
      this._hasAbsolute = false;
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
      return true;
    } catch (error) {
      this._gyroPending = false;
      const code = (error as { code?: string }).code || "error";
      this._emit("gyrochange", {
        enabled: false,
        pending: false,
        reason: code,
        error,
        state: this.getState(),
      });
      this._emitState();
      return false;
    }
  }

  disableGyro(): this {
    this._stopGyro("disabled");
    return this;
  }

  private _stopGyro(reason: string): void {
    clearTimeout(this._gyroTimer ?? undefined);
    this._gyroTimer = null;
    if (this.engine.getSnapshot().gyro.enabled) {
      window.removeEventListener("deviceorientationabsolute", this._onAbsolute, true);
      window.removeEventListener("deviceorientation", this._onRelative, true);
    }
    const wasEnabled = this.engine.getSnapshot().gyro.enabled;
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

  private _handleOrientation(event: DeviceOrientationEvent, absolute: boolean): void {
    const snapshot = this.engine.getSnapshot();
    const heading = snapshot.axis === "y" ? pitchOf(event) : headingOf(event);
    if (heading === null) return;
    if (absolute) this._hasAbsolute = true;
    else if (this._hasAbsolute) return;

    this._gyroSeen = true;
    clearTimeout(this._gyroTimer ?? undefined);
    this._gyroTimer = null;
    this.engine.gyro({ heading, timeMs: performance.now() });
    this._emitState();
  }

  /* ---------- lifecycle ---------- */

  pause(): this {
    if (this._paused) return this;
    this._paused = true;
    this.engine.pause();
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._emitState();
    return this;
  }

  resume(): this {
    if (!this._paused || this._destroyed) return this;
    this._paused = false;
    this._lastT = 0;
    this.engine.resume();
    if (this._visible) this._raf = requestAnimationFrame(this._loop);
    this._emitState();
    return this;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._loadToken++;
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._stopGyro("destroyed");
    clearTimeout(this._pressTimer ?? undefined);
    this._pressTimer = null;
    this._resizeObserver?.disconnect();
    this._intersectionObserver?.disconnect();
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("orientationchange", this._onResize);
    this.input.removeEventListener("pointerdown", this._onPointerDown);
    this.input.removeEventListener("pointermove", this._onPointerMove);
    this.input.removeEventListener("pointerup", this._onPointerUp);
    this.input.removeEventListener("pointercancel", this._onPointerUp);
    this.input.removeEventListener("pointerleave", this._onPointerLeave);
    this.input.removeEventListener("dblclick", this._onDblClick);
    this.input.removeEventListener("contextmenu", this._onContextMenu);
    this.engine.destroy();
    this._layers = [];
    this._meta = null;
    this._ready = false;
    this._loading = false;
    this._emit("destroy", {});
    this._events.clear();
  }
}

export function createClient(
  canvas: HTMLCanvasElement,
  options?: Orbit360ClientOptions,
): Orbit360Client {
  return new Orbit360Client(canvas, options);
}

export { Orbit360Client as Client, VERSION, DEFAULTS };
export default Orbit360Client;
