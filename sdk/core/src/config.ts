import { fail } from "./errors";
import type { OrbitAxis, OrbitDirection } from "./orb";

export interface OrbitEngineConfig {
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
  motion: { smoothMs: number; [key: string]: unknown };
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
  mouseFollow: { enabled: boolean; degPerPx: number; [key: string]: unknown };
  [key: string]: unknown;
}

export const DEFAULTS: OrbitEngineConfig = {
  title: "",
  video: {
    displayScale: 1,
    portraitScale: 1.25,
    fit: "contain",
    width: 1280,
    height: 720,
  },
  orbit: {
    axis: "x",
    spanDeg: 360,
    direction: "cw",
    minAngle: -180,
    maxAngle: 180,
  },
  drag: {
    degPerPx: 0.42,
    touchScale: 2.5,
    invert: false,
    inertia: true,
    inertiaMs: 110,
  },
  motion: { smoothMs: 62 },
  auto: {
    enabled: false,
    dir: "cw",
    degPerSec: 36,
    idleDelayMs: 2200,
    rampInMs: 700,
    rampOutMs: 280,
  },
  gyro: {
    gain: 1,
    invert: false,
    smooth: true,
    smoothMs: 80,
  },
  mouseFollow: { enabled: false, degPerPx: 0.3 },
};

export const CONFIG_KEYS = [
  "title",
  "video",
  "orbit",
  "drag",
  "motion",
  "auto",
  "gyro",
  "mouseFollow",
  "defaults",
  "quality",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = clone(value[key]);
    return out as T;
  }
  return value;
}

// Objects merge recursively; arrays and scalars replace. This is the only
// merge semantic used by every SDK.
export function deepMerge<T>(base: T, ...sources: unknown[]): T {
  const out: Record<string, unknown> = isPlainObject(base) ? { ...base } : {};
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (isPlainObject(value) && isPlainObject(out[key])) {
        out[key] = deepMerge(out[key], value);
      } else if (isPlainObject(value)) {
        out[key] = deepMerge({}, value);
      } else if (Array.isArray(value)) {
        out[key] = value.slice();
      } else {
        out[key] = value;
      }
    }
  }
  return out as T;
}

export function resolveConfig(
  sceneConfig: Record<string, unknown> = {},
  userConfig: Record<string, unknown> = {},
): OrbitEngineConfig {
  const scene = deepMerge({}, sceneConfig) as Record<string, unknown>;
  if (isPlainObject(scene.defaults) && isPlainObject(scene.defaults.auto)) {
    scene.auto = deepMerge({}, scene.auto, scene.defaults.auto);
  }
  const merged = deepMerge({}, DEFAULTS, scene, userConfig) as unknown as OrbitEngineConfig;
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  merged.title = typeof merged.title === "string" ? merged.title : "";
  merged.video.fit = merged.video.fit === "cover" ? "cover" : "contain";
  merged.video.displayScale = number(merged.video.displayScale, 1);
  merged.video.portraitScale = number(merged.video.portraitScale, 1.25);
  merged.video.width = number(merged.video.width, 1280);
  merged.video.height = number(merged.video.height, 720);

  merged.orbit.axis = merged.orbit.axis === "y" ? "y" : "x";
  merged.orbit.direction = merged.orbit.direction === "ccw" ? "ccw" : "cw";
  const span = number(merged.orbit.spanDeg, 360);
  merged.orbit.spanDeg = span > 0 ? Math.min(360, span) : 360;
  let minAngle = number(merged.orbit.minAngle, -180);
  let maxAngle = number(merged.orbit.maxAngle, 180);
  minAngle = Math.min(180, Math.max(-180, minAngle));
  maxAngle = Math.min(180, Math.max(-180, maxAngle));
  if (minAngle > maxAngle) [minAngle, maxAngle] = [maxAngle, minAngle];
  merged.orbit.minAngle = minAngle;
  merged.orbit.maxAngle = maxAngle;

  merged.drag.degPerPx = number(merged.drag.degPerPx, 0.42);
  merged.drag.touchScale = Math.min(10, Math.max(0.1, number(merged.drag.touchScale, 2.5)));
  merged.drag.invert = merged.drag.invert === true;
  merged.drag.inertia = merged.drag.inertia !== false;
  merged.drag.inertiaMs = number(merged.drag.inertiaMs, 110);
  merged.motion.smoothMs = number(merged.motion.smoothMs, 62);

  merged.auto.enabled = merged.auto.enabled === true;
  merged.auto.dir = merged.auto.dir === "ccw" ? "ccw" : "cw";
  merged.auto.degPerSec = number(merged.auto.degPerSec, 36);
  merged.auto.idleDelayMs = number(merged.auto.idleDelayMs, 2200);
  merged.auto.rampInMs = number(merged.auto.rampInMs, 700);
  merged.auto.rampOutMs = number(merged.auto.rampOutMs, 280);

  merged.gyro.gain = number(merged.gyro.gain, 1);
  merged.gyro.invert = merged.gyro.invert === true;
  merged.gyro.smooth = merged.gyro.smooth !== false;
  merged.gyro.smoothMs = number(merged.gyro.smoothMs, 80);

  merged.mouseFollow.enabled = merged.mouseFollow.enabled === true;
  merged.mouseFollow.degPerPx = number(merged.mouseFollow.degPerPx, 0.3);
  return merged;
}

export function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("ORB_INVALID_ARGUMENT", `${label} 必须是数字`);
  }
  return value;
}
