import {
  createEngine,
  computeLayout,
  type OrbitEngine,
  type OrbitEngineConfig,
} from "../../core/src/index";
import { OrbBundle, type OrbitAxis, type OrbitDirection, type Rect } from "./orb";

export interface OrbitConfig {
  title: string;
  fit: "contain" | "cover";
  axis: OrbitAxis;
  spanDeg: number;
  direction: OrbitDirection;
  minAngle: number;
  maxAngle: number;
  dragDegPerPx: number;
  dragInvert: boolean;
  dragInertia: boolean;
  dragInertiaMs: number;
  motionSmoothMs: number;
  autoEnabled: boolean;
  autoDir: OrbitDirection;
  autoDegPerSec: number;
  autoIdleDelayMs: number;
  autoRampInMs: number;
  autoRampOutMs: number;
  gyroGain: number;
  gyroInvert: boolean;
  gyroSmooth: boolean;
  gyroSmoothMs: number;
  mouseFollowEnabled: boolean;
  mouseFollowDegPerPx: number;
}

export const DEFAULT_CONFIG: OrbitConfig = {
  title: "",
  fit: "contain",
  axis: "x",
  spanDeg: 360,
  direction: "cw",
  minAngle: -180,
  maxAngle: 180,
  dragDegPerPx: 0.42,
  dragInvert: false,
  dragInertia: true,
  dragInertiaMs: 110,
  motionSmoothMs: 62,
  autoEnabled: false,
  autoDir: "cw",
  autoDegPerSec: 14,
  autoIdleDelayMs: 2200,
  autoRampInMs: 700,
  autoRampOutMs: 280,
  gyroGain: 1,
  gyroInvert: false,
  gyroSmooth: true,
  gyroSmoothMs: 80,
  mouseFollowEnabled: false,
  mouseFollowDegPerPx: 0.3,
};

export interface FrameInfo {
  index: number;
  count: number;
  frameDeg: number;
}

export interface AutoState {
  state: "off" | "cw" | "ccw";
  enabled: boolean;
  direction: OrbitDirection;
  speed: number;
  weight: number;
}

export interface GyroState {
  enabled: boolean;
  pending: boolean;
  seen: boolean;
  gain: number;
  invert: boolean;
  smooth: boolean;
}

export interface OrbitState {
  ready: boolean;
  loading: boolean;
  title: string;
  angle: number;
  target: number;
  axis: OrbitAxis;
  minAngle: number;
  maxAngle: number;
  limited: boolean;
  velocity: number;
  frameIndex: number;
  frameCount: number;
  frameDeg: number;
  dragging: boolean;
  invert: boolean;
  inertia: boolean;
  fit: "contain" | "cover";
  auto: AutoState;
  gyro: GyroState;
  mouseFollow: boolean;
  config: OrbitConfig;
}

export interface VideoLayer {
  rect: Rect;
  count: number;
  frames: string[];
}

export type OrbitListener = () => void;

