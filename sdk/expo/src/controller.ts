import { OrbBundle, OrbitAxis, OrbitDirection, Rect } from "./orb";

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
  gyroGain: 1.0,
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
  frames: string[]; // data URIs
}

export type OrbitListener = () => void;

export class OrbitRenderController {
  private _config: OrbitConfig;
  private _bundle: OrbBundle | null = null;
  private _layers: VideoLayer[] = [];
  private _listeners = new Set<OrbitListener>();

  private _ready = false;
  private _loading = false;
  private _error: string | null = null;
  private _progress = 0;
  totalJobs = 0;
  loadedFrames = 0;

  private _angle = 0;
  private _target = 0;
  private _vel = 0;
  private _dragging = false;

  private _minAngle = -180;
  private _maxAngle = 180;
  private _limited = false;
  private _axis: OrbitAxis = "x";
  private _invert = false;
  private _inertia = true;
  private _fit: "contain" | "cover" = "contain";

  private _autoState: "off" | "cw" | "ccw" = "off";
  private _autoDir = 1;
  private _autoSpeed = 14;
  private _autoWeight = 0;
  private _idleSinceMs = 0;

  private _gyroEnabled = false;
  private _gyroSeen = false;
  private _gyroRef: number | null = null;
  private _gyroBase = 0;
  private _orientTMs = 0;

  private _canvasW = 1280;
  private _canvasH = 720;
  private _count = 0;
  private _frameDeg = 1;
  private _degPerFrame = 1;

  private _lastTickMs = 0;
  private _lastPointerTMs = 0;
  private _lastPointerX: number | null = null;
  private _lastPointerY: number | null = null;

  constructor(config?: Partial<OrbitConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._applyConfig();
    this._touchActivity();
  }

