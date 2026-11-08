#!/usr/bin/env node
/**
 * Rebuilds ORB3 fixtures and conformance case skeletons.
 *
 *   node scripts/conformance/generate.mjs
 *   node scripts/conformance/freeze.mjs   # fill engine/layout/lifecycle expectations
 *
 * Parser expectations are deterministic and written here. Engine/layout/lifecycle
 * expectations are frozen once from the reference TypeScript engine, then committed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = 0x00010002;
const FORMAT = "orbit360.bundle";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function frameBytes(video, frame, length) {
  const out = Buffer.alloc(length);
  for (let i = 0; i < length; i++) out[i] = (video * 37 + frame * 11 + i * 3 + 1) & 0xff;
  return out;
}

function sceneOrbit(overrides = {}) {
  return {
    axis: "x",
    direction: "cw",
    spanDeg: 360,
    minAngle: -180,
    maxAngle: 180,
    ...overrides,
  };
}

function makeMeta({ title, canvas, orbit, videos, initialAngle = 0, overrides = {} }) {
  let indexStart = 0;
  const videoMeta = videos.map((video, i) => {
    const frames = {
      count: video.count,
      width: Math.max(1, video.rect.width),
      height: Math.max(1, video.rect.height),
      fps: 12,
      indexStart,
    };
    indexStart += video.count;
    return {
      id: `v${i + 1}`,
      rect: video.rect,
      source: { file: `v${i + 1}.mp4` },
      orbit: { ...orbit },
      frames,
    };
  });
  return {
    format: FORMAT,
    version: 1.2,
    title,
    canvas,
    totalFrames: videos.reduce((sum, video) => sum + video.count, 0),
    codec: "image/webp",
    initialAngle,
    orbit: { ...orbit },
    videos: videoMeta,
    ...overrides,
  };
}

function buildOrb({ meta, videos, rawMeta }) {
  const metaBytes = Buffer.from(rawMeta !== undefined ? rawMeta : JSON.stringify(meta), "utf8");
  const payload = [];
  const frames = videos.map((video, vi) =>
    Array.from({ length: video.count }, (_, fi) => frameBytes(vi, fi, video.frameLength || 4)),
  );
  for (const list of frames) for (const bytes of list) payload.push(bytes);
  const frameCount = payload.length;
  const indexLen = frameCount * 16;
  const prefixLen = 32 + metaBytes.length + indexLen;
  const header = Buffer.alloc(32);
  header.write("ORB3", 0, "ascii");
  header.writeUInt32LE(VERSION, 4);
  header.writeUInt32LE(prefixLen, 8);
  header.writeUInt32LE(metaBytes.length, 12);
  header.writeUInt32LE(indexLen, 16);
  header.writeUInt32LE(frameCount, 20);
  header.writeUInt32LE(16, 24);
  header.writeUInt32LE(0, 28);
  const index = Buffer.alloc(indexLen);
  let offset = prefixLen;
  let entry = 0;
  for (let vi = 0; vi < frames.length; vi++) {
    for (const bytes of frames[vi]) {
      const base = entry * 16;
      index.writeUInt32LE(vi, base);
      index.writeUInt32LE(bytes.length, base + 4);
      index.writeBigUInt64LE(BigInt(offset), base + 8);
      offset += bytes.length;
      entry++;
    }
  }
  const buffer = Buffer.concat([header, metaBytes, index, ...payload]);
  return { buffer, frames };
}

function mutate(input, fn) {
  const copy = Buffer.from(input.buffer || input);
  fn(copy);
  return copy;
}

const fixtures = path.join(ROOT, "fixtures/orb");
fs.rmSync(fixtures, { recursive: true, force: true });
fs.rmSync(path.join(ROOT, "conformance"), { recursive: true, force: true });

const singleMeta = (overrides = {}) =>
  makeMeta({
    title: "single",
    canvas: { width: 64, height: 32 },
    orbit: sceneOrbit(),
    videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 4 }],
    ...overrides,
  });

const valid = [];
function addValid(name, { meta, videos, rawMeta }) {
  const built = buildOrb({ meta, videos, rawMeta });
  fs.mkdirSync(path.join(fixtures, "valid"), { recursive: true });
  fs.writeFileSync(path.join(fixtures, "valid", `${name}.orb`), built.buffer);
  valid.push({
    name: `valid-${name}`,
    kind: "parser",
    file: `fixtures/orb/valid/${name}.orb`,
    expect: {
      success: true,
      frameCount: built.frames.reduce((sum, list) => sum + list.length, 0),
      videoCount: built.frames.length,
      videoFrameCounts: built.frames.map((list) => list.length),
      canvas: meta.canvas,
      initialAngle: meta.initialAngle,
      frames: built.frames.map((list) => list.map((bytes) => bytes.toString("base64"))),
    },
  });
}

addValid("minimal", {
  meta: makeMeta({
    title: "minimal",
    canvas: { width: 8, height: 8 },
    orbit: sceneOrbit(),
    videos: [{ rect: { x: 0, y: 0, width: 8, height: 8 }, count: 1 }],
  }),
  videos: [{ rect: { x: 0, y: 0, width: 8, height: 8 }, count: 1, frameLength: 1 }],
});

addValid("single-video", {
  meta: singleMeta(),
  videos: [
    {
      rect: { x: 0, y: 0, width: 64, height: 32 },
      count: 4,
      frameLength: 5,
    },
  ],
});

addValid("multi-video", {
  meta: makeMeta({
    title: "multi-video",
    canvas: { width: 64, height: 32 },
    orbit: sceneOrbit(),
    videos: [
      { rect: { x: 0, y: 0, width: 32, height: 32 }, count: 3 },
      { rect: { x: 32, y: 0, width: 32, height: 32 }, count: 5 },
    ],
  }),
  videos: [
    { rect: { x: 0, y: 0, width: 32, height: 32 }, count: 3, frameLength: 4 },
    { rect: { x: 32, y: 0, width: 32, height: 32 }, count: 5, frameLength: 6 },
  ],
});

addValid("multi-layer", {
  meta: makeMeta({
    title: "multi-layer",
    canvas: { width: 64, height: 64 },
    orbit: sceneOrbit(),
    videos: [
      { rect: { x: 0, y: 0, width: 32, height: 32 }, count: 4 },
      { rect: { x: 32, y: 0, width: 32, height: 32 }, count: 6 },
      { rect: { x: 0, y: 32, width: 64, height: 32 }, count: 3 },
    ],
  }),
  videos: [
    { rect: { x: 0, y: 0, width: 32, height: 32 }, count: 4 },
    { rect: { x: 32, y: 0, width: 32, height: 32 }, count: 6 },
    { rect: { x: 0, y: 32, width: 64, height: 32 }, count: 3 },
  ],
});

addValid("limited-angle", {
  meta: makeMeta({
    title: "limited-angle",
    canvas: { width: 64, height: 32 },
    orbit: sceneOrbit({ spanDeg: 180, direction: "ccw", minAngle: -90, maxAngle: 90 }),
    initialAngle: -45,
    videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 8 }],
  }),
  videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 8 }],
});

addValid("axis-y", {
  meta: makeMeta({
    title: "axis-y",
    canvas: { width: 64, height: 32 },
    orbit: sceneOrbit({ axis: "y" }),
    videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 5 }],
  }),
  videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 5 }],
});

for (const item of valid) {
  writeJson(path.join(ROOT, "conformance/parser", `${item.name}.json`), item);
}

const invalid = [];
function addInvalid(name, code, built) {
  const bytes = Buffer.isBuffer(built) ? built : built.buffer;
  fs.mkdirSync(path.join(fixtures, "invalid"), { recursive: true });
  fs.writeFileSync(path.join(fixtures, "invalid", `${name}.orb`), bytes);
  invalid.push({
    name: `invalid-${name}`,
    kind: "parser",
    file: `fixtures/orb/invalid/${name}.orb`,
    expect: { success: false, errorCode: code },
  });
}

const base = buildOrb({
  meta: singleMeta(),
  videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 4 }],
});

addInvalid(
  "magic",
  "ORB_INVALID_MAGIC",
  mutate(base, (buffer) => buffer.write("NOPE", 0, "ascii")),
);
addInvalid(
  "unsupported-version",
  "ORB_UNSUPPORTED_VERSION",
  mutate(base, (buffer) => buffer.writeUInt32LE(0x00010001, 4)),
);
addInvalid("truncated-header", "ORB_TRUNCATED_HEADER", { buffer: base.buffer.subarray(0, 20) });
addInvalid(
  "invalid-prefix-length",
  "ORB_INVALID_PREFIX_LENGTH",
  mutate(base, (buffer) => buffer.writeUInt32LE(buffer.readUInt32LE(8) + 1, 8)),
);
addInvalid("invalid-index-length", "ORB_INVALID_INDEX_LENGTH", {
  buffer: mutate(base, (buffer) => buffer.writeUInt32LE(buffer.readUInt32LE(16) + 1, 16)),
});
addInvalid("invalid-index-entry-size", "ORB_INVALID_INDEX_ENTRY_SIZE", {
  buffer: mutate(base, (buffer) => buffer.writeUInt32LE(24, 24)),
});
addInvalid("zero-frame-count", "ORB_INVALID_FRAME_COUNT", {
  buffer: mutate(base, (buffer) => {
    const metaLen = buffer.readUInt32LE(12);
    buffer.writeUInt32LE(0, 20);
    buffer.writeUInt32LE(0, 16);
    buffer.writeUInt32LE(32 + metaLen, 8);
  }),
});
addInvalid("truncated-prefix", "ORB_TRUNCATED_PREFIX", {
  buffer: base.buffer.subarray(0, base.buffer.readUInt32LE(8) - 1),
});

const badJsonMeta = buildOrb({
  rawMeta: '{"format":',
  videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 4 }],
});
addInvalid("meta-json", "ORB_INVALID_META_JSON", badJsonMeta);

const nonObjectMeta = buildOrb({
  rawMeta: "[]",
  videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 4 }],
});
addInvalid("meta-not-object", "ORB_INVALID_META", nonObjectMeta);

function invalidMeta(name, code, mutateMeta) {
  const meta = singleMeta();
  mutateMeta(meta);
  addInvalid(
    name,
    code,
    buildOrb({
      meta,
      videos: [{ rect: { x: 0, y: 0, width: 64, height: 32 }, count: 4 }],
    }),
  );
}

invalidMeta("format", "ORB_INVALID_FORMAT", (meta) => (meta.format = "other"));
invalidMeta("meta-version", "ORB_INVALID_META_VERSION", (meta) => (meta.version = 1.1));
invalidMeta("canvas", "ORB_INVALID_CANVAS", (meta) => (meta.canvas.width = 0));
invalidMeta("total-frames", "ORB_FRAME_COUNT_MISMATCH", (meta) => (meta.totalFrames += 1));
invalidMeta("codec", "ORB_INVALID_CODEC", (meta) => (meta.codec = ""));
invalidMeta("videos", "ORB_INVALID_VIDEOS", (meta) => (meta.videos = []));
invalidMeta("axis", "ORB_INVALID_AXIS", (meta) => (meta.orbit.axis = "z"));
invalidMeta("direction", "ORB_INVALID_DIRECTION", (meta) => (meta.orbit.direction = "up"));
invalidMeta("span", "ORB_INVALID_SPAN", (meta) => (meta.orbit.spanDeg = 0));
invalidMeta("angle-range", "ORB_INVALID_ANGLE_RANGE", (meta) => {
  meta.orbit.minAngle = 100;
  meta.orbit.maxAngle = 50;
});
invalidMeta("rect", "ORB_INVALID_RECT", (meta) => (meta.videos[0].rect.width = 65));
invalidMeta("video-orbit", "ORB_INVALID_VIDEO_ORBIT", (meta) => (meta.videos[0].orbit.axis = "y"));
invalidMeta(
  "video-frame-count",
  "ORB_INVALID_FRAME_COUNT",
  (meta) => (meta.videos[0].frames.count = 0),
);

const twoVideoMeta = makeMeta({
  title: "two",
  canvas: { width: 64, height: 32 },
  orbit: sceneOrbit(),
  videos: [
    { rect: { x: 0, y: 0, width: 32, height: 32 }, count: 3 },
    { rect: { x: 32, y: 0, width: 32, height: 32 }, count: 5 },
  ],
});
const twoVideos = [
  { rect: { x: 0, y: 0, width: 32, height: 32 }, count: 3 },
  { rect: { x: 32, y: 0, width: 32, height: 32 }, count: 5 },
];
const indexStartMeta = JSON.parse(JSON.stringify(twoVideoMeta));
indexStartMeta.videos[1].frames.indexStart = 1;
addInvalid("index-start", "ORB_INVALID_INDEX_START", {
  buffer: buildOrb({ meta: indexStartMeta, videos: twoVideos }).buffer,
});

const indexStartBase = buildOrb({ meta: twoVideoMeta, videos: twoVideos });
addInvalid(
  "video-index",
  "ORB_INVALID_INDEX",
  mutate(indexStartBase, (buffer) => buffer.writeUInt32LE(1, 32 + buffer.readUInt32LE(12))),
);
addInvalid(
  "zero-length",
  "ORB_INVALID_INDEX",
  mutate(indexStartBase, (buffer) => buffer.writeUInt32LE(0, 32 + buffer.readUInt32LE(12) + 4)),
);
addInvalid(
  "offset",
  "ORB_INVALID_INDEX",
  mutate(indexStartBase, (buffer) => {
    const at = 32 + buffer.readUInt32LE(12) + 8;
    buffer.writeBigUInt64LE(buffer.readBigUInt64LE(at) + 1n, at);
  }),
);
addInvalid(
  "truncated-frame",
  "ORB_TRUNCATED_FRAME",
  mutate(indexStartBase, (buffer) => {
    const at = 32 + buffer.readUInt32LE(12) + 4;
    buffer.writeUInt32LE(buffer.length - 1, at);
  }),
);
addInvalid("trailing-data", "ORB_INVALID_INDEX", {
  buffer: Buffer.concat([indexStartBase.buffer, Buffer.from([0])]),
});

for (const item of invalid) {
  writeJson(path.join(ROOT, "conformance/parser", `${item.name}.json`), item);
}

// ---------------------------------------------------------------------------
// Engine / layout / lifecycle case skeletons. freeze.mjs fills `expect`.
// ---------------------------------------------------------------------------

const fullOrbit = sceneOrbit();
const fullBundle = (count = 36, extra = {}) => ({
  canvas: { width: 1280, height: 720 },
  initialAngle: 0,
  videos: [{ rect: { x: 0, y: 0, width: 1280, height: 720 }, frameCount: count }],
  sceneConfig: { orbit: fullOrbit },
  ...extra,
});

function engineCase(name, { bundle = fullBundle(), config = {}, events, expect = {} }) {
  writeJson(path.join(ROOT, "conformance/engine", `${name}.json`), {
    name,
    kind: "engine",
    bundle,
    config,
    events,
    expect,
  });
}

engineCase("initial-angle", {
  bundle: fullBundle(36, { initialAngle: 45 }),
  events: [],
  expect: {},
});

engineCase("set-angle-immediate", {
  events: [{ type: "setAngle", angle: 180, immediate: true }],
  expect: {},
});

engineCase("rotate-by", {
  events: [
    { type: "setAngle", angle: 0, immediate: true },
    { type: "rotateBy", deg: 15 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("frame-boundary", {
  bundle: fullBundle(7),
  events: [{ type: "setAngle", angle: 180, immediate: true }],
  expect: {},
});

engineCase("motion-smoothing", {
  events: [
    { type: "setAngle", angle: 90 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("drag-horizontal", {
  events: [
    { type: "pointerDown", x: 100, y: 200, timeMs: 0 },
    { type: "pointerMove", x: 160, y: 200, timeMs: 16 },
    { type: "pointerUp", timeMs: 32 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("drag-y-axis", {
  bundle: fullBundle(36, { sceneConfig: { orbit: sceneOrbit({ axis: "y" }) } }),
  events: [
    { type: "pointerDown", x: 100, y: 100, timeMs: 0 },
    { type: "pointerMove", x: 100, y: 160, timeMs: 16 },
    { type: "pointerUp", timeMs: 32 },
  ],
  expect: {},
});

engineCase("drag-invert", {
  config: { drag: { invert: true } },
  events: [
    { type: "pointerDown", x: 100, y: 100, timeMs: 0 },
    { type: "pointerMove", x: 160, y: 100, timeMs: 16 },
    { type: "pointerUp", timeMs: 32 },
  ],
  expect: {},
});

engineCase("drag-inertia", {
  events: [
    { type: "pointerDown", x: 100, y: 100, timeMs: 0 },
    { type: "pointerMove", x: 160, y: 100, timeMs: 16 },
    { type: "pointerUp", timeMs: 32 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("inertia-disabled", {
  config: { drag: { inertia: false } },
  events: [
    { type: "pointerDown", x: 100, y: 100, timeMs: 0 },
    { type: "pointerMove", x: 160, y: 100, timeMs: 16 },
    { type: "pointerUp", timeMs: 32 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("limited-angle", {
  bundle: fullBundle(36, {
    sceneConfig: { orbit: sceneOrbit({ minAngle: -30, maxAngle: 45 }) },
  }),
  events: [
    { type: "setAngle", angle: 100, immediate: true },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("limited-drag-boundary", {
  bundle: fullBundle(36, {
    sceneConfig: { orbit: sceneOrbit({ minAngle: -30, maxAngle: 45 }) },
  }),
  events: [
    { type: "pointerDown", x: 0, y: 0, timeMs: 0 },
    { type: "pointerMove", x: 1000, y: 0, timeMs: 16 },
    { type: "pointerUp", timeMs: 32 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("ccw-frames", {
  bundle: fullBundle(36, { sceneConfig: { orbit: sceneOrbit({ direction: "ccw" }) } }),
  events: [{ type: "setAngle", angle: 30, immediate: true }],
  expect: {},
});

engineCase("span-180", {
  bundle: fullBundle(18, {
    sceneConfig: { orbit: sceneOrbit({ spanDeg: 180 }) },
  }),
  events: [
    { type: "setAngle", angle: -90, immediate: true },
    { type: "setAngle", angle: 0, immediate: true },
    { type: "setAngle", angle: 90, immediate: true },
  ],
  expect: {},
});

engineCase("multi-layer", {
  bundle: {
    canvas: { width: 1280, height: 720 },
    initialAngle: 0,
    videos: [
      { rect: { x: 0, y: 0, width: 640, height: 720 }, frameCount: 36 },
      { rect: { x: 640, y: 0, width: 640, height: 720 }, frameCount: 12 },
      { rect: { x: 0, y: 0, width: 1280, height: 720 }, frameCount: 5 },
    ],
    sceneConfig: { orbit: fullOrbit },
  },
  events: [{ type: "setAngle", angle: 100, immediate: true }],
  expect: {},
});

engineCase("auto-wait", {
  config: { auto: { enabled: true, idleDelayMs: 100 } },
  events: [
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("auto-ramp-in-out", {
  config: { auto: { enabled: true, idleDelayMs: 0, rampInMs: 100, rampOutMs: 100 } },
  events: [
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "pointerDown", x: 10, y: 10, timeMs: 80 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
    { type: "pointerUp", timeMs: 128 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("auto-ccw", {
  config: { auto: { enabled: true, dir: "ccw", degPerSec: 30 } },
  events: [
    { type: "advance", dtMs: 16 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("gyro-smoothing", {
  events: [
    { type: "gyro", heading: 0, timeMs: 0 },
    { type: "gyro", heading: 30, timeMs: 16 },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("gyro-invert", {
  config: { gyro: { invert: true, smooth: false } },
  events: [
    { type: "gyro", heading: 0, timeMs: 0 },
    { type: "gyro", heading: 30, timeMs: 16 },
  ],
  expect: {},
});

engineCase("pause-resume", {
  config: { auto: { enabled: true, idleDelayMs: 0 } },
  events: [
    { type: "advance", dtMs: 16 },
    { type: "pause" },
    { type: "advance", dtMs: 64 },
    { type: "resume" },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

engineCase("reset", {
  events: [
    { type: "setAngle", angle: 90, immediate: true },
    { type: "advance", dtMs: 16 },
    { type: "reset", angle: 10 },
  ],
  expect: {},
});

engineCase("unload", {
  config: { video: { fit: "cover" } },
  events: [{ type: "unload" }],
  expect: {},
});

engineCase("destroy", {
  events: [
    { type: "setAngle", angle: 30, immediate: true },
    { type: "destroy" },
    { type: "advance", dtMs: 16 },
    { type: "pointerDown", x: 0, y: 0, timeMs: 100 },
    { type: "setAngle", angle: 90, immediate: true },
  ],
  expect: {},
});

engineCase("set-config-auto", {
  events: [{ type: "setConfig", config: { auto: { enabled: true, dir: "ccw", degPerSec: 20 } } }],
  expect: {},
});

// Layout cases.
function layoutCase(name, input) {
  writeJson(path.join(ROOT, "conformance/layout", `${name}.json`), {
    name,
    kind: "layout",
    ...input,
    expect: {},
  });
}

const landscapeCanvas = { width: 1280, height: 720 };
layoutCase("landscape-contain-portrait", {
  canvas: landscapeCanvas,
  viewport: { width: 390, height: 844 },
  fit: "contain",
  displayScale: 1,
  portraitScale: 1,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 1280, height: 720 } }],
});
layoutCase("landscape-contain-landscape", {
  canvas: landscapeCanvas,
  viewport: { width: 1000, height: 600 },
  fit: "contain",
  displayScale: 1,
  portraitScale: 1.25,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 1280, height: 720 } }],
});
layoutCase("portrait-contain", {
  canvas: landscapeCanvas,
  viewport: { width: 390, height: 844 },
  fit: "contain",
  displayScale: 1,
  portraitScale: 1.25,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 1280, height: 720 } }],
});
layoutCase("landscape-cover", {
  canvas: landscapeCanvas,
  viewport: { width: 390, height: 844 },
  fit: "cover",
  displayScale: 1,
  portraitScale: 1.25,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 1280, height: 720 } }],
});
layoutCase("portrait-cover", {
  canvas: { width: 720, height: 1280 },
  viewport: { width: 1000, height: 600 },
  fit: "cover",
  displayScale: 1,
  portraitScale: 1.25,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 720, height: 1280 } }],
});
layoutCase("display-scale", {
  canvas: landscapeCanvas,
  viewport: { width: 1000, height: 600 },
  fit: "contain",
  displayScale: 1.5,
  portraitScale: 1.25,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 1280, height: 720 } }],
});
layoutCase("dpr-ignored", {
  canvas: landscapeCanvas,
  viewport: { width: 1000, height: 600 },
  fit: "contain",
  displayScale: 1,
  portraitScale: 1.25,
  dpr: 3,
  layers: [{ layerIndex: 0, rect: { x: 0, y: 0, width: 1280, height: 720 } }],
});
layoutCase("multi-layer", {
  canvas: { width: 1280, height: 720 },
  viewport: { width: 640, height: 360 },
  fit: "contain",
  displayScale: 1,
  portraitScale: 1.25,
  layers: [
    { layerIndex: 0, rect: { x: 0, y: 0, width: 640, height: 720 } },
    { layerIndex: 1, rect: { x: 640, y: 0, width: 640, height: 720 } },
  ],
});

// Lifecycle cases.
function lifecycleCase(name, { bundle = fullBundle(), config = {}, events, expect = {} }) {
  writeJson(path.join(ROOT, "conformance/lifecycle", `${name}.json`), {
    name,
    kind: "lifecycle",
    bundle,
    config,
    events,
    expect,
  });
}

lifecycleCase("load-replaces-bundle", {
  events: [
    { type: "setAngle", angle: 90, immediate: true },
    {
      type: "load",
      bundle: {
        canvas: { width: 640, height: 360 },
        initialAngle: 20,
        videos: [{ rect: { x: 0, y: 0, width: 640, height: 360 }, frameCount: 10 }],
        sceneConfig: { orbit: sceneOrbit({ spanDeg: 360 }) },
      },
    },
  ],
  expect: {},
});

lifecycleCase("unload-keeps-config", {
  config: { orbit: { spanDeg: 180 } },
  events: [
    { type: "unload" },
    { type: "load", bundle: fullBundle(18) },
    { type: "setAngle", angle: 90, immediate: true },
  ],
  expect: {},
});

lifecycleCase("load-after-unload", {
  events: [
    { type: "unload" },
    { type: "setAngle", angle: 45, immediate: true },
    { type: "load", bundle: fullBundle(36, { initialAngle: -10 }) },
  ],
  expect: {},
});

lifecycleCase("pause-freezes-time", {
  config: { auto: { enabled: true, idleDelayMs: 0, rampInMs: 100 } },
  events: [
    { type: "advance", dtMs: 16 },
    { type: "pause" },
    { type: "advance", dtMs: 64 },
    { type: "advance", dtMs: 64 },
  ],
  expect: {},
});

lifecycleCase("resume-continues", {
  config: { auto: { enabled: true, idleDelayMs: 0, rampInMs: 100 } },
  events: [
    { type: "advance", dtMs: 16 },
    { type: "pause" },
    { type: "advance", dtMs: 64 },
    { type: "resume" },
    { type: "advance", dtMs: 16 },
  ],
  expect: {},
});

lifecycleCase("reset-keeps-config", {
  config: { orbit: { minAngle: -20, maxAngle: 20 } },
  events: [
    { type: "setAngle", angle: 15, immediate: true },
    { type: "advance", dtMs: 16 },
    { type: "reset", angle: 100 },
  ],
  expect: {},
});

lifecycleCase("destroy-is-terminal", {
  events: [
    { type: "destroy" },
    { type: "advance", dtMs: 16 },
    { type: "load", bundle: fullBundle(10) },
    { type: "setAngle", angle: 45, immediate: true },
  ],
  expect: {},
});

console.log(
  `fixtures: ${valid.length} valid, ${invalid.length} invalid; cases: ` +
    `${valid.length + invalid.length} parser, 25 engine, 8 layout, 7 lifecycle`,
);