function toCoreConfig(config: Partial<OrbitConfig>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.title !== undefined) out.title = config.title;
  if (
    config.fit !== undefined ||
    config.mouseFollowEnabled !== undefined ||
    config.mouseFollowDegPerPx !== undefined
  ) {
    out.video = { fit: config.fit };
    out.mouseFollow = {
      enabled: config.mouseFollowEnabled,
      degPerPx: config.mouseFollowDegPerPx,
    };
  }
  if (
    config.axis !== undefined ||
    config.spanDeg !== undefined ||
    config.direction !== undefined ||
    config.minAngle !== undefined ||
    config.maxAngle !== undefined
  ) {
    out.orbit = {
      axis: config.axis,
      spanDeg: config.spanDeg,
      direction: config.direction,
      minAngle: config.minAngle,
      maxAngle: config.maxAngle,
    };
  }
  if (
    config.dragDegPerPx !== undefined ||
    config.dragInvert !== undefined ||
    config.dragInertia !== undefined ||
    config.dragInertiaMs !== undefined
  ) {
    out.drag = {
      degPerPx: config.dragDegPerPx,
      invert: config.dragInvert,
      inertia: config.dragInertia,
      inertiaMs: config.dragInertiaMs,
    };
  }
  if (config.motionSmoothMs !== undefined) out.motion = { smoothMs: config.motionSmoothMs };
  if (
    config.autoEnabled !== undefined ||
    config.autoDir !== undefined ||
    config.autoDegPerSec !== undefined ||
    config.autoIdleDelayMs !== undefined ||
    config.autoRampInMs !== undefined ||
    config.autoRampOutMs !== undefined
  ) {
    out.auto = {
      enabled: config.autoEnabled,
      dir: config.autoDir,
      degPerSec: config.autoDegPerSec,
      idleDelayMs: config.autoIdleDelayMs,
      rampInMs: config.autoRampInMs,
      rampOutMs: config.autoRampOutMs,
    };
  }
  if (
    config.gyroGain !== undefined ||
    config.gyroInvert !== undefined ||
    config.gyroSmooth !== undefined ||
    config.gyroSmoothMs !== undefined
  ) {
    out.gyro = {
      gain: config.gyroGain,
      invert: config.gyroInvert,
      smooth: config.gyroSmooth,
      smoothMs: config.gyroSmoothMs,
    };
  }
  return out;
}

function fromCoreConfig(config: OrbitEngineConfig): OrbitConfig {
  return {
    title: config.title,
    fit: config.video.fit,
    axis: config.orbit.axis,
    spanDeg: config.orbit.spanDeg,
    direction: config.orbit.direction,
    minAngle: config.orbit.minAngle,
    maxAngle: config.orbit.maxAngle,
    dragDegPerPx: config.drag.degPerPx,
    dragInvert: config.drag.invert,
    dragInertia: config.drag.inertia,
    dragInertiaMs: config.drag.inertiaMs,
    motionSmoothMs: config.motion.smoothMs,
    autoEnabled: config.auto.enabled,
    autoDir: config.auto.dir,
    autoDegPerSec: config.auto.degPerSec,
    autoIdleDelayMs: config.auto.idleDelayMs,
    autoRampInMs: config.auto.rampInMs,
    autoRampOutMs: config.auto.rampOutMs,
    gyroGain: config.gyro.gain,
    gyroInvert: config.gyro.invert,
    gyroSmooth: config.gyro.smooth,
    gyroSmoothMs: config.gyro.smoothMs,
    mouseFollowEnabled: config.mouseFollow.enabled,
    mouseFollowDegPerPx: config.mouseFollow.degPerPx,
  };
}

export class OrbitRenderController {
  private _config: OrbitConfig = { ...DEFAULT_CONFIG };
  private _engine: OrbitEngine;
  private _bundle: OrbBundle | null = null;
  private _layers: VideoLayer[] = [];
  private _listeners = new Set<OrbitListener>();
  private _ready = false;
  private _loading = false;
  private _error: string | null = null;
  private _progress = 0;
  private _canvasW = 1280;
  private _canvasH = 720;
  private _gyroEnabled = false;
  private _gyroSeen = false;
  private _gyroOrientMs = 0;
  totalJobs = 0;
  loadedFrames = 0;

  constructor(config?: Partial<OrbitConfig>) {
    this._engine = createEngine(
      { canvas: { width: 0, height: 0 }, videos: [] },
      { config: toCoreConfig(config || {}) },
    );
    this._engine.unload();
    this._syncConfig();
  }