  addListener(listener: OrbitListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  removeListener(listener: OrbitListener): void {
    this._listeners.delete(listener);
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener();
    }
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
    return this._normAngle(this._angle);
  }
  get target(): number {
    return this._normAngle(this._target);
  }
  get axis(): OrbitAxis {
    return this._axis;
  }
  get frameCount(): number {
    return this._count;
  }
  get frameIndex(): number {
    return this._computeFrameIndex();
  }
  get frameDeg(): number {
    return this._frameDeg;
  }
  get title(): string {
    return this._config.title.length > 0 ? this._config.title : "环绕视角";
  }
  get fit(): "contain" | "cover" {
    return this._fit;
  }
  get dragging(): boolean {
    return this._dragging;
  }
  get invert(): boolean {
    return this._invert;
  }
  get inertia(): boolean {
    return this._inertia;
  }
  get auto(): AutoState {
    return {
      state: this._autoState,
      enabled: this._autoState !== "off",
      direction: this._autoState === "off" ? this._config.autoDir : this._autoState,
      speed: this._autoSpeed,
      weight: this._autoWeight,
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
    return {
      ready: this._ready,
      loading: this._loading,
      title: this.title,
      angle: this.angle,
      target: this.target,
      axis: this._axis,
      minAngle: this._minAngle,
      maxAngle: this._maxAngle,
      limited: this._limited,
      velocity: this._vel,
      frameIndex: this.frameIndex,
      frameCount: this._count,
      frameDeg: this._frameDeg,
      dragging: this._dragging,
      invert: this._invert,
      inertia: this._inertia,
      fit: this._fit,
      auto: this.auto,
      gyro: this.gyro,
      mouseFollow: this._config.mouseFollowEnabled,
      config: this.config,
    };
  }

  currentFrameForLayer(layerIndex: number): string | null {
    const layer = this._layers[layerIndex];
    if (!layer || layer.frames.length === 0) return null;
    const fi = this._computeFrameIndex();
    const safeFi = Math.max(0, Math.min(layer.frames.length - 1, fi));
    return layer.frames[safeFi] || null;
  }

  private _touchActivity(): void {
    this._idleSinceMs = Date.now();
  }

  private _applyConfig(): void {
    this._invert = this._config.dragInvert;
    this._axis = this._config.axis === "y" ? "y" : "x";
    let lo = Math.min(180, Math.max(-180, this._config.minAngle));
    let hi = Math.min(180, Math.max(-180, this._config.maxAngle));
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    this._minAngle = lo;
    this._maxAngle = hi;
    this._limited = hi - lo < 360;
    this._inertia = this._config.dragInertia;
    this._fit = this._config.fit;

    if (this._config.autoEnabled) {
      this._autoState = this._config.autoDir === "ccw" ? "ccw" : "cw";
      this._autoDir = this._autoState === "ccw" ? -1 : 1;
    } else {
      this._autoState = "off";
    }
    this._autoSpeed = this._config.autoDegPerSec;

    if (this._count > 0) {
      const span = this._limited ? this._maxAngle - this._minAngle : 360;
      this._degPerFrame = span / this._count;
      this._frameDeg = this._degPerFrame;
    }
  }

  private _normAngle(deg: number): number {
    if (this._limited) {
      return Math.min(this._maxAngle, Math.max(this._minAngle, deg));
    }
    return ((((deg + 180) % 360) + 360) % 360) - 180;
  }

  private _angleDelta(from: number, to: number): number {
    if (this._limited) return to - from;
    return ((((to - from + 180) % 360) + 360) % 360) - 180;
  }

  private _computeFrameIndex(): number {
    if (this._count <= 0) return 0;
    if (this._limited) {
      const span = this._maxAngle - this._minAngle;
      if (span <= 0) return 0;
      const t = (this.angle - this._minAngle) / span;
      return Math.min(this._count - 1, Math.max(0, Math.floor(t * (this._count - 1))));
    }
    const signed = this.angle;
    const norm = ((((signed % 360) + 360) % 360) / 360) * this._count;
    const idx = Math.floor(norm) % this._count;
    return (idx + this._count) % this._count;
  }

  setInvert(val: boolean): void {
    this._config = { ...this._config, dragInvert: val };
    this._invert = val;
    this._notify();
  }

  setInertia(val: boolean): void {
    this._config = { ...this._config, dragInertia: val };
    this._inertia = val;
    this._notify();
  }

  setFit(mode: "contain" | "cover"): void {
    this._config = { ...this._config, fit: mode };
    this._fit = mode;
    this._notify();
  }

  setGyroGain(gain: number): void {
    this._config = { ...this._config, gyroGain: gain };
    this._notify();
  }

  setGyroSmooth(smooth: boolean): void {
    this._config = { ...this._config, gyroSmooth: smooth };
    this._notify();
  }

  setMouseFollow(enabled: boolean): void {
    this._config = { ...this._config, mouseFollowEnabled: enabled };
    this._notify();
  }

  setAutoRotate(value: boolean | string): void {
    if (typeof value === "boolean") {
      this._config = { ...this._config, autoEnabled: value };
    } else if (value === "off") {
      this._config = { ...this._config, autoEnabled: false };
    } else if (value === "cw" || value === "ccw") {
      this._config = { ...this._config, autoEnabled: true, autoDir: value };
    } else if (value === "on") {
      this._config = { ...this._config, autoEnabled: true };
    }
    this._applyConfig();
    this._touchActivity();
    this._notify();
  }

  cycleAuto(): "off" | "cw" | "ccw" {
    const next = this._autoState === "off" ? "cw" : this._autoState === "cw" ? "ccw" : "off";
    this.setAutoRotate(next);
    return next;
  }

  setAutoSpeed(speed: number): void {
    this._config = { ...this._config, autoDegPerSec: speed };
    this._autoSpeed = speed;
    this._notify();
  }

  rotateBy(deg: number): void {
    this._target = this._normAngle(this._target + deg);
    this._touchActivity();
    this._notify();
  }

  setAngle(deg: number, immediate = false): void {
    this._target = this._normAngle(deg);
    this._vel = 0;
    if (immediate) this._angle = this._target;
    this._touchActivity();
    this._notify();
  }

  reset(angle = 0, immediate = false): void {
    this._target = this._normAngle(angle);
    this._vel = 0;
    if (this._gyroEnabled) {
      this._gyroRef = null;
      this._gyroBase = 0;
    }
    if (immediate) this._angle = this._target;
    this._touchActivity();
    this._notify();
  }

  calibrateGyro(): void {
    this._gyroRef = null;
    this._gyroBase = this._target;
    this._notify();
  }

  enableGyro(): void {
    this._gyroEnabled = true;
    this._gyroSeen = false;
    this._gyroRef = null;
    this._notify();
  }

  disableGyro(): void {
    this._gyroEnabled = false;
    this._gyroSeen = false;
    this._gyroRef = null;
    this._notify();
  }

  handleGyroscopeDelta(
    gx: number,
    gy: number,
    gz: number,
    dt: number,
    screenRotationDeg = 0,
  ): void {
    if (!this._gyroEnabled || this._dragging) return;
    this._gyroSeen = true;

    let sx: number;
    let sy: number;
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
      case 0:
      default:
        sx = gx;
        sy = gy;
        break;
    }

    const gain =
      this._config.gyroGain * (this._config.gyroInvert ? -1.0 : 1.0) * (this._invert ? -1.0 : 1.0);

    const rad = this._axis === "y" ? sx * dt : -sy * dt - gz * 0.4 * dt;
    const degDelta = rad * (180.0 / Math.PI) * gain;

    if (this._config.gyroSmooth) {
      const now = Date.now();
      const dtMs = Math.min(Math.max(now - this._orientTMs, 1), 120);
      this._orientTMs = now;
      const tau = this._config.gyroSmoothMs;
      const factor = 1 - Math.exp(-dtMs / tau);
      this._target = this._normAngle(this._target + degDelta * factor);
    } else {
      this._target = this._normAngle(this._target + degDelta);
    }

    this._touchActivity();
    this._notify();
  }

