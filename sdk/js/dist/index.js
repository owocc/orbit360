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
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/asyncToGenerator.js
function asyncGeneratorStep(n, t, e, r, o, a, c) {
	try {
		var i = n[a](c), u = i.value;
	} catch (n) {
		e(n);
		return;
	}
	i.done ? t(u) : Promise.resolve(u).then(r, o);
}
function _asyncToGenerator(n) {
	return function() {
		var t = this, e = arguments;
		return new Promise(function(r, o) {
			var a = n.apply(t, e);
			function _next(n) {
				asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
			}
			function _throw(n) {
				asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
			}
			_next(void 0);
		});
	};
}
//#endregion
//#region src/orb.ts
const VERSION_MAJOR = 1;
const VERSION_MINOR = 2;
function blobBuffer(blob) {
	if (blob.arrayBuffer) return blob.arrayBuffer();
	const { promise, resolve, reject } = Promise.withResolvers();
	const reader = new FileReader();
	reader.onload = () => resolve(reader.result);
	reader.onerror = () => reject(reader.error || /* @__PURE__ */ new Error("读取失败"));
	reader.readAsArrayBuffer(blob);
	return promise;
}
function attach(core, blob) {
	return _objectSpread2(_objectSpread2({}, core), {}, {
		blob,
		frameEntry: (videoIndex, frameIndex) => core.frameEntry(videoIndex, frameIndex),
		frameBytes: (videoIndex, frameIndex) => core.frameBytes(videoIndex, frameIndex),
		frameBlob(videoIndex, frameIndex) {
			const entry = core.frameEntry(videoIndex, frameIndex);
			if (!blob) {
				const bytes = core.frameBytes(videoIndex, frameIndex);
				const copy = new Uint8Array(bytes.length);
				copy.set(bytes);
				return new Blob([copy.buffer]);
			}
			return blob.slice(entry.offset, entry.offset + entry.length);
		}
	});
}
function parse(buffer) {
	return attach(parse$1(buffer), null);
}
function fromBlob(_x) {
	return _fromBlob.apply(this, arguments);
}
function _fromBlob() {
	_fromBlob = _asyncToGenerator(function* (blob) {
		return attach(parse$1(yield blobBuffer(blob)), blob);
	});
	return _fromBlob.apply(this, arguments);
}
const OrbBundle = {
	parse,
	fromBlob,
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
const CONFIG_KEYS = [
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
	pointerMove(x, y, timeMs) {
		if (this._destroyed || !this._dragging) return this;
		const t = this._eventTime(timeMs);
		const dx = x - this._lastPointerX;
		const dy = y - this._lastPointerY;
		const dt = Math.max(t - this._lastPointerTime, 1);
		const deg = (this._axis === "y" ? dy : dx) * this._config.drag.degPerPx * (this._config.drag.invert ? -1 : 1);
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
exports.CONFIG_KEYS = CONFIG_KEYS;
exports.DEFAULTS = DEFAULTS;
exports.ENGINE_VERSION = ENGINE_VERSION;
exports.ENTRY_SIZE = ENTRY_SIZE;
exports.FORMAT = FORMAT;
exports.HEADER_SIZE = HEADER_SIZE;
exports.MAGIC = MAGIC;
exports.META_VERSION = META_VERSION;
exports.OrbError = OrbError;
exports.OrbitEngine = OrbitEngine;
exports.VERSION = VERSION;
exports.VERSION_MAJOR = VERSION_MAJOR;
exports.VERSION_MINOR = VERSION_MINOR;
exports.assertFiniteNumber = assertFiniteNumber;
exports.clone = clone;
exports.computeLayout = computeLayout;
exports.createEngine = createEngine;
exports.deepMerge = deepMerge;
exports.default = OrbBundle;
exports.fail = fail;
exports.fromBlob = fromBlob;
exports.parse = parse;
exports.resolveConfig = resolveConfig;