  addListener(listener: OrbitListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  removeListener(listener: OrbitListener): void {
    this._listeners.delete(listener);
  }

  private _notify(): void {
    for (const listener of this._listeners) listener();
  }

  private _syncConfig(): void {
    this._config = fromCoreConfig(this._engine.getConfig());
  }

  get isReady(): boolean {
    return this._ready;
  }
  get isLoading(): boolean {
    return this._loading;
  }
  get error(): string | null {
    return this._error;
  }
  get progress(): number {
    return this._progress;
  }
  get angle(): number {
    return this._engine.getAngle();
  }
  get target(): number {
    return this._engine.getTargetAngle();
  }
  get axis(): OrbitAxis {
    return this._engine.getSnapshot().axis;
  }
  get frameCount(): number {
    return this._engine.getFrameCount();
  }
  get frameIndex(): number {
    return this._engine.getFrameIndex();
  }
  get frameDeg(): number {
    return this._engine.getSnapshot().frameDeg;
  }
  get title(): string {
    return this._config.title || "环绕视角";
  }
  get fit(): "contain" | "cover" {
    return this._config.fit;
  }
  get dragging(): boolean {
    return this._engine.getSnapshot().dragging;
  }
  get invert(): boolean {
    return this._config.dragInvert;
  }
  get inertia(): boolean {
    return this._config.dragInertia;
  }
  get auto(): AutoState {
    const auto = this._engine.getSnapshot().auto;
    return {
      state: auto.state,
      enabled: auto.enabled,
      direction: auto.direction,
      speed: auto.speed,
      weight: auto.weight,
    };
  }
  get gyro(): GyroState {
    return {
      enabled: this._gyroEnabled,
      pending: false,
      seen: this._gyroSeen,
      gain: this._config.gyroGain,
      invert: this._config.gyroInvert,
      smooth: this._config.gyroSmooth,
    };
  }
  get config(): OrbitConfig {
    return { ...this._config };
  }
  get bundle(): OrbBundle | null {
    return this._bundle;
  }
  get layers(): VideoLayer[] {
    return this._layers;
  }
  get canvasWidth(): number {
    return this._canvasW;
  }
  get canvasHeight(): number {
    return this._canvasH;
  }

  get state(): OrbitState {
    const snapshot = this._engine.getSnapshot();
    return {
      ready: this._ready,
      loading: this._loading,
      title: this.title,
      angle: snapshot.angle,
      target: snapshot.targetAngle,
      axis: snapshot.axis,
      minAngle: snapshot.minAngle,
      maxAngle: snapshot.maxAngle,
      limited: snapshot.limited,
      velocity: snapshot.velocity,
      frameIndex: snapshot.frameIndex,
      frameCount: snapshot.frameCount,
      frameDeg: snapshot.frameDeg,
      dragging: snapshot.dragging,
      invert: this.invert,
      inertia: this.inertia,
      fit: this.fit,
      auto: this.auto,
      gyro: this.gyro,
      mouseFollow: this._config.mouseFollowEnabled,
      config: this.config,
    };
  }

  currentFrameForLayer(layerIndex: number): string | null {
    const layer = this._layers[layerIndex];
    if (!layer || layer.frames.length === 0) return null;
    const snapshot = this._engine.getSnapshot();
    const index = snapshot.layers[layerIndex]?.frameIndex ?? 0;
    return layer.frames[Math.max(0, Math.min(layer.frames.length - 1, index))] || null;
  }

  setConfig(next: OrbitConfig): void {
    this._engine.setConfig(toCoreConfig(next));
    this._syncConfig();
    this._notify();
  }

  setInvert(value: boolean): void {
    this._engine.setConfig({ drag: { invert: value } });
    this._syncConfig();
    this._notify();
  }

  setInertia(value: boolean): void {
    this._engine.setConfig({ drag: { inertia: value } });
    this._syncConfig();
    this._notify();
  }

  setFit(mode: "contain" | "cover"): void {
    this._engine.setConfig({ video: { fit: mode } });
    this._syncConfig();
    this._notify();
  }

  setGyroGain(gain: number): void {
    this._engine.setConfig({ gyro: { gain } });
    this._syncConfig();
    this._notify();
  }

  setGyroSmooth(smooth: boolean): void {
    this._engine.setConfig({ gyro: { smooth } });
    this._syncConfig();
    this._notify();
  }

  setMouseFollow(enabled: boolean): void {
    this._engine.setConfig({ mouseFollow: { enabled } });
    this._syncConfig();
    this._notify();
  }

  setAutoRotate(value: boolean | string): void {
    let enabled = !!value;
    let dir: OrbitDirection | undefined;
    if (typeof value === "string") {
      if (value === "off") enabled = false;
      else if (value === "cw" || value === "ccw") {
        enabled = true;
        dir = value;
      } else if (value === "on") enabled = true;
    }
    this._engine.setConfig({ auto: { enabled, dir } });
    this._syncConfig();
    this._notify();
  }

  cycleAuto(): "off" | "cw" | "ccw" {
    const state = this._engine.getSnapshot().auto.state;
    const next = state === "off" ? "cw" : state === "cw" ? "ccw" : "off";
    this.setAutoRotate(next);
    return next;
  }

  setAutoSpeed(speed: number): void {
    this._engine.setConfig({ auto: { degPerSec: speed } });
    this._syncConfig();
    this._notify();
  }

  rotateBy(deg: number): void {
    this._engine.rotateBy(deg);
    this._notify();
  }

  setAngle(deg: number, immediate = false): void {
    this._engine.setAngle(deg, immediate);
    this._notify();
  }

  reset(angle = 0, immediate = false): void {
    this._engine.reset(angle, immediate);
    this._notify();
  }

  calibrateGyro(): void {
    this._engine.calibrateGyro();
    this._notify();
  }

  enableGyro(): void {
    this._gyroEnabled = true;
    this._gyroSeen = false;
    this._engine.enableGyro();
    this._engine.calibrateGyro();
    this._notify();
  }

  disableGyro(): void {
    this._gyroEnabled = false;
    this._gyroSeen = false;
    this._engine.disableGyro();
    this._notify();
  }

  handleGyroscopeDelta(
    gx: number,
    gy: number,
    gz: number,
    dt: number,
    screenRotationDeg = 0,
  ): void {
    if (!this._gyroEnabled || this.dragging) return;
    this._gyroSeen = true;
    let sx = gx;
    let sy = gy;
    switch (screenRotationDeg) {
      case 90:
        sx = gy;
        sy = -gx;
        break;
      case 180:
        sx = -gx;
        sy = -gy;
        break;
      case 270:
        sx = -gy;
        sy = gx;
        break;
      default:
        break;
    }
    const gain =
      this._config.gyroGain *
      (this._config.gyroInvert ? -1 : 1) *
      (this._config.dragInvert ? -1 : 1);
    const radians = this.axis === "y" ? sx * dt : -sy * dt - gz * 0.4 * dt;
    const delta = radians * (180 / Math.PI) * gain;
    const now = Date.now();
    const smooth = Math.min(Math.max(now - this._gyroOrientMs, 1), 120);
    this._gyroOrientMs = now;
    const factor = this._config.gyroSmooth ? 1 - Math.exp(-smooth / this._config.gyroSmoothMs) : 1;
    this._engine.rotateBy(delta * factor);
    this._notify();
  }

  onPointerDown(x: number, y: number): void {
    this._engine.pointerDown(x, y, Date.now());
    this._notify();
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    this._engine.pointerMove(x, y, Date.now());
    this._notify();
  }

  onPointerUp(): void {
    this._engine.pointerUp(Date.now());
    this._notify();
  }

  onPointerHover(delta: { dx: number; dy: number }): void {
    if (this.dragging || !this._config.mouseFollowEnabled) return;
    const px = this.axis === "y" ? delta.dy : delta.dx;
    if (!px) return;
    this._engine.rotateBy(
      px * this._config.mouseFollowDegPerPx * (this._config.dragInvert ? -1 : 1),
    );
    this._notify();
  }

  tick(nowMs: number = Date.now()): void {
    const dt = Math.min(Math.max(nowMs - (this._lastTickMs || nowMs), 0), 64);
    this._lastTickMs = nowMs;
    this._engine.advance(dt);
    const before = this._lastAngle;
    const after = this._engine.getSnapshot().angle;
    if (before !== after) {
      this._lastAngle = after;
      this._notify();
    }
  }
  private _lastTickMs = 0;
  private _lastAngle = Number.NaN;

  frameInfo(): FrameInfo {
    const snapshot = this._engine.getSnapshot();
    return { index: snapshot.frameIndex, count: snapshot.frameCount, frameDeg: snapshot.frameDeg };
  }

  layout(viewport: { width: number; height: number }) {
    return computeLayout({
      canvas: { width: this._canvasW, height: this._canvasH },
      viewport,
      fit: this._config.fit,
      displayScale: 1,
      portraitScale: 1.25,
      layers: this._layers.map((layer, index) => ({ layerIndex: index, rect: layer.rect })),
    });
  }

  async loadOrbBytes(
    bytes: Uint8Array,
    options: string | { defaultTitle?: string } = {},
  ): Promise<void> {
    const defaultTitle = typeof options === "string" ? options : options.defaultTitle;
    this._loading = true;
    this._ready = false;
    this._error = null;
    this._progress = 0.1;
    this._notify();
    try {
      const bundle = OrbBundle.parse(bytes);
      const meta = bundle.meta;
      const codec = meta.codec || "image/jpeg";
      this.totalJobs = meta.videos.reduce((sum, video) => sum + video.frames.count, 0);
      this.loadedFrames = 0;
      const layers: VideoLayer[] = meta.videos.map((video, videoIndex) => {
        const frames: string[] = Array.from({ length: video.frames.count });
        for (let frameIndex = 0; frameIndex < video.frames.count; frameIndex++) {
          try {
            frames[frameIndex] = bundle.frameDataUri(videoIndex, frameIndex, codec);
          } catch {
            frames[frameIndex] = "";
          }
          this.loadedFrames++;
        }
        return { rect: video.rect, count: video.frames.count, frames };
      });
      this._bundle = bundle;
      this._layers = layers;
      this._canvasW = meta.canvas.width;
      this._canvasH = meta.canvas.height;
      this._engine.load({
        canvas: meta.canvas,
        initialAngle: meta.initialAngle,
        videos: bundle.layers.map((layer) => ({ rect: layer.rect, frameCount: layer.frameCount })),
        sceneConfig: bundle.sceneConfig,
      });
      if (defaultTitle) this._engine.setConfig({ title: defaultTitle });
      this._syncConfig();
      this._ready = true;
      this._loading = false;
      this._progress = 1;
      this._notify();
    } catch (error) {
      this._loading = false;
      this._ready = false;
      this._error = error instanceof Error ? error.message : String(error);
      this._notify();
      throw error;
    }
  }

  async loadUrl(url: string, { defaultTitle }: { defaultTitle?: string } = {}): Promise<void> {
    this._loading = true;
    this._ready = false;
    this._error = null;
    this._progress = 0.05;
    this._notify();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: 无法加载 ${url}`);
      await this.loadOrbBytes(new Uint8Array(await response.arrayBuffer()), { defaultTitle });
    } catch (error) {
      this._loading = false;
      this._ready = false;
      this._error = error instanceof Error ? error.message : String(error);
      this._notify();
      throw error;
    }
  }

  async loadFile(
    file: { uri: string; arrayBuffer?: () => Promise<ArrayBuffer> },
    { defaultTitle }: { defaultTitle?: string } = {},
  ): Promise<void> {
    if (!file.arrayBuffer) throw new Error("loadFile: File 需要 arrayBuffer()");
    await this.loadOrbBytes(new Uint8Array(await file.arrayBuffer()), {
      defaultTitle: defaultTitle ?? file.uri.split("/").pop(),
    });
  }
}