  onPointerDown(x: number, y: number): void {
    this._dragging = true;
    this._vel = 0;
    this._lastPointerX = x;
    this._lastPointerY = y;
    this._lastPointerTMs = Date.now();
    this._touchActivity();
    this._notify();
  }

  onPointerMove(x: number, y: number): void {
    if (!this._dragging) return;
    const now = Date.now();
    const dx = x - (this._lastPointerX ?? x);
    const dy = y - (this._lastPointerY ?? y);
    const dt = Math.max(now - this._lastPointerTMs, 1);
    const px = this._axis === "y" ? dy : dx;
    const deg = px * this._config.dragDegPerPx * (this._invert ? -1.0 : 1.0);

    this._target = this._normAngle(this._target + deg);
    if (this._gyroEnabled) {
      this._gyroBase = this._normAngle(this._gyroBase + deg);
    }
    const inst = dt > 90 ? 0.0 : deg / dt;
    this._vel = 0.6 * inst + 0.4 * this._vel;
    this._lastPointerX = x;
    this._lastPointerY = y;
    this._lastPointerTMs = now;
    this._touchActivity();
    this._notify();
  }

  onPointerUp(): void {
    if (!this._dragging) return;
    this._dragging = false;
    const now = Date.now();
    if (now - this._lastPointerTMs > 90) {
      this._vel = 0.0;
    }
    this._vel = Math.min(0.55, Math.max(-0.55, this._vel));
    this._touchActivity();
    this._notify();
  }

  tick(nowMs: number = Date.now()): void {
    if (this._lastTickMs === 0) {
      this._lastTickMs = nowMs;
      return;
    }
    const dt = Math.min(nowMs - this._lastTickMs, 64);
    this._lastTickMs = nowMs;

    if (!this._dragging) {
      if (this._inertia && !this._gyroEnabled && Math.abs(this._vel) > 0.0005) {
        const next = this._normAngle(this._target + this._vel * dt);
        if (this._limited && next === this._target) {
          this._vel = 0;
        }
        this._target = next;
        this._vel *= Math.exp(-dt / this._config.dragInertiaMs);
        this._touchActivity();
      } else {
        this._vel = 0;
      }
    }

    this._updateAuto(dt, nowMs);

    const delta = this._angleDelta(this._angle, this._target);
    const tau = this._config.motionSmoothMs;
    const next = this._angle + delta * (1 - Math.exp(-dt / tau));
    this._angle = this._limited
      ? Math.min(this._maxAngle, Math.max(this._minAngle, next))
      : ((((next + 180) % 360) + 360) % 360) - 180;

    if (Math.abs(this._angleDelta(this._angle, this._target)) < 0.0005) {
      this._angle = this._target;
    }

    this._notify();
  }

