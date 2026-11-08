Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region ../core/src/errors.ts
var OrbError = class extends Error {
	constructor(code, message, offset) {
		super(message);
		this.name = "OrbError";
		this.code = code;
		this.offset = offset;
	}
};
function fail(code, message, offset) {
	throw new OrbError(code, message, offset);
}
//#endregion
//#region ../core/src/orb.ts
const MAGIC = [
	79,
	82,
	66,
	51
];
const HEADER_SIZE = 32;
const ENTRY_SIZE = 16;
const FORMAT = "orbit360.bundle";
const VERSION = 65538;
const META_VERSION = 1.2;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function isInt(value) {
	return typeof value === "number" && Number.isFinite(value) && Math.floor(value) === value;
}
function decodeUtf8(bytes) {
	let out = "";
	let i = 0;
	while (i < bytes.length) {
		const b = bytes[i++];
		if (b < 128) out += String.fromCharCode(b);
		else if (b < 224) {
			if (i >= bytes.length) fail("ORB_INVALID_META_JSON", "截断的 UTF-8");
			out += String.fromCharCode((b & 31) << 6 | bytes[i++] & 63);
		} else if (b < 240) {
			if (i + 1 >= bytes.length) fail("ORB_INVALID_META_JSON", "截断的 UTF-8");
			out += String.fromCharCode((b & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63);
		} else {
			if (i + 2 >= bytes.length) fail("ORB_INVALID_META_JSON", "截断的 UTF-8");
			const v = ((b & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63) - 65536;
			out += String.fromCharCode(55296 + (v >> 10), 56320 + (v & 1023));
		}
	}
	return out;
}
function normalizeOrbit(raw, where) {
	if (raw === void 0 || raw === null) raw = {};
	if (!isObject(raw)) fail("ORB_INVALID_ORBIT", `${where} 不是对象`);
	const axis = raw.axis === void 0 ? "x" : raw.axis;
	if (axis !== "x" && axis !== "y") fail("ORB_INVALID_AXIS", `${where}.axis 非法`);
	const direction = raw.direction === void 0 ? "cw" : raw.direction;
	if (direction !== "cw" && direction !== "ccw") fail("ORB_INVALID_DIRECTION", `${where}.direction 非法`);
	const spanDeg = raw.spanDeg === void 0 ? 360 : raw.spanDeg;
	if (typeof spanDeg !== "number" || !Number.isFinite(spanDeg) || spanDeg <= 0 || spanDeg > 360) fail("ORB_INVALID_SPAN", `${where}.spanDeg 非法`);
	const minAngle = raw.minAngle === void 0 ? -180 : raw.minAngle;
	const maxAngle = raw.maxAngle === void 0 ? 180 : raw.maxAngle;
	if (typeof minAngle !== "number" || !Number.isFinite(minAngle) || typeof maxAngle !== "number" || !Number.isFinite(maxAngle) || minAngle < -180 || maxAngle > 180 || minAngle >= maxAngle) fail("ORB_INVALID_ANGLE_RANGE", `${where}.minAngle/maxAngle 非法`);
	return {
		axis,
		direction,
		spanDeg,
		minAngle,
		maxAngle
	};
}
function sceneConfigFromMeta(meta) {
	const keys = [
		"title",
		"video",
		"orbit",
		"drag",
		"motion",
		"auto",
		"gyro",
		"mouseFollow",
		"defaults",
		"quality"
	];
	const out = {};
	for (const key of keys) if (meta[key] !== void 0) out[key] = meta[key];
	return out;
}
function toBytes(input) {
	if (input instanceof Uint8Array) return input;
	if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
	if (input instanceof ArrayBuffer) return new Uint8Array(input);
	fail("ORB_INVALID_ARGUMENT", "parse 需要 ArrayBuffer / Uint8Array");
}
function parse$1(input) {
	const bytes = toBytes(input);
	const size = bytes.length;
	if (size < 32) fail("ORB_TRUNCATED_HEADER", "头部不足 32 字节");
	for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) fail("ORB_INVALID_MAGIC", "magic 不是 ORB3");
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const header = {
		version: dv.getUint32(4, true),
		prefixLen: dv.getUint32(8, true),
		metaLen: dv.getUint32(12, true),
		indexLen: dv.getUint32(16, true),
		frameCount: dv.getUint32(20, true),
		indexEntrySize: dv.getUint32(24, true),
		flags: dv.getUint32(28, true)
	};
	if (header.version !== 65538) fail("ORB_UNSUPPORTED_VERSION", `不支持的版本 ${header.version >>> 16}.${header.version & 65535}`, 4);
	if (header.indexEntrySize !== 16) fail("ORB_INVALID_INDEX_ENTRY_SIZE", "不支持的索引项大小", 24);
	if (header.frameCount <= 0) fail("ORB_INVALID_FRAME_COUNT", "frameCount 为 0", 20);
	if (header.indexLen !== header.frameCount * 16) fail("ORB_INVALID_INDEX_LENGTH", "indexLen 与 frameCount 不一致", 16);
	if (header.prefixLen !== 32 + header.metaLen + header.indexLen) fail("ORB_INVALID_PREFIX_LENGTH", "prefixLen 不一致", 8);
	if (size < header.prefixLen) fail("ORB_TRUNCATED_PREFIX", "Header/Meta/Index 不完整");
	let parsed;
	try {
		parsed = JSON.parse(decodeUtf8(bytes.subarray(32, 32 + header.metaLen)));
	} catch (err) {
		fail("ORB_INVALID_META_JSON", `meta 不是合法 JSON: ${err.message}`);
	}
	if (!isObject(parsed)) fail("ORB_INVALID_META", "meta 不是对象");
	const meta = parsed;
	if (meta.format !== "orbit360.bundle") fail("ORB_INVALID_FORMAT", "meta.format 非法");
	if (meta.version !== 1.2) fail("ORB_INVALID_META_VERSION", "meta.version 非法");
	const canvas = isObject(meta.canvas) ? meta.canvas : null;
	if (!canvas || !isInt(canvas.width) || !isInt(canvas.height) || canvas.width <= 0 || canvas.height <= 0) fail("ORB_INVALID_CANVAS", "meta 缺少合法的 canvas");
	if (meta.totalFrames !== header.frameCount) fail("ORB_FRAME_COUNT_MISMATCH", "meta.totalFrames 与头部不一致");
	if (typeof meta.codec !== "string" || !meta.codec) fail("ORB_INVALID_CODEC", "meta 缺少 codec");
	if (!Array.isArray(meta.videos) || !meta.videos.length) fail("ORB_INVALID_VIDEOS", "meta 缺少 videos 数组");
	const sceneOrbit = normalizeOrbit(meta.orbit, "meta.orbit");
	const layers = [];
	let sum = 0;
	let expectStart = 0;
	for (let vi = 0; vi < meta.videos.length; vi++) {
		const video = meta.videos[vi];
		if (!isObject(video) || !isObject(video.frames) || !isObject(video.rect)) fail("ORB_INVALID_VIDEOS", `视频 ${vi} 缺少 rect/frames`);
		const frames = video.frames;
		const rect = video.rect;
		if (!isInt(frames.count) || frames.count <= 0) fail("ORB_INVALID_FRAME_COUNT", `视频 ${vi} 的 frames.count 非法`);
		if (frames.indexStart !== expectStart) fail("ORB_INVALID_INDEX_START", `视频 ${vi} 的 indexStart 不连续`);
		const videoOrbit = normalizeOrbit(video.orbit, `视频 ${vi} 的 orbit`);
		if (videoOrbit.axis !== sceneOrbit.axis || videoOrbit.direction !== sceneOrbit.direction || videoOrbit.spanDeg !== sceneOrbit.spanDeg || videoOrbit.minAngle !== sceneOrbit.minAngle || videoOrbit.maxAngle !== sceneOrbit.maxAngle) fail("ORB_INVALID_VIDEO_ORBIT", `视频 ${vi} 的 orbit 与场景不一致`);
		if (!isInt(rect.x) || !isInt(rect.y) || !isInt(rect.width) || !isInt(rect.height)) fail("ORB_INVALID_RECT", `视频 ${vi} 的 rect 不是整数`);
		if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > canvas.width || rect.y + rect.height > canvas.height) fail("ORB_INVALID_RECT", `视频 ${vi} 的 rect 越界`);
		layers.push({
			videoIndex: vi,
			rect: {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height
			},
			frameCount: frames.count,
			indexStart: frames.indexStart
		});
		expectStart += frames.count;
		sum += frames.count;
	}
	if (sum !== header.frameCount) fail("ORB_FRAME_COUNT_MISMATCH", "videos 帧数之和与 frameCount 不一致");
	const entries = [];
	let expectedOff = header.prefixLen;
	let e = 0;
	for (let vi = 0; vi < layers.length; vi++) {
		const count = layers[vi].frameCount;
		for (let k = 0; k < count; k++) {
			const base = 32 + header.metaLen + e * 16;
			const video = dv.getUint32(base, true);
			const length = dv.getUint32(base + 4, true);
			const lo = dv.getUint32(base + 8, true);
			const offset = dv.getUint32(base + 12, true) * 4294967296 + lo;
			if (offset > MAX_SAFE) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 offset 超出安全整数`);
			if (video !== vi) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 video 编号不对`);
			if (length === 0) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 length 为 0`);
			if (offset !== expectedOff) fail("ORB_INVALID_INDEX", `第 ${e} 条索引 offset 不连续`);
			if (offset + length > size) fail("ORB_TRUNCATED_FRAME", `第 ${e} 条索引越界`);
			entries.push({
				video,
				length,
				offset
			});
			expectedOff += length;
			e++;
		}
	}
	if (expectedOff !== size) fail("ORB_INVALID_INDEX", "索引与文件长度不一致");
	const bundle = {
		header,
		meta,
		entries,
		layers,
		size,
		sceneConfig: sceneConfigFromMeta(meta),
		frameEntry(videoIndex, frameIndex) {
			if (!isInt(videoIndex) || videoIndex < 0 || videoIndex >= layers.length) fail("ORB_INVALID_ARGUMENT", `没有视频 ${videoIndex}`);
			const layer = layers[videoIndex];
			if (!isInt(frameIndex) || frameIndex < 0 || frameIndex >= layer.frameCount) fail("ORB_INVALID_ARGUMENT", `视频 ${videoIndex} 没有第 ${frameIndex} 帧`);
			return entries[layer.indexStart + frameIndex];
		},
		frameBytes(videoIndex, frameIndex) {
			const entry = bundle.frameEntry(videoIndex, frameIndex);
			return bytes.subarray(entry.offset, entry.offset + entry.length);
		}
	};
	return bundle;
}
//#endregion
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}
//#endregion
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}
//#endregion
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}
//#endregion
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/objectSpread2.js
function ownKeys(e, r) {
	var t = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var o = Object.getOwnPropertySymbols(e);
		r && (o = o.filter(function(r) {
			return Object.getOwnPropertyDescriptor(e, r).enumerable;
		})), t.push.apply(t, o);
	}
	return t;
}
function _objectSpread2(e) {
	for (var r = 1; r < arguments.length; r++) {
		var t = null != arguments[r] ? arguments[r] : {};
		r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
			_defineProperty(e, r, t[r]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
			Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
		});
	}
	return e;
}
//#endregion
//#region ../miniprogram/src/orb.ts
const VERSION_MAJOR = 1;
const VERSION_MINOR = 2;
const B64$1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64(bytes) {
	const parts = [];
	let chunk = "";
	let index = 0;
	for (; index + 2 < bytes.length; index += 3) {
		const n = bytes[index] << 16 | bytes[index + 1] << 8 | bytes[index + 2];
		chunk += B64$1[n >> 18 & 63] + B64$1[n >> 12 & 63] + B64$1[n >> 6 & 63] + B64$1[n & 63];
		if (chunk.length >= 8192) {
			parts.push(chunk);
			chunk = "";
		}
	}
	const left = bytes.length - index;
	if (left === 1) {
		const n = bytes[index] << 16;
		chunk += B64$1[n >> 18 & 63] + B64$1[n >> 12 & 63] + "==";
	} else if (left === 2) {
		const n = bytes[index] << 16 | bytes[index + 1] << 8;
		chunk += B64$1[n >> 18 & 63] + B64$1[n >> 12 & 63] + B64$1[n >> 6 & 63] + "=";
	}
	parts.push(chunk);
	return parts.join("");
}
function parse(buffer) {
	const core = parse$1(buffer);
	return _objectSpread2(_objectSpread2({}, core), {}, {
		frameEntry: (videoIndex, frameIndex) => core.frameEntry(videoIndex, frameIndex),
		frameBytes: (videoIndex, frameIndex) => core.frameBytes(videoIndex, frameIndex),
		frameDataUrl(videoIndex, frameIndex) {
			return `data:${typeof core.meta.codec === "string" && core.meta.codec ? core.meta.codec : "image/webp"};base64,${bytesToBase64(core.frameBytes(videoIndex, frameIndex))}`;
		}
	});
}
const OrbBundle = {
	parse,
	HEADER_SIZE: 32,
	ENTRY_SIZE: 16,
	VERSION: 65538
};
//#endregion
//#region ../core/src/config.ts
const DEFAULTS = {
	title: "",
	video: {
		displayScale: 1,
		portraitScale: 1.25,
		fit: "contain",
		width: 1280,
		height: 720
	},
	orbit: {
		axis: "x",
		spanDeg: 360,
		direction: "cw",
		minAngle: -180,
		maxAngle: 180
	},
	drag: {
		degPerPx: .42,
		touchScale: 2.5,
		invert: false,
		inertia: true,
		inertiaMs: 110
	},
	motion: { smoothMs: 62 },
	auto: {
		enabled: false,
		dir: "cw",
		degPerSec: 36,
		idleDelayMs: 2200,
		rampInMs: 700,
		rampOutMs: 280
	},
	gyro: {
		gain: 1,
		invert: false,
		smooth: true,
		smoothMs: 80
	},
	mouseFollow: {
		enabled: false,
		degPerPx: .3
	}
};
function isPlainObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function clone(value) {
	if (Array.isArray(value)) return value.map(clone);
	if (isPlainObject(value)) {
		const out = {};
		for (const key of Object.keys(value)) out[key] = clone(value[key]);
		return out;
	}
	return value;
}
function deepMerge(base, ...sources) {
	const out = isPlainObject(base) ? _objectSpread2({}, base) : {};
	for (const source of sources) {
		if (!isPlainObject(source)) continue;
		for (const key of Object.keys(source)) {
			const value = source[key];
			if (isPlainObject(value) && isPlainObject(out[key])) out[key] = deepMerge(out[key], value);
			else if (isPlainObject(value)) out[key] = deepMerge({}, value);
			else if (Array.isArray(value)) out[key] = value.slice();
			else out[key] = value;
		}
	}
	return out;
}
function resolveConfig(sceneConfig = {}, userConfig = {}) {
	const scene = deepMerge({}, sceneConfig);
	if (isPlainObject(scene.defaults) && isPlainObject(scene.defaults.auto)) scene.auto = deepMerge({}, scene.auto, scene.defaults.auto);
	const merged = deepMerge({}, DEFAULTS, scene, userConfig);
	const number = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
	merged.drag.degPerPx = number(merged.drag.degPerPx, .42);
	merged.drag.touchScale = Math.min(10, Math.max(.1, number(merged.drag.touchScale, 2.5)));
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
	merged.mouseFollow.degPerPx = number(merged.mouseFollow.degPerPx, .3);
	return merged;
}
function assertFiniteNumber(value, label) {
	if (typeof value !== "number" || !Number.isFinite(value)) fail("ORB_INVALID_ARGUMENT", `${label} 必须是数字`);
	return value;
}
//#endregion
//#region ../core/src/engine.ts
const ENGINE_VERSION = "engine/v1";
const mod = (a, n) => (a % n + n) % n;
const shortDelta = (from, to) => mod(to - from + 180, 360) - 180;
const wrapSigned = (deg) => mod(deg + 180, 360) - 180;
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const roundHalfUp = (v) => Math.floor(v + .5);
var OrbitEngine = class {
	constructor(bundle, options = {}) {
		this._sceneConfig = {};
		this._userConfig = {};
		this._ready = false;
		this._paused = false;
		this._destroyed = false;
		this._angle = 0;
		this._target = 0;
		this._velocity = 0;
		this._dragging = false;
		this._limited = false;
		this._axis = "x";
		this._minAngle = -180;
		this._maxAngle = 180;
		this._frameCount = 0;
		this._degPerFrame = 360;
		this._layers = [];
		this._lastPointerX = 0;
		this._lastPointerY = 0;
		this._lastPointerTime = 0;
		this._now = 0;
		this._lastActivity = 0;
		this._autoState = "off";
		this._autoDir = 1;
		this._autoSpeed = 14;
		this._autoWeight = 0;
		this._gyroActive = false;
		this._gyroSeen = false;
		this._gyroRef = null;
		this._gyroBase = 0;
		this._lastGyroTime = 0;
		this._config = resolveConfig({}, options.config || {});
		this._userConfig = deepMerge({}, options.config || {});
		this.load(bundle);
	}
	load(bundle) {
		if (this._destroyed) return this;
		this._sceneConfig = deepMerge({}, bundle.sceneConfig || {});
		this._layers = bundle.videos.map((video, index) => ({
			layerIndex: index,
			frameIndex: 0,
			frameCount: video.frameCount,
			rect: _objectSpread2({}, video.rect)
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
	setConfig(partial = {}) {
		if (this._destroyed) return this;
		this._lastActivity = this._now;
		this._userConfig = deepMerge(this._userConfig, partial);
		this._config = resolveConfig(this._sceneConfig, this._userConfig);
		this._applyConfig();
		return this;
	}
	resetConfig() {
		if (this._destroyed) return this;
		this._userConfig = {};
		this._config = resolveConfig(this._sceneConfig, {});
		this._applyConfig();
		this._lastActivity = this._now;
		return this;
	}
	setAngle(deg, immediate = false) {
		if (this._destroyed) return this;
		const value = assertFiniteNumber(deg, "setAngle: deg");
		this._target = this._normAngle(value);
		this._velocity = 0;
		if (immediate) this._angle = this._target;
		this._lastActivity = this._now;
		return this;
	}
	rotateBy(deg) {
		if (this._destroyed) return this;
		const value = assertFiniteNumber(deg, "rotateBy: deg");
		this._target = this._normAngle(this._target + value);
		this._lastActivity = this._now;
		return this;
	}
	pointerDown(x, y, timeMs) {
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
	pointerMove(x, y, timeMs, scale = 1) {
		if (this._destroyed || !this._dragging) return this;
		const t = this._eventTime(timeMs);
		const dx = x - this._lastPointerX;
		const dy = y - this._lastPointerY;
		const dt = Math.max(t - this._lastPointerTime, 1);
		const deg = (this._axis === "y" ? dy : dx) * this._config.drag.degPerPx * scale * (this._config.drag.invert ? -1 : 1);
		this._target = this._normAngle(this._target + deg);
		const inst = dt > 90 ? 0 : deg / dt;
		this._velocity = .6 * inst + .4 * this._velocity;
		this._lastPointerX = x;
		this._lastPointerY = y;
		this._lastPointerTime = t;
		this._lastActivity = this._now;
		return this;
	}
	pointerUp(timeMs) {
		if (this._destroyed || !this._dragging) return this;
		this._eventTime(timeMs);
		this._dragging = false;
		if (timeMs - this._lastPointerTime > 90) this._velocity = 0;
		this._velocity = clampNum(this._velocity, -.55, .55);
		this._lastActivity = this._now;
		return this;
	}
	enableGyro() {
		if (!this._destroyed) this._gyroActive = true;
		return this;
	}
	gyro(sample) {
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
		const gain = this._config.gyro.gain * (this._config.gyro.invert ? -1 : 1) * (this._config.drag.invert ? -1 : 1);
		const delta = shortDelta(this._gyroRef, heading) * gain;
		const raw = this._normAngle(this._gyroBase - delta);
		if (this._config.gyro.smooth) {
			const dt = clampNum(this._now - this._lastGyroTime, 1, 120);
			this._lastGyroTime = this._now;
			this._target = this._normAngle(this._target + this._angleDelta(this._target, raw) * (1 - Math.exp(-dt / this._config.gyro.smoothMs)));
		} else this._target = raw;
		this._lastActivity = this._now;
		return this;
	}
	disableGyro() {
		if (this._destroyed) return this;
		this._gyroActive = false;
		this._gyroRef = null;
		this._gyroBase = 0;
		return this;
	}
	calibrateGyro() {
		if (this._destroyed) return this;
		this._gyroRef = null;
		this._gyroBase = this._target;
		return this;
	}
	pause() {
		if (!this._destroyed) this._paused = true;
		return this;
	}
	resume() {
		if (!this._destroyed) this._paused = false;
		return this;
	}
	reset(angle = 0, immediate = true) {
		if (this._destroyed) return this;
		this._target = this._normAngle(assertFiniteNumber(angle, "reset: angle"));
		this._velocity = 0;
		this._gyroRef = null;
		this._gyroBase = 0;
		if (immediate) this._angle = this._target;
		this._lastActivity = this._now;
		return this;
	}
	unload() {
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
	destroy() {
		this._destroyed = true;
		this._dragging = false;
		this._velocity = 0;
		return this;
	}
	advance(dtMs) {
		if (this._destroyed || this._paused) return this;
		const dt = Math.min(64, Math.max(0, typeof dtMs === "number" && Number.isFinite(dtMs) ? dtMs : 0));
		this._now += dt;
		if (!this._dragging) {
			if (this._config.drag.inertia && !this._gyroActive && Math.abs(this._velocity) > 5e-4) {
				const next = this._normAngle(this._target + this._velocity * dt);
				if (this._limited && next === this._target) this._velocity = 0;
				this._target = next;
				this._velocity *= Math.exp(-dt / this._config.drag.inertiaMs);
				this._lastActivity = this._now;
			} else this._velocity = 0;
		}
		const idle = this._now - this._lastActivity;
		const want = this._autoState !== "off" && !this._gyroActive && !this._dragging && idle > this._config.auto.idleDelayMs ? 1 : 0;
		const tau = want ? this._config.auto.rampInMs : this._dragging ? 120 : this._config.auto.rampOutMs;
		this._autoWeight += (want - this._autoWeight) * (1 - Math.exp(-dt / tau));
		if (want === 0 && this._autoWeight < .004) this._autoWeight = 0;
		if (this._autoWeight > 0) this._target = this._normAngle(this._target + this._autoDir * this._autoSpeed * this._autoWeight * dt / 1e3);
		const delta = this._angleDelta(this._angle, this._target);
		const next = this._angle + delta * (1 - Math.exp(-dt / this._config.motion.smoothMs));
		this._angle = this._limited ? clampNum(next, this._minAngle, this._maxAngle) : mod(next, 360);
		if (Math.abs(this._angleDelta(this._angle, this._target)) < 5e-4) this._angle = this._target;
		return this;
	}
	getAngle() {
		return this._normAngle(this._angle);
	}
	getTargetAngle() {
		return this._normAngle(this._target);
	}
	getFrameIndex() {
		return this._frameIndex();
	}
	getFrameCount() {
		return this._frameCount;
	}
	getConfig() {
		return clone(this._config);
	}
	getSnapshot() {
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
				rampOutMs: this._config.auto.rampOutMs
			},
			gyro: {
				enabled: this._gyroActive,
				seen: this._gyroSeen,
				gain: this._config.gyro.gain,
				invert: this._config.gyro.invert,
				smooth: this._config.gyro.smooth,
				smoothMs: this._config.gyro.smoothMs
			},
			layers: this._layers.map((layer) => ({
				layerIndex: layer.layerIndex,
				frameIndex: layer.frameCount === this._frameCount ? frameIndex : mod(Math.floor(frameIndex * layer.frameCount / Math.max(1, this._frameCount)), layer.frameCount),
				frameCount: layer.frameCount,
				rect: _objectSpread2({}, layer.rect)
			}))
		};
	}
	_eventTime(timeMs) {
		const t = assertFiniteNumber(timeMs, "timeMs");
		if (t > this._now) this._now = t;
		return t;
	}
	_frameSpan() {
		return Math.min(360, this._config.orbit.spanDeg);
	}
	_recalcFrames() {
		this._degPerFrame = this._frameSpan() / Math.max(1, this._frameCount);
	}
	_applyConfig() {
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
	_normAngle(value) {
		if (!Number.isFinite(value)) return this._limited ? this._minAngle : 0;
		if (this._limited) return clampNum(value, this._minAngle, this._maxAngle);
		return wrapSigned(value);
	}
	_angleDelta(from, to) {
		return this._limited ? to - from : shortDelta(from, to);
	}
	_frameIndex() {
		if (!this._frameCount) return 0;
		const dirSign = this._config.orbit.direction === "ccw" ? -1 : 1;
		const angle = wrapSigned(this._angle * dirSign);
		const span = this._frameSpan();
		if (span >= 360) return mod(roundHalfUp(mod(angle, 360) / this._degPerFrame), this._frameCount);
		const t = (angle + span / 2) / span;
		return Math.min(this._frameCount - 1, Math.max(0, roundHalfUp(t * (this._frameCount - 1))));
	}
};
function createEngine(bundle, options = {}) {
	return new OrbitEngine(bundle, options);
}
//#endregion
//#region ../core/src/layout.ts
function computeLayout(input) {
	const { canvas, viewport } = input;
	const cover = input.fit === "cover";
	const displayScale = typeof input.displayScale === "number" ? input.displayScale : 1;
	const portraitScale = typeof input.portraitScale === "number" ? input.portraitScale : 1.25;
	const fitScale = Math.min(viewport.width / canvas.width, viewport.height / canvas.height);
	const coverScale = Math.max(viewport.width / canvas.width, viewport.height / canvas.height);
	const scale = (cover ? coverScale : fitScale * (viewport.height > viewport.width ? portraitScale : 1)) * (cover ? 1 : displayScale);
	const width = canvas.width * scale;
	const height = canvas.height * scale;
	const destinationRect = {
		x: (viewport.width - width) / 2,
		y: (viewport.height - height) / 2,
		width,
		height
	};
	return {
		scale,
		destinationRect,
		layers: (input.layers || []).map((layer) => ({
			layerIndex: layer.layerIndex,
			rect: {
				x: destinationRect.x + layer.rect.x * scale,
				y: destinationRect.y + layer.rect.y * scale,
				width: layer.rect.width * scale,
				height: layer.rect.height * scale
			}
		}))
	};
}
//#endregion
//#region ../miniprogram/src/client.ts
const VERSION$1 = "0.1.0";
const RAD = Math.PI / 180;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64ToBuffer(base64) {
	const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
	let padding = 0;
	if (clean.endsWith("==")) padding = 2;
	else if (clean.endsWith("=")) padding = 1;
	const bytes = new Uint8Array(clean.length / 4 * 3 - padding);
	let position = 0;
	for (let i = 0; i < clean.length; i += 4) {
		const n = B64.indexOf(clean[i]) << 18 | B64.indexOf(clean[i + 1]) << 12 | (B64.indexOf(clean[i + 2]) & 63) << 6 | B64.indexOf(clean[i + 3]) & 63;
		bytes[position++] = n >> 16 & 255;
		if (position < bytes.length) bytes[position++] = n >> 8 & 255;
		if (position < bytes.length) bytes[position++] = n & 255;
	}
	return bytes.buffer;
}
function extForCodec(codec) {
	if (/jpe?g/i.test(codec)) return "jpg";
	if (/avif/i.test(codec)) return "avif";
	if (/png/i.test(codec)) return "png";
	return "webp";
}
function miniWindowSize(api) {
	try {
		const info = typeof api.getWindowInfo === "function" ? api.getWindowInfo() : api.getSystemInfoSync();
		return {
			width: Number(info.windowWidth) || 0,
			height: Number(info.windowHeight) || 0
		};
	} catch (_unused) {
		return {
			width: 0,
			height: 0
		};
	}
}
function miniDpr(api) {
	try {
		const info = typeof api.getWindowInfo === "function" ? api.getWindowInfo() : api.getSystemInfoSync();
		return Number(info.pixelRatio) || 1;
	} catch (_unused2) {
		return 1;
	}
}
function screenOrientation(api) {
	const size = miniWindowSize(api);
	return size.width > size.height ? 90 : 0;
}
function headingOf(event, orientation) {
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
	if (Math.hypot(vx, vy) < .25) return orientation === 90 || orientation === 270 ? alpha % 360 : (360 - alpha) % 360;
	return (Math.atan2(-vx, -vy) / RAD % 360 + 360) % 360;
}
function pitchOf(event) {
	return typeof event.beta === "number" && !Number.isNaN(event.beta) ? event.beta % 360 : null;
}
function normalizeSource(source) {
	if (source && typeof source === "object" && !(source instanceof ArrayBuffer) && !ArrayBuffer.isView(source)) {
		if (typeof source.path === "string") return source.path;
		throw new Error("load: 对象参数需要 path");
	}
	return source;
}
var MiniOrbitClient = class {
	constructor(canvas, options, platform) {
		this._layers = [];
		this._events = /* @__PURE__ */ new Map();
		this._meta = null;
		this._format = null;
		this._quality = null;
		this._codec = null;
		this._canvasW = 0;
		this._canvasH = 0;
		this._frameW = 0;
		this._frameH = 0;
		this._viewW = 0;
		this._viewH = 0;
		this._systemDpr = 1;
		this._dpr = 1;
		this._orientation = 0;
		this._drawnIndex = -1;
		this._lastT = 0;
		this._lastEmittedAngle = NaN;
		this._raf = 0;
		this._loading = false;
		this._ready = false;
		this._destroyed = false;
		this._paused = false;
		this._loadToken = 0;
		this._progress = 0;
		this._loaded = 0;
		this._total = 0;
		this._phase = "idle";
		this._pressTimer = null;
		this._pressStart = null;
		this._suppressMove = false;
		this._gyroPending = false;
		this._gyroSeen = false;
		this._gyroTimer = null;
		this._tempDirPromise = null;
		this._motionHandler = (event) => this._handleMotion(event);
		if (!canvas || typeof canvas.getContext !== "function") throw new Error("Orbit360Client: 需要小程序 Canvas 2D 节点");
		this._platform = platform;
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Orbit360Client: 无法获取 2D context");
		this.ctx = ctx;
		this.options = _objectSpread2({
			dprCap: 2,
			concurrency: 6,
			autoStartGyro: false,
			deviceMotionInterval: "game"
		}, options);
		this._systemDpr = options.dpr && options.dpr > 0 ? options.dpr : miniDpr(platform.api);
		const fallback = miniWindowSize(platform.api);
		this._viewW = options.width || fallback.width || 1;
		this._viewH = options.height || fallback.height || 1;
		this._orientation = screenOrientation(platform.api);
		this.engine = createEngine({
			canvas: {
				width: 0,
				height: 0
			},
			videos: []
		}, { config: options.config || {} });
		this.engine.unload();
		this.resize();
		this._raf = canvas.requestAnimationFrame(() => this._loop());
		if (this.options.autoStartGyro) this._initAutoGyro();
	}
	on(type, handler) {
		if (typeof handler !== "function") throw new Error("Orbit360Client: handler 必须是函数");
		let list = this._events.get(type);
		if (!list) {
			list = [];
			this._events.set(type, list);
		}
		list.push(handler);
		return () => this.off(type, handler);
	}
	once(type, handler) {
		const off = this.on(type, (payload) => {
			off();
			handler(payload);
		});
		return off;
	}
	off(type, handler) {
		const list = this._events.get(type);
		if (!list) return this;
		const index = list.indexOf(handler);
		if (index >= 0) list.splice(index, 1);
		if (!list.length) this._events.delete(type);
		return this;
	}
	_emit(type, payload) {
		const list = this._events.get(type);
		if (!list || !list.length) return;
		for (const handler of list.slice()) try {
			handler(payload);
		} catch (error) {
			console.error(error);
		}
	}
	_emitState() {
		this._emit("state", this.getState());
	}
	_emitAngle() {
		const snapshot = this.engine.getSnapshot();
		this._emit("angle", {
			angle: snapshot.angle,
			target: snapshot.targetAngle,
			axis: snapshot.axis,
			frameIndex: snapshot.frameIndex
		});
	}
	_emitFrame(index) {
		const snapshot = this.engine.getSnapshot();
		this._emit("frame", {
			index,
			count: snapshot.frameCount,
			frameDeg: snapshot.frameDeg
		});
	}
	getConfig() {
		return this.engine.getConfig();
	}
	getMeta() {
		return this._meta ? clone(this._meta) : null;
	}
	getState() {
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
			limits: {
				min: snapshot.minAngle,
				max: snapshot.maxAngle,
				limited: snapshot.limited
			},
			velocity: snapshot.velocity,
			frameIndex: snapshot.frameIndex,
			frameCount: snapshot.frameCount,
			frameDeg: snapshot.frameDeg,
			degPerFrame: snapshot.frameDeg,
			dragging: snapshot.dragging,
			missingFrames: this._countMissingFrames(),
			auto: snapshot.auto,
			gyro: _objectSpread2(_objectSpread2({}, snapshot.gyro), {}, {
				pending: this._gyroPending,
				absolute: false,
				supported: this.isGyroSupported()
			}),
			inertia: config.drag.inertia,
			invert: config.drag.invert,
			fit: config.video.fit,
			mouseFollow: {
				enabled: config.mouseFollow.enabled,
				degPerPx: config.mouseFollow.degPerPx
			},
			progress: {
				progress: this._progress,
				loaded: this._loaded,
				total: this._total,
				phase: this._phase
			},
			viewport: {
				width: this._viewW,
				height: this._viewH,
				dpr: this._dpr
			},
			canvas: {
				width: this._canvasW,
				height: this._canvasH,
				frameWidth: this._frameW,
				frameHeight: this._frameH
			},
			config: this.getConfig(),
			meta: this.getMeta()
		};
	}
	getAngle() {
		return this.engine.getAngle();
	}
	getTargetAngle() {
		return this.engine.getTargetAngle();
	}
	getFrameIndex() {
		return this.engine.getFrameIndex();
	}
	getFrameCount() {
		return this.engine.getFrameCount();
	}
	setConfig(partial) {
		this.engine.setConfig(partial);
		if (partial.video || partial.orbit) this._layout();
		this._emitState();
		return this;
	}
	resetConfig() {
		this.engine.resetConfig();
		this._layout();
		this._emitState();
		return this;
	}
	setAngle(deg, options = {}) {
		this.engine.setAngle(deg, options.immediate === true);
		if (options.immediate) this._paint(true);
		this._emitAngle();
		this._emitState();
		return this;
	}
	rotateBy(deg) {
		this.engine.rotateBy(deg);
		this._emitState();
		return this;
	}
	reset(angle = 0, options = {}) {
		this.engine.reset(angle, options.immediate !== false);
		this._paint(true);
		this._emitAngle();
		this._emitState();
		return this;
	}
	setAutoRotate(value, direction) {
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
		const auto = { enabled };
		if (dir) {
			if (dir !== "cw" && dir !== "ccw") throw new Error("setAutoRotate: dir 必须是 cw / ccw");
			auto.dir = dir;
		}
		this.setConfig({ auto });
		return this.engine.getSnapshot().auto.state;
	}
	setAuto(value) {
		return this.setAutoRotate(value);
	}
	stopAuto() {
		this.setAutoRotate(false);
		return this;
	}
	cycleAuto() {
		const state = this.engine.getSnapshot().auto.state;
		const next = state === "off" ? "cw" : state === "cw" ? "ccw" : "off";
		this.setAutoRotate(next);
		return next;
	}
	setAutoSpeed(degPerSec) {
		return this.setAutoConfig({ degPerSec });
	}
	setAutoConfig(partial) {
		return this.setConfig({ auto: partial });
	}
	setGyroConfig(partial) {
		return this.setConfig({ gyro: partial });
	}
	setDragConfig(partial) {
		return this.setConfig({ drag: partial });
	}
	setMotionConfig(partial) {
		return this.setConfig({ motion: partial });
	}
	setOrbitConfig(partial) {
		return this.setConfig({ orbit: partial });
	}
	setVideoConfig(partial) {
		return this.setConfig({ video: partial });
	}
	setInertia(enabled) {
		return this.setDragConfig({ inertia: !!enabled });
	}
	setInvert(enabled) {
		return this.setDragConfig({ invert: !!enabled });
	}
	setFit(mode) {
		if (mode !== "contain" && mode !== "cover") throw new Error("setFit: 期望 contain / cover");
		return this.setVideoConfig({ fit: mode });
	}
	setMouseFollow(value) {
		if (typeof value === "boolean") return this.setConfig({ mouseFollow: { enabled: value } });
		return this.setConfig({ mouseFollow: value });
	}
	async load(source, options = {}) {
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
			let buffer;
			if (typeof normalized === "string") {
				this._setProgress(.03, "fetch", 0, 0);
				buffer = await this._readSource(normalized);
				this._setProgress(.38, "fetch", 0, 0);
			} else if (normalized instanceof ArrayBuffer) {
				buffer = normalized;
				this._setProgress(.38, "read", 0, 0);
			} else if (ArrayBuffer.isView(normalized)) {
				const copy = new Uint8Array(normalized.byteLength);
				copy.set(new Uint8Array(normalized.buffer, normalized.byteOffset, normalized.byteLength));
				buffer = copy.buffer;
				this._setProgress(.38, "read", 0, 0);
			} else throw new Error("load: 需要 URL / 本地路径 / ArrayBuffer / Uint8Array");
			if (token !== this._loadToken || this._destroyed) return this;
			const bundle = parse(buffer);
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
				state: this.getState()
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
	loadUrl(url, options = {}) {
		return this.load(url, options);
	}
	loadFile(filePath, options = {}) {
		return this.load(filePath, options);
	}
	loadBuffer(buffer, options = {}) {
		return this.load(buffer, options);
	}
	unload() {
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
	async _loadBundle(bundle, token, options) {
		const meta = bundle.meta;
		const layers = [];
		const jobs = [];
		meta.videos.forEach((video, videoIndex) => {
			const frames = Array.from({ length: video.frames.count });
			layers.push({
				rect: video.rect,
				frames,
				count: video.frames.count
			});
			for (let frameIndex = 0; frameIndex < video.frames.count; frameIndex++) jobs.push({
				run: async () => {
					try {
						return await this._loadFrameImage(bundle, videoIndex, frameIndex);
					} catch (_unused3) {
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
						sh: Number(image.height) || video.frames.height || video.rect.height
					};
				}
			});
		});
		this._total = jobs.length;
		this._loaded = 0;
		await this._decodeJobs(jobs, token, .4, .98);
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
			videos: bundle.layers.map((layer) => ({
				rect: layer.rect,
				frameCount: layer.frameCount
			})),
			sceneConfig: bundle.sceneConfig
		});
	}
	_loadImage(src) {
		return new Promise((resolve) => {
			const image = this.canvas.createImage();
			let done = false;
			const finish = (value) => {
				if (done) return;
				done = true;
				resolve(value);
			};
			image.onload = () => setTimeout(() => finish(image), 0);
			image.onerror = () => finish(null);
			image.src = src;
		});
	}
	async _loadFrameImage(bundle, videoIndex, frameIndex) {
		var _this$_platform$api$g, _this$_platform$api, _this$_platform$api$e;
		const fs = (_this$_platform$api$g = (_this$_platform$api = this._platform.api).getFileSystemManager) === null || _this$_platform$api$g === void 0 ? void 0 : _this$_platform$api$g.call(_this$_platform$api);
		const userDataPath = (_this$_platform$api$e = this._platform.api.env) === null || _this$_platform$api$e === void 0 ? void 0 : _this$_platform$api$e.USER_DATA_PATH;
		if (this.options.frameSource !== "data-url" && fs && userDataPath) try {
			if (!this._tempDirPromise) this._tempDirPromise = new Promise((resolve) => {
				const dir = `${userDataPath}/orbit360-frames`;
				fs.mkdir({
					dirPath: dir,
					recursive: true,
					success: () => resolve(dir),
					fail: () => resolve(dir)
				});
			});
			const dir = await this._tempDirPromise;
			const ext = extForCodec(String(bundle.meta.codec || ""));
			const filePath = `${dir}/${this._loadToken}-${videoIndex}-${frameIndex}.${ext}`;
			const bytes = bundle.frameBytes(videoIndex, frameIndex);
			await new Promise((resolve, reject) => {
				fs.writeFile({
					filePath,
					data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
					success: () => resolve(),
					fail: reject
				});
			});
			const image = await this._loadImage(filePath);
			if (image) return image;
		} catch (_unused4) {}
		return await this._loadImage(bundle.frameDataUrl(videoIndex, frameIndex));
	}
	async _decodeJobs(jobs, token, from, to) {
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
				this._setProgress(from + done / total * (to - from), "decode", done, total);
			}
		};
		await Promise.all(Array.from({ length: concurrency }, worker));
	}
	async _readSource(source) {
		if (source.startsWith("data:")) {
			const comma = source.indexOf(",");
			if (comma < 0) throw new Error("data URL 格式不正确");
			return base64ToBuffer(source.slice(comma + 1));
		}
		if (/^https?:\/\//i.test(source) && !this._platform.localPathPrefixes.some((prefix) => source.startsWith(prefix))) return new Promise((resolve, reject) => {
			this._platform.api.request({
				url: source,
				method: "GET",
				responseType: "arraybuffer",
				dataType: "其他",
				timeout: 6e4,
				success: (result) => {
					if (result.statusCode >= 200 && result.statusCode < 300 && result.data instanceof ArrayBuffer) resolve(result.data);
					else reject(/* @__PURE__ */ new Error(`包下载失败（HTTP ${result.statusCode}）`));
				},
				fail: (error) => reject(new Error(error.errMsg || "网络请求失败"))
			});
		});
		return new Promise((resolve, reject) => {
			const fs = this._platform.api.getFileSystemManager();
			const candidates = [source];
			if (source.startsWith("/")) candidates.push(source.slice(1));
			else candidates.push(`/${source}`);
			let index = 0;
			let lastError = null;
			const tryNext = () => {
				if (index >= candidates.length) {
					reject(new Error((lastError === null || lastError === void 0 ? void 0 : lastError.errMsg) || `读取文件失败：${source}`));
					return;
				}
				fs.readFile({
					filePath: candidates[index++],
					success: (result) => resolve(result.data),
					fail: (error) => {
						lastError = error;
						tryNext();
					}
				});
			};
			tryNext();
		});
	}
	_setProgress(progress, phase, loaded, total) {
		this._progress = Math.max(0, Math.min(1, Number(progress) || 0));
		this._phase = phase;
		this._loaded = loaded;
		this._total = total;
		this._emit("progress", {
			progress: this._progress,
			phase,
			loaded,
			total
		});
	}
	_countMissingFrames() {
		let missing = 0;
		for (const layer of this._layers) for (const frame of layer.frames) if (!frame) missing++;
		return missing;
	}
	resize(width, height) {
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
	setViewport(width, height) {
		return this.resize(width, height);
	}
	_fillBackdrop() {
		const width = this._viewW;
		const height = this._viewH;
		const gradient = this.ctx.createRadialGradient(width * .5, height * .42, 0, width * .5, height * .42, Math.max(width, height) * .78);
		gradient.addColorStop(0, "#1b1f27");
		gradient.addColorStop(.62, "#0a0b0e");
		gradient.addColorStop(1, "#050608");
		this.ctx.fillStyle = gradient;
		this.ctx.fillRect(0, 0, width, height);
	}
	_layout() {
		if (!this._viewW || !this._viewH) return;
		const config = this.engine.getConfig();
		this._canvasW || this._frameW || config.video.width;
		this._canvasH || this._frameH || config.video.height;
		this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
		this._fillBackdrop();
		this._drawnIndex = -1;
		if (this._layers.length) this._paint(true);
	}
	_paint(force = false) {
		if (!this._layers.length) return;
		const snapshot = this.engine.getSnapshot();
		if (!force && snapshot.frameIndex === this._drawnIndex) return;
		this._drawnIndex = snapshot.frameIndex;
		const config = this.engine.getConfig();
		const plan = computeLayout({
			canvas: {
				width: this._canvasW || this._frameW || config.video.width || 1280,
				height: this._canvasH || this._frameH || config.video.height || 720
			},
			viewport: {
				width: this._viewW,
				height: this._viewH
			},
			fit: config.video.fit,
			displayScale: config.video.displayScale,
			portraitScale: config.video.portraitScale,
			layers: this._layers.map((layer, layerIndex) => ({
				layerIndex,
				rect: layer.rect
			}))
		});
		this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
		for (let layerIndex = 0; layerIndex < this._layers.length; layerIndex++) {
			var _plan$layers$layerInd;
			const layer = this._layers[layerIndex];
			const layerSnapshot = snapshot.layers[layerIndex];
			const destination = (_plan$layers$layerInd = plan.layers[layerIndex]) === null || _plan$layers$layerInd === void 0 ? void 0 : _plan$layers$layerInd.rect;
			if (!layerSnapshot || !destination) continue;
			const frame = layer.frames[layerSnapshot.frameIndex];
			if (!frame) continue;
			this.ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, destination.x, destination.y, destination.width, destination.height);
		}
		this._emitFrame(snapshot.frameIndex);
	}
	_loop() {
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
	_touchPoint(event) {
		const touch = ((event === null || event === void 0 ? void 0 : event.touches) || (event === null || event === void 0 ? void 0 : event.changedTouches) || [])[0];
		if (!touch) return null;
		const x = typeof touch.x === "number" ? touch.x : touch.clientX;
		const y = typeof touch.y === "number" ? touch.y : touch.clientY;
		if (typeof x !== "number" || typeof y !== "number") return null;
		return {
			x,
			y,
			t: event.timeStamp || this._platform.now()
		};
	}
	touchStart(event) {
		var _this$_pressTimer;
		const point = this._touchPoint(event);
		if (!point) return this;
		if (this._gyroPending) {
			this._gyroPending = false;
			this.enableGyro();
		}
		this.engine.pointerDown(point.x, point.y, point.t);
		this._emit("dragstart", { pointerType: "touch" });
		clearTimeout((_this$_pressTimer = this._pressTimer) !== null && _this$_pressTimer !== void 0 ? _this$_pressTimer : void 0);
		this._pressTimer = null;
		this._pressStart = {
			x: point.x,
			y: point.y
		};
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
	touchMove(event) {
		const point = this._touchPoint(event);
		if (!point) return this;
		if (this._pressStart) {
			if (Math.hypot(point.x - this._pressStart.x, point.y - this._pressStart.y) > 8) {
				var _this$_pressTimer2;
				clearTimeout((_this$_pressTimer2 = this._pressTimer) !== null && _this$_pressTimer2 !== void 0 ? _this$_pressTimer2 : void 0);
				this._pressTimer = null;
				this._pressStart = null;
			}
		}
		if (this._suppressMove) return this;
		this.engine.pointerMove(point.x, point.y, point.t);
		this._emitState();
		return this;
	}
	touchEnd(event) {
		var _this$_pressTimer3;
		clearTimeout((_this$_pressTimer3 = this._pressTimer) !== null && _this$_pressTimer3 !== void 0 ? _this$_pressTimer3 : void 0);
		this._pressTimer = null;
		this._pressStart = null;
		if (this._suppressMove) {
			this._suppressMove = false;
			this._emitState();
			return this;
		}
		if (!this.engine.getSnapshot().dragging) return this;
		this.engine.pointerUp((event === null || event === void 0 ? void 0 : event.timeStamp) || this._platform.now());
		this._emit("dragend", { velocity: this.engine.getSnapshot().velocity });
		this._emitState();
		return this;
	}
	touchCancel(event) {
		return this.touchEnd(event);
	}
	isGyroSupported() {
		const api = this._platform.api;
		return typeof api.startDeviceMotionListening === "function" && typeof api.onDeviceMotionChange === "function";
	}
	_initAutoGyro() {
		if (this._destroyed || !this.isGyroSupported()) return;
		this._gyroPending = true;
		this._emit("gyrochange", {
			enabled: false,
			pending: true,
			reason: "permission",
			state: this.getState()
		});
		this._emitState();
	}
	enableGyro() {
		if (this.engine.getSnapshot().gyro.enabled) return Promise.resolve(true);
		return new Promise((resolve) => {
			if (!this.isGyroSupported()) {
				this._gyroPending = false;
				this._emit("gyrochange", {
					enabled: false,
					pending: false,
					reason: "unsupported",
					state: this.getState()
				});
				this._emitState();
				resolve(false);
				return;
			}
			this._platform.api.startDeviceMotionListening({
				interval: this.options.deviceMotionInterval || "game",
				success: () => {
					var _this$_gyroTimer;
					this._orientation = screenOrientation(this._platform.api);
					this._platform.api.onDeviceMotionChange(this._motionHandler);
					this.engine.enableGyro();
					this._gyroPending = false;
					this._gyroSeen = false;
					this._emit("gyrochange", {
						enabled: true,
						pending: false,
						reason: "enabled",
						state: this.getState()
					});
					this._emitState();
					clearTimeout((_this$_gyroTimer = this._gyroTimer) !== null && _this$_gyroTimer !== void 0 ? _this$_gyroTimer : void 0);
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
						state: this.getState()
					});
					this._emitState();
					resolve(false);
				}
			});
		});
	}
	disableGyro() {
		this._stopGyro("disabled");
		return this;
	}
	_stopGyro(reason) {
		var _this$_gyroTimer2;
		clearTimeout((_this$_gyroTimer2 = this._gyroTimer) !== null && _this$_gyroTimer2 !== void 0 ? _this$_gyroTimer2 : void 0);
		this._gyroTimer = null;
		const wasEnabled = this.engine.getSnapshot().gyro.enabled;
		if (wasEnabled) try {
			this._platform.api.offDeviceMotionChange(this._motionHandler);
			this._platform.api.stopDeviceMotionListening();
		} catch (_unused5) {}
		this.engine.disableGyro();
		this._gyroPending = false;
		if (wasEnabled || reason === "no-readings") {
			this._emit("gyrochange", {
				enabled: false,
				pending: false,
				reason,
				state: this.getState()
			});
			this._emitState();
		}
	}
	calibrateGyro() {
		this.engine.calibrateGyro();
		return this;
	}
	_handleMotion(event) {
		var _this$_gyroTimer3;
		const heading = this.engine.getSnapshot().axis === "y" ? pitchOf(event) : headingOf(event, this._orientation);
		if (heading === null) return;
		this._gyroSeen = true;
		clearTimeout((_this$_gyroTimer3 = this._gyroTimer) !== null && _this$_gyroTimer3 !== void 0 ? _this$_gyroTimer3 : void 0);
		this._gyroTimer = null;
		this.engine.gyro({
			heading,
			timeMs: this._platform.now()
		});
		this._emitState();
	}
	pause() {
		if (this._paused) return this;
		this._paused = true;
		this.engine.pause();
		this.canvas.cancelAnimationFrame(this._raf);
		this._raf = 0;
		this._emitState();
		return this;
	}
	resume() {
		if (!this._paused || this._destroyed) return this;
		this._paused = false;
		this._lastT = 0;
		this.engine.resume();
		this._raf = this.canvas.requestAnimationFrame(() => this._loop());
		this._emitState();
		return this;
	}
	destroy() {
		var _this$_pressTimer4, _this$_platform$api$e2;
		if (this._destroyed) return;
		this._destroyed = true;
		this._loadToken++;
		this.canvas.cancelAnimationFrame(this._raf);
		this._raf = 0;
		this._stopGyro("destroyed");
		clearTimeout((_this$_pressTimer4 = this._pressTimer) !== null && _this$_pressTimer4 !== void 0 ? _this$_pressTimer4 : void 0);
		this._pressTimer = null;
		const userDataPath = (_this$_platform$api$e2 = this._platform.api.env) === null || _this$_platform$api$e2 === void 0 ? void 0 : _this$_platform$api$e2.USER_DATA_PATH;
		if (userDataPath) try {
			var _this$_platform$api$g2, _this$_platform$api$g3;
			(_this$_platform$api$g2 = (_this$_platform$api$g3 = this._platform.api.getFileSystemManager()).rmdir) === null || _this$_platform$api$g2 === void 0 || _this$_platform$api$g2.call(_this$_platform$api$g3, {
				dirPath: `${userDataPath}/orbit360-frames`,
				recursive: true
			});
		} catch (_unused6) {}
		this.engine.destroy();
		this._layers = [];
		this._meta = null;
		this._ready = false;
		this._loading = false;
		this._emit("destroy", {});
		this._events.clear();
	}
};
function queryCanvas$1(platform, options = {}) {
	return new Promise((resolve, reject) => {
		const selector = options.selector || "#orbit-canvas";
		const query = platform.api.createSelectorQuery();
		if (options.component && typeof query.in === "function") try {
			query.in(options.component);
		} catch (_unused7) {}
		query.select(selector).fields({
			node: true,
			size: true
		}).exec((result) => {
			const info = result === null || result === void 0 ? void 0 : result[0];
			if (!(info === null || info === void 0 ? void 0 : info.node)) {
				reject(/* @__PURE__ */ new Error(`找不到 Canvas 节点：${selector}`));
				return;
			}
			resolve({
				node: info.node,
				width: info.width,
				height: info.height
			});
		});
	});
}
//#endregion
//#region src/client.ts
const platform = {
	name: "douyin",
	api: globalThis.tt,
	localPathPrefixes: [
		"ttfile://",
		"wxfile://",
		"http://tmp/",
		"http://usr/",
		"http://store/",
		"http://disk/"
	],
	now: () => Date.now()
};
var Orbit360Client = class extends MiniOrbitClient {
	constructor(canvas, options = {}) {
		super(canvas, options, platform);
	}
};
function queryCanvas(options = {}) {
	return queryCanvas$1(platform, options);
}
async function createClient(options = {}) {
	if (options.canvas) return new Orbit360Client(options.canvas, _objectSpread2(_objectSpread2({}, options), {}, {
		width: options.width || options.canvas._width,
		height: options.height || options.canvas._height
	}));
	const info = await queryCanvas(options);
	return new Orbit360Client(info.node, _objectSpread2(_objectSpread2({}, options), {}, {
		width: info.width || options.width,
		height: info.height || options.height
	}));
}
//#endregion
exports.DEFAULTS = DEFAULTS;
exports.ENGINE_VERSION = ENGINE_VERSION;
exports.ENTRY_SIZE = ENTRY_SIZE;
exports.FORMAT = FORMAT;
exports.HEADER_SIZE = HEADER_SIZE;
exports.MAGIC = MAGIC;
exports.META_VERSION = META_VERSION;
exports.MiniOrbitClient = MiniOrbitClient;
exports.ORB_VERSION = VERSION;
exports.OrbBundle = OrbBundle;
exports.OrbError = OrbError;
exports.Orbit360Client = Orbit360Client;
exports.OrbitEngine = OrbitEngine;
exports.VERSION = VERSION$1;
exports.VERSION_MAJOR = VERSION_MAJOR;
exports.VERSION_MINOR = VERSION_MINOR;
exports.computeLayout = computeLayout;
exports.createClient = createClient;
exports.createEngine = createEngine;
exports.default = Orbit360Client;
exports.fail = fail;
exports.parse = parse;
exports.parseOrb = parse;
exports.queryCanvas = queryCanvas;
