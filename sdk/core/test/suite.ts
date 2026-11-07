import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const CONFORMANCE = fileURLToPath(new URL("../../../conformance/", import.meta.url));
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const EPSILON = 1e-6;

interface ParserExpectation {
  success: boolean;
  frameCount: number;
  videoCount: number;
  videoFrameCounts: number[];
  canvas: { width: number; height: number };
  initialAngle: number;
  frames: string[][];
  errorCode: string;
}

interface ParserCase {
  name: string;
  file: string;
  expect: ParserExpectation;
}

interface EngineCase {
  name: string;
  bundle: unknown;
  config: Record<string, unknown>;
  events: Array<Record<string, unknown> & { type: string }>;
  expect: Record<string, unknown>;
}

interface ParsedBundle {
  header: { frameCount: number };
  meta: {
    canvas: { width: number; height: number };
    initialAngle?: number;
    videos: Array<{ frames: { count: number } }>;
  };
  frameBytes(videoIndex: number, frameIndex: number): Uint8Array;
}

interface EngineLike {
  setAngle(deg: number, immediate?: boolean): unknown;
  rotateBy(deg: number): unknown;
  pointerDown(x: number, y: number, timeMs: number): unknown;
  pointerMove(x: number, y: number, timeMs: number): unknown;
  pointerUp(timeMs: number): unknown;
  gyro(sample: { heading: number; timeMs: number }): unknown;
  advance(dtMs: number): unknown;
  pause(): unknown;
  resume(): unknown;
  reset(angle?: number, immediate?: boolean): unknown;
  load(bundle: unknown): unknown;
  unload(): unknown;
  destroy(): unknown;
  setConfig(config: Record<string, unknown>): unknown;
  getSnapshot(): unknown;
}

export interface ConformanceApi {
  parse(bytes: Uint8Array): ParsedBundle;
  createEngine(bundle: unknown, options?: { config?: Record<string, unknown> }): EngineLike;
  computeLayout(input: unknown): unknown;
}

// Conformance files are repo fixtures with a known, versioned shape.
function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function listJson(dir: string): string[] {
  return fs
    .readdirSync(path.join(CONFORMANCE, dir))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function compare(actual: unknown, expected: unknown, where: string): void {
  if (typeof expected === "number") {
    expect(typeof actual, where).toBe("number");
    expect(
      Math.abs((actual as number) - expected),
      `${where}: ${actual} != ${expected}`,
    ).toBeLessThanOrEqual(EPSILON);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), where).toBe(true);
    const values = actual as unknown[];
    expect(values.length, `${where}.length`).toBe(expected.length);
    expected.forEach((value, index) => compare(values[index], value, `${where}[${index}]`));
    return;
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") throw new Error(`${where}: 期望对象`);
    const values = actual as Record<string, unknown>;
    for (const key of Object.keys(expected)) {
      compare(values[key], (expected as Record<string, unknown>)[key], `${where}.${key}`);
    }
    return;
  }
  expect(actual, where).toBe(expected);
}

function applyEvent(engine: EngineLike, event: Record<string, unknown> & { type: string }): void {
  switch (event.type) {
    case "setAngle":
      engine.setAngle(event.angle as number, event.immediate === true);
      break;
    case "rotateBy":
      engine.rotateBy(event.deg as number);
      break;
    case "pointerDown":
      engine.pointerDown(event.x as number, event.y as number, event.timeMs as number);
      break;
    case "pointerMove":
      engine.pointerMove(event.x as number, event.y as number, event.timeMs as number);
      break;
    case "pointerUp":
      engine.pointerUp(event.timeMs as number);
      break;
    case "gyro":
      engine.gyro({ heading: event.heading as number, timeMs: event.timeMs as number });
      break;
    case "advance":
      engine.advance(event.dtMs as number);
      break;
    case "pause":
      engine.pause();
      break;
    case "resume":
      engine.resume();
      break;
    case "reset":
      engine.reset(
        event.angle === undefined ? 0 : (event.angle as number),
        event.immediate !== false,
      );
      break;
    case "load":
      engine.load(event.bundle);
      break;
    case "unload":
      engine.unload();
      break;
    case "destroy":
      engine.destroy();
      break;
    case "setConfig":
      engine.setConfig(
        event.config && typeof event.config === "object"
          ? (event.config as Record<string, unknown>)
          : {},
      );
      break;
    default:
      throw new Error(`unknown event type: ${event.type}`);
  }
}

export function verifyConformance(implementation: string, api: ConformanceApi): void {
  describe(`${implementation} parser conformance`, () => {
    for (const name of listJson("parser")) {
      const item = readJson<ParserCase>(path.join(CONFORMANCE, "parser", name));
      it(item.name, () => {
        const bytes = fs.readFileSync(path.join(ROOT, item.file));
        if (item.expect.success) {
          const bundle = api.parse(bytes);
          expect(bundle.header.frameCount).toBe(item.expect.frameCount);
          expect(bundle.meta.videos.length).toBe(item.expect.videoCount);
          expect(bundle.meta.videos.map((video) => video.frames.count)).toEqual(
            item.expect.videoFrameCounts,
          );
          expect(bundle.meta.canvas).toEqual(item.expect.canvas);
          expect(bundle.meta.initialAngle ?? 0).toBe(item.expect.initialAngle);
          item.expect.frames.forEach((frames, videoIndex) => {
            frames.forEach((base64, frameIndex) => {
              expect(
                Buffer.from(bundle.frameBytes(videoIndex, frameIndex)).toString("base64"),
              ).toBe(base64);
            });
          });
        } else {
          let code = "NO_ERROR";
          try {
            api.parse(bytes);
          } catch (error: unknown) {
            code =
              error &&
              typeof error === "object" &&
              "code" in error &&
              typeof error.code === "string"
                ? error.code
                : "UNKNOWN";
          }
          expect(code).toBe(item.expect.errorCode);
        }
      });
    }
  });

  for (const dir of ["engine", "lifecycle"]) {
    describe(`${implementation} ${dir} conformance`, () => {
      for (const name of listJson(dir)) {
        const item = readJson<EngineCase>(path.join(CONFORMANCE, dir, name));
        it(item.name, () => {
          const engine = api.createEngine(item.bundle, { config: item.config });
          for (const event of item.events || []) applyEvent(engine, event);
          compare(engine.getSnapshot(), item.expect, item.name);
        });
      }
    });
  }

  describe(`${implementation} layout conformance`, () => {
    for (const name of listJson("layout")) {
      const item = readJson<Record<string, unknown>>(path.join(CONFORMANCE, "layout", name));
      it(String(item.name), () => {
        const input = { ...item };
        delete input.name;
        delete input.kind;
        delete input.expect;
        compare(api.computeLayout(input), item.expect, String(item.name));
      });
    }
  });
}
