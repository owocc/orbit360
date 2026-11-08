import {
  clone,
  deepMerge,
  resolveConfig,
  assertFiniteNumber,
  type OrbitEngineConfig,
} from "./config";
import type { OrbitDirection, Rect } from "./orb";

export const ENGINE_VERSION = "engine/v1";

export interface EngineLayerInput {
  rect: Rect;
  frameCount: number;
}

export interface EngineBundle {
  canvas: { width: number; height: number };
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

interface LayerState {
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

const mod = (a: number, n: number) => ((a % n) + n) % n;
const shortDelta = (from: number, to: number) => mod(to - from + 180, 360) - 180;
const wrapSigned = (deg: number) => mod(deg + 180, 360) - 180;
const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundHalfUp = (v: number) => Math.floor(v + 0.5);

export class OrbitEngine {
  private _sceneConfig: Record<string, unknown> = {};
  private _userConfig: Record<string, unknown> = {};
  private _config: OrbitEngineConfig;
  private _ready = false;
  private _paused = false;
  private _destroyed = false;
  private _angle = 0;
  private _target = 0;
  private _velocity = 0;
  private _dragging = false;
  private _limited = false;
  private _axis: "x" | "y" = "x";
  private _minAngle = -180;
  private _maxAngle = 180;
  private _frameCount = 0;
  private _degPerFrame = 360;
  private _layers: LayerState[] = [];
  private _lastPointerX = 0;
  private _lastPointerY = 0;
  private _lastPointerTime = 0;
  private _now = 0;
  private _lastActivity = 0;
  private _autoState: "off" | "cw" | "ccw" = "off";
  private _autoDir = 1;
  private _autoSpeed = 14;
  private _autoWeight = 0;
  private _gyroActive = false;
  private _gyroSeen = false;
  private _gyroRef: number | null = null;
  private _gyroBase = 0;
  private _lastGyroTime = 0;

  constructor(bundle: EngineBundle, options: EngineOptions = {}) {
    this._config = resolveConfig({}, options.config || {});
    this._userConfig = deepMerge({}, options.config || {});
    this.load(bundle);
  }

  load(bundle: EngineBundle): this {
    if (this._destroyed) return this;
    this._sceneConfig = deepMerge({}, bundle.sceneConfig || {});
    this._layers = bundle.videos.map((video, index) => ({
      layerIndex: index,
      frameIndex: 0,
      frameCount: video.frameCount,
      rect: { ...video.rect },
    }));
    this._frameCount = bundle.videos.reduce((max, video) => Math.max(max, video.frameCount), 0);
    this._config = resolveConfig(this._sceneConfig, this._userConfig);
    this._applyConfig();
    const initial = typeof bundle.initialAngle === "number" ? bundle.initialAngle : 0;
    this._angle = this._target = this._normAngle(initial);
    this._velocity = 0;
    this._dragging = false;
    this._autoWeight = 0;
    this._gyroRef = null;
    this._gyroBase = 0;
    this._lastActivity = this._now;
    this._ready = true;
    this._paused = false;
    this._recalcFrames();
    return this;
  }

  setConfig(partial: Record<string, unknown> = {}): this {
    if (this._destroyed) return this;
    this._lastActivity = this._now;
    this._userConfig = deepMerge(this._userConfig, partial);
    this._config = resolveConfig(this._sceneConfig, this._userConfig);
    this._applyConfig();
    return this;
  }

  resetConfig(): this {
    if (this._destroyed) return this;
    this._userConfig = {};
    this._config = resolveConfig(this._sceneConfig, {});
    this._applyConfig();
    this._lastActivity = this._now;
    return this;
  }

  setAngle(deg: number, immediate = false): this {
    if (this._destroyed) return this;
    const value = assertFiniteNumber(deg, "setAngle: deg");
    this._target = this._normAngle(value);
    this._velocity = 0;
    if (immediate) this._angle = this._target;
    this._lastActivity = this._now;
    return this;
  }

  rotateBy(deg: number): this {
    if (this._destroyed) return this;
    const value = assertFiniteNumber(deg, "rotateBy: deg");
    this._target = this._normAngle(this._target + value);
    this._lastActivity = this._now;
    return this;
  }

  pointerDown(x: number, y: number, timeMs: number): this {
    if (this._destroyed) return this;
    const t = this._eventTime(timeMs);
    this._dragging = true;
    this._velocity = 0;
    this._lastPointerX = x;
    this._lastPointerY = y;
    this._lastPointerTime = t;
    this._lastActivity = this._now;
    return this;
  }