  private _updateAuto(dt: number, nowMs: number): void {
    const idle = nowMs - this._idleSinceMs;
    const want =
      this._autoState !== "off" &&
      !this._gyroEnabled &&
      !this._dragging &&
      idle > this._config.autoIdleDelayMs
        ? 1.0
        : 0.0;
    const tau =
      want > 0 ? this._config.autoRampInMs : this._dragging ? 120.0 : this._config.autoRampOutMs;

    this._autoWeight += (want - this._autoWeight) * (1 - Math.exp(-dt / tau));
    if (want === 0 && this._autoWeight < 0.004) {
      this._autoWeight = 0;
      return;
    }
    if (this._autoWeight <= 0) return;
    this._target = this._normAngle(
      this._target + (this._autoDir * this._autoSpeed * this._autoWeight * dt) / 1000.0,
    );
  }

  async loadOrbBytes(bytes: Uint8Array, defaultTitle?: string): Promise<void> {
    this._loading = true;
    this._ready = false;
    this._error = null;
    this._progress = 0.1;
    this._notify();

    try {
      const bundle = OrbBundle.parse(bytes);
      const meta = bundle.meta;

      const rawDefaults = (meta as Record<string, unknown>).defaults as
        | Record<string, unknown>
        | undefined;
      const sceneAuto = rawDefaults?.auto as
        | { enabled?: boolean; dir?: OrbitDirection }
        | undefined;
      const autoEnabled = sceneAuto?.enabled ?? false;
      const autoDir = sceneAuto?.dir ?? "cw";

      this._config = {
        ...this._config,
        title: defaultTitle || meta.title || "环绕视角",
        axis: meta.orbit?.axis || "x",
        spanDeg: meta.orbit?.spanDeg || 360,
        direction: meta.orbit?.direction || "cw",
        minAngle: meta.orbit?.minAngle ?? -180,
        maxAngle: meta.orbit?.maxAngle ?? 180,
        autoEnabled,
        autoDir,
      };

      this._canvasW = meta.canvas.width;
      this._canvasH = meta.canvas.height;
      this._count = meta.videos.reduce(
        (max, v) => (v.frames.count > max ? v.frames.count : max),
        0,
      );

      const layers: VideoLayer[] = [];
      let totalJobs = 0;
      for (const v of meta.videos) {
        totalJobs += v.frames.count;
      }
      this.totalJobs = totalJobs;
      this.loadedFrames = 0;

      for (let vi = 0; vi < meta.videos.length; vi++) {
        const v = meta.videos[vi];
        const framesList = Array.from<string>({ length: v.frames.count });
        layers.push({
          rect: v.rect,
          count: v.frames.count,
          frames: framesList,
        });
      }

      const mimeType = meta.codec?.includes("png") ? "image/png" : "image/jpeg";
      let processed = 0;

      for (let vi = 0; vi < meta.videos.length; vi++) {
        const v = meta.videos[vi];
        const layer = layers[vi];
        for (let fi = 0; fi < v.frames.count; fi++) {
          try {
            layer.frames[fi] = bundle.frameDataUri(vi, fi, mimeType);
          } catch {
            layer.frames[fi] = "";
          }
          processed++;
          this.loadedFrames = processed;
          this._progress = 0.1 + 0.9 * (processed / totalJobs);
          if (processed % 15 === 0 || processed === totalJobs) {
            this._notify();
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      }

      this._bundle = bundle;
      this._layers = layers;
      this._applyConfig();
      this._angle = this._target = this._normAngle(meta.initialAngle ?? 0);
      this._ready = true;
      this._loading = false;
      this._progress = 1.0;
      this._notify();
    } catch (err: unknown) {
      this._loading = false;
      this._ready = false;
      this._error = err instanceof Error ? err.message : String(err);
      this._notify();
      throw err;
    }
  }

  async loadUrl(url: string, defaultTitle?: string): Promise<void> {
    this._loading = true;
    this._ready = false;
    this._error = null;
    this._progress = 0.05;
    this._notify();

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      await this.loadOrbBytes(new Uint8Array(arrayBuffer), defaultTitle);
    } catch (err: unknown) {
      this._loading = false;
      this._ready = false;
      this._error = err instanceof Error ? err.message : String(err);
      this._notify();
      throw err;
    }
  }
}