  pointerMove(x: number, y: number, timeMs: number): this {
    if (this._destroyed || !this._dragging) return this;
    const t = this._eventTime(timeMs);
    const dx = x - this._lastPointerX;
    const dy = y - this._lastPointerY;
    const dt = Math.max(t - this._lastPointerTime, 1);
    const px = this._axis === "y" ? dy : dx;
    const deg = px * this._config.drag.degPerPx * (this._config.drag.invert ? -1 : 1);
    this._target = this._normAngle(this._target + deg);
    const inst = dt > 90 ? 0 : deg / dt;
    this._velocity = 0.6 * inst + 0.4 * this._velocity;
    this._lastPointerX = x;
    this._lastPointerY = y;
    this._lastPointerTime = t;
    this._lastActivity = this._now;
    return this;
  }

  pointerUp(timeMs: number): this {
    if (this._destroyed || !this._dragging) return this;
    this._eventTime(timeMs);
    this._dragging = false;
    if (timeMs - this._lastPointerTime > 90) this._velocity = 0;
    this._velocity = clampNum(this._velocity, -0.55, 0.55);
    this._lastActivity = this._now;
    return this;
  }

  enableGyro(): this {
    if (!this._destroyed) this._gyroActive = true;
    return this;
  }

  gyro(sample: { heading: number; timeMs: number }): this {
    if (this._destroyed) return this;
    const heading = assertFiniteNumber(sample.heading, "gyro: heading");
    this._eventTime(sample.timeMs);
    this._gyroActive = true;
    this._gyroSeen = true;
    if (this._dragging) return this;
    if (this._gyroRef === null) {
      this._gyroRef = heading;
      this._gyroBase = this._target;
      this._lastGyroTime = this._now;
      this._lastActivity = this._now;
      return this;
    }
    const gain =
      this._config.gyro.gain *
      (this._config.gyro.invert ? -1 : 1) *
      (this._config.drag.invert ? -1 : 1);
    const delta = shortDelta(this._gyroRef, heading) * gain;
    const raw = this._normAngle(this._gyroBase - delta);
    if (this._config.gyro.smooth) {
      const dt = clampNum(this._now - this._lastGyroTime, 1, 120);
      this._lastGyroTime = this._now;
      this._target = this._normAngle(
        this._target +
          this._angleDelta(this._target, raw) * (1 - Math.exp(-dt / this._config.gyro.smoothMs)),
      );
    } else {
      this._target = raw;
    }
    this._lastActivity = this._now;
    return this;
  }

  disableGyro(): this {
    if (this._destroyed) return this;
    this._gyroActive = false;
    this._gyroRef = null;
    this._gyroBase = 0;
    return this;
  }

  calibrateGyro(): this {
    if (this._destroyed) return this;
    this._gyroRef = null;
    this._gyroBase = this._target;
    return this;
  }

  pause(): this {
    if (!this._destroyed) this._paused = true;
    return this;
  }

  resume(): this {
    if (!this._destroyed) this._paused = false;
    return this;
  }

  reset(angle = 0, immediate = true): this {
    if (this._destroyed) return this;
    this._target = this._normAngle(assertFiniteNumber(angle, "reset: angle"));
    this._velocity = 0;
    this._gyroRef = null;
    this._gyroBase = 0;
    if (immediate) this._angle = this._target;
    this._lastActivity = this._now;
    return this;
  }

  unload(): this {
    if (this._destroyed) return this;
    this._sceneConfig = {};
    this._layers = [];
    this._frameCount = 0;
    this._angle = 0;
    this._target = 0;
    this._velocity = 0;
    this._dragging = false;
    this._autoWeight = 0;
    this._gyroRef = null;
    this._gyroBase = 0;
    this._ready = false;
    this._paused = false;
    this._config = resolveConfig({}, this._userConfig);
    this._applyConfig();
    this._lastActivity = this._now;
    return this;
  }

  destroy(): this {
    this._destroyed = true;
    this._dragging = false;
    this._velocity = 0;
    return this;
  }

  advance(dtMs: number): this {
    if (this._destroyed || this._paused) return this;
    const raw = typeof dtMs === "number" && Number.isFinite(dtMs) ? dtMs : 0;
    const dt = Math.min(64, Math.max(0, raw));
    this._now += dt;

    if (!this._dragging) {
      if (this._config.drag.inertia && !this._gyroActive && Math.abs(this._velocity) > 0.0005) {
        const next = this._normAngle(this._target + this._velocity * dt);
        if (this._limited && next === this._target) this._velocity = 0;
        this._target = next;
        this._velocity *= Math.exp(-dt / this._config.drag.inertiaMs);
        this._lastActivity = this._now;
      } else {
        this._velocity = 0;
      }
    }

    const idle = this._now - this._lastActivity;
    const want =
      this._autoState !== "off" &&
      !this._gyroActive &&
      !this._dragging &&
      idle > this._config.auto.idleDelayMs
        ? 1
        : 0;
    const tau = want
      ? this._config.auto.rampInMs
      : this._dragging
        ? 120
        : this._config.auto.rampOutMs;
    this._autoWeight += (want - this._autoWeight) * (1 - Math.exp(-dt / tau));
    if (want === 0 && this._autoWeight < 0.004) {
      this._autoWeight = 0;
    }
    if (this._autoWeight > 0) {
      this._target = this._normAngle(
        this._target + (this._autoDir * this._autoSpeed * this._autoWeight * dt) / 1000,
      );
    }

    const delta = this._angleDelta(this._angle, this._target);
    const next = this._angle + delta * (1 - Math.exp(-dt / this._config.motion.smoothMs));
    this._angle = this._limited ? clampNum(next, this._minAngle, this._maxAngle) : mod(next, 360);
    if (Math.abs(this._angleDelta(this._angle, this._target)) < 0.0005) {
      this._angle = this._target;
    }
    return this;
  }

  getAngle(): number {
    return this._normAngle(this._angle);
  }

  getTargetAngle(): number {
    return this._normAngle(this._target);
  }

  getFrameIndex(): number {
    return this._frameIndex();
  }

  getFrameCount(): number {
    return this._frameCount;
  }

  getConfig(): OrbitEngineConfig {
    return clone(this._config);
  }

  getSnapshot(): EngineSnapshot {
    const frameIndex = this._frameIndex();
    const autoDirection = this._autoState === "off" ? this._config.auto.dir : this._autoState;
    return {
      ready: this._ready,
      loading: false,
      paused: this._paused,
      destroyed: this._destroyed,
      angle: this._normAngle(this._angle),
      targetAngle: this._normAngle(this._target),
      velocity: this._velocity,
      axis: this._axis,
      direction: this._config.orbit.direction,
      spanDeg: this._frameSpan(),
      minAngle: this._minAngle,
      maxAngle: this._maxAngle,
      limited: this._limited,
      frameIndex,
      frameCount: this._frameCount,
      frameDeg: this._degPerFrame,
      dragging: this._dragging,
      auto: {
        state: this._autoState,
        enabled: this._autoState !== "off",
        direction: autoDirection,
        speed: this._autoSpeed,
        weight: this._autoWeight,
        idleDelayMs: this._config.auto.idleDelayMs,
        rampInMs: this._config.auto.rampInMs,
        rampOutMs: this._config.auto.rampOutMs,
      },
      gyro: {
        enabled: this._gyroActive,
        seen: this._gyroSeen,
        gain: this._config.gyro.gain,
        invert: this._config.gyro.invert,
        smooth: this._config.gyro.smooth,
        smoothMs: this._config.gyro.smoothMs,
      },
      layers: this._layers.map((layer) => ({
        layerIndex: layer.layerIndex,
        frameIndex:
          layer.frameCount === this._frameCount
            ? frameIndex
            : mod(
                Math.floor((frameIndex * layer.frameCount) / Math.max(1, this._frameCount)),
                layer.frameCount,
              ),
        frameCount: layer.frameCount,
        rect: { ...layer.rect },
      })),
    };
  }

  private _eventTime(timeMs: number): number {
    const t = assertFiniteNumber(timeMs, "timeMs");
    if (t > this._now) this._now = t;
    return t;
  }

  private _frameSpan(): number {
    return Math.min(360, this._config.orbit.spanDeg);
  }

  private _recalcFrames(): void {
    this._degPerFrame = this._frameSpan() / Math.max(1, this._frameCount);
  }

  private _applyConfig(): void {
    this._axis = this._config.orbit.axis;
    this._minAngle = this._config.orbit.minAngle;
    this._maxAngle = this._config.orbit.maxAngle;
    this._limited = this._minAngle > -180 || this._maxAngle < 180;
    if (this._limited) {
      this._target = clampNum(this._target, this._minAngle, this._maxAngle);
      this._angle = clampNum(this._angle, this._minAngle, this._maxAngle);
    }
    this._autoState = this._config.auto.enabled ? this._config.auto.dir : "off";
    this._autoDir = this._autoState === "ccw" ? -1 : 1;
    this._autoSpeed = this._config.auto.degPerSec;
    this._recalcFrames();
  }

  private _normAngle(value: number): number {
    if (!Number.isFinite(value)) return this._limited ? this._minAngle : 0;
    if (this._limited) return clampNum(value, this._minAngle, this._maxAngle);
    return wrapSigned(value);
  }

  private _angleDelta(from: number, to: number): number {
    return this._limited ? to - from : shortDelta(from, to);
  }

  private _frameIndex(): number {
    if (!this._frameCount) return 0;
    const dirSign = this._config.orbit.direction === "ccw" ? -1 : 1;
    const angle = wrapSigned(this._angle * dirSign);
    const span = this._frameSpan();
    if (span >= 360) {
      return mod(roundHalfUp(mod(angle, 360) / this._degPerFrame), this._frameCount);
    }
    const t = (angle + span / 2) / span;
    return Math.min(this._frameCount - 1, Math.max(0, roundHalfUp(t * (this._frameCount - 1))));
  }
}

export function createEngine(bundle: EngineBundle, options: EngineOptions = {}): OrbitEngine {
  return new OrbitEngine(bundle, options);
}
