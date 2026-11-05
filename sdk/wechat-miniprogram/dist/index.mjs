//#region src/orb.ts
const MAGIC = [
	79,
	82,
	66,
	51
];
const HEADER_SIZE = 32;
const ENTRY_SIZE = 16;
const FORMAT = "orbit360.bundle";
const VERSION_MAJOR = 1;
const VERSION_MINOR = 2;
const VERSION = 65538;
function fail(msg) {
	throw new Error("ORB3: " + msg);
}
function versionText(raw) {
	return raw === 1 ? "1.0" : `${raw >>> 16}.${raw & 65535}`;
}
function isInt(n) {
	return typeof n === "number" && Number.isFinite(n) && Math.floor(n) === n;
}
function decodeUtf8(bytes) {
	let out = "";
	let i = 0;
	while (i < bytes.length) {
		const b = bytes[i++];
		if (b < 128) out += String.fromCharCode(b);
		else if (b < 224) out += String.fromCharCode((b & 31) << 6 | bytes[i++] & 63);
		else if (b < 240) out += String.fromCharCode((b & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63);
		else {
			const v = ((b & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63) - 65536;
			out += String.fromCharCode(55296 + (v >> 10), 56320 + (v & 1023));
		}
	}
	return out;
}
function parseHeader(buffer) {
	if (buffer.byteLength < 32) fail("头部不足 32 字节");
	const dv = new DataView(buffer);
	for (let i = 0; i < 4; i++) if (dv.getUint8(i) !== MAGIC[i]) fail("magic 不是 ORB3");
	const h = {
		version: dv.getUint32(4, true),
		prefixLen: dv.getUint32(8, true),
		metaLen: dv.getUint32(12, true),
		indexLen: dv.getUint32(16, true),
		frameCount: dv.getUint32(20, true),
		indexEntrySize: dv.getUint32(24, true),
		flags: dv.getUint32(28, true)
	};
	if (h.version !== 65538 && h.version !== 65537 && h.version !== 1) fail(`不支持的版本 ${versionText(h.version)}（支持 1.0 / 1.1 / 1.2）`);
	if (h.indexEntrySize !== 16) fail(`不支持的索引项大小 ${h.indexEntrySize}`);
	if (h.indexLen !== h.frameCount * 16) fail("indexLen 与 frameCount 不一致");
	if (h.prefixLen !== 32 + h.metaLen + h.indexLen) fail("prefixLen 不一致");
	if (h.frameCount <= 0) fail("frameCount 为 0");
	return h;
}
function parsePrefix(buffer, h, fileSize, strictEnd) {
	if (buffer.byteLength < h.prefixLen) fail("Header/Meta/Index 不完整");
	const dv = new DataView(buffer, 0, h.prefixLen);
	let meta;
	try {
		meta = JSON.parse(decodeUtf8(new Uint8Array(buffer, 32, h.metaLen)));
	} catch (err) {
		fail(`meta 不是合法 JSON: ${err.message}`);
	}
	if (!meta || meta.format !== "orbit360.bundle") fail(`meta.format 不是 ${FORMAT}`);
	const canvas = meta.canvas || {};
	if (!isInt(canvas.width) || !isInt(canvas.height) || canvas.width <= 0 || canvas.height <= 0) fail("meta 缺少合法的 canvas.width/height");
	if (meta.totalFrames !== h.frameCount) fail("meta.totalFrames 与头部不一致");
	if (typeof meta.codec !== "string" || !meta.codec) fail("meta 缺少 codec");
	if (!Array.isArray(meta.videos) || !meta.videos.length) fail("meta 缺少 videos 数组");
	const sceneOrbit = meta.orbit || {};
	const sceneAxis = sceneOrbit.axis !== void 0 ? sceneOrbit.axis : "x";
	if (sceneAxis !== "x" && sceneAxis !== "y") fail("meta.orbit.axis 只能是 x / y");
	const sceneMin = sceneOrbit.minAngle === void 0 ? -180 : sceneOrbit.minAngle;
	const sceneMax = sceneOrbit.maxAngle === void 0 ? 180 : sceneOrbit.maxAngle;
	if (typeof sceneMin !== "number" || !Number.isFinite(sceneMin) || typeof sceneMax !== "number" || !Number.isFinite(sceneMax) || sceneMin < -180 || sceneMax > 180 || sceneMin >= sceneMax) fail("meta.orbit.minAngle/maxAngle 必须在 -180..180 且 min < max");
	let sum = 0;
	let expectStart = 0;
	for (let vi = 0; vi < meta.videos.length; vi++) {
		var _v$orbit;
		const v = meta.videos[vi];
		const f = v && v.frames;
		const r = v && v.rect;
		if (!v || !f || !r) fail(`视频 ${vi} 缺少 rect/frames`);
		const videoAxis = ((_v$orbit = v.orbit) === null || _v$orbit === void 0 ? void 0 : _v$orbit.axis) !== void 0 ? v.orbit.axis : sceneAxis;
		if (videoAxis !== "x" && videoAxis !== "y") fail(`视频 ${vi} 的 orbit.axis 只能是 x / y`);
		if (videoAxis !== sceneAxis) fail(`视频 ${vi} 的轴 ${videoAxis} 与场景的 ${sceneAxis} 不一致`);
		const vo = v.orbit || {};
		const videoMin = vo.minAngle === void 0 ? sceneMin : vo.minAngle;
		const videoMax = vo.maxAngle === void 0 ? sceneMax : vo.maxAngle;
		if (videoMin !== sceneMin || videoMax !== sceneMax) fail(`视频 ${vi} 的角度限制与场景不一致`);
		if (!isInt(f.count) || f.count <= 0) fail(`视频 ${vi} 的 frames.count 非法`);
		if (f.indexStart !== expectStart) fail(`视频 ${vi} 的 indexStart 不连续`);
		if (!isInt(r.x) || !isInt(r.y) || !isInt(r.width) || !isInt(r.height)) fail(`视频 ${vi} 的 rect 不是整数`);
		if (r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > canvas.width || r.y + r.height > canvas.height) fail(`视频 ${vi} 的 rect 越界`);
		expectStart += f.count;
		sum += f.count;
	}
	if (sum !== h.frameCount) fail("videos 帧数之和与 frameCount 不一致");
	const entries = Array.from({ length: h.frameCount });
	let expectedOff = h.prefixLen;
	let e = 0;
	for (let vi = 0; vi < meta.videos.length; vi++) {
		const count = meta.videos[vi].frames.count;
		for (let k = 0; k < count; k++) {
			const base = 32 + h.metaLen + e * 16;
			const ev = dv.getUint32(base, true);
			const len = dv.getUint32(base + 4, true);
			const lo = dv.getUint32(base + 8, true);
			const off = dv.getUint32(base + 12, true) * 4294967296 + lo;
			if (ev !== vi) fail(`第 ${e} 条索引的 video 编号不对`);
			if (!len || off !== expectedOff) fail(`第 ${e} 条索引偏移不连续`);
			if (fileSize != null && off + len > fileSize) fail(`第 ${e} 条索引越界`);
			entries[e] = [
				ev,
				len,
				off
			];
			expectedOff += len;
			e++;
		}
	}
	if (fileSize != null && strictEnd && expectedOff !== fileSize) fail("索引与文件长度不一致（可能被截断）");
	return {
		meta,
		entries
	};
}
const B64$1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64(bytes) {
	const parts = [];
	let chunk = "";
	let i = 0;
	for (; i + 2 < bytes.length; i += 3) {
		const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
		chunk += B64$1[n >> 18 & 63] + B64$1[n >> 12 & 63] + B64$1[n >> 6 & 63] + B64$1[n & 63];
		if (chunk.length >= 8192) {
			parts.push(chunk);
			chunk = "";
		}
	}
	const left = bytes.length - i;
	if (left === 1) {
		const n = bytes[i] << 16;
		chunk += B64$1[n >> 18 & 63] + B64$1[n >> 12 & 63] + "==";
	} else if (left === 2) {
		const n = bytes[i] << 16 | bytes[i + 1] << 8;
		chunk += B64$1[n >> 18 & 63] + B64$1[n >> 12 & 63] + B64$1[n >> 6 & 63] + "=";
	}
	parts.push(chunk);
	return parts.join("");
}
function makeResult(h, meta, entries, size, buffer) {
	function frameEntry(vi, fi) {
		const v = meta.videos[vi];
		if (!v) fail(`没有视频 ${vi}`);
		if (!isInt(fi) || fi < 0 || fi >= v.frames.count) fail(`视频 ${vi} 没有第 ${fi} 帧`);
		const e = entries[v.frames.indexStart + fi];
		return {
			video: e[0],
			length: e[1],
			offset: e[2]
		};
	}
	function frameBytes(vi, fi) {
		if (!buffer) fail("解析结果没有完整文件数据");
		const e = frameEntry(vi, fi);
		if (e.offset + e.length > buffer.byteLength) fail("帧数据超出文件长度（可能被截断）");
		return new Uint8Array(buffer, e.offset, e.length);
	}
	function frameDataUrl(vi, fi) {
		return `data:${typeof meta.codec === "string" && meta.codec ? meta.codec : "image/webp"};base64,${bytesToBase64(frameBytes(vi, fi))}`;
	}
	return {
		header: h,
		meta,
		entries,
		prefixLen: h.prefixLen,
		size,
		buffer,
		frameEntry,
		frameBytes,
		frameDataUrl
	};
}
function parse(buffer) {
	if (!buffer || typeof buffer.byteLength !== "number") fail("需要 ArrayBuffer");
	const h = parseHeader(buffer);
	if (buffer.byteLength < h.prefixLen) fail("Header/Meta/Index 不完整");
	const whole = buffer.byteLength > h.prefixLen;
	const parts = parsePrefix(buffer, h, whole ? buffer.byteLength : null, whole);
	return makeResult(h, parts.meta, parts.entries, buffer.byteLength, buffer);
}
const OrbBundle = {
	parse,
	HEADER_SIZE: 32,
	ENTRY_SIZE: 16,
	VERSION
};
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
//#region src/client.ts
const VERSION$1 = "0.1.0";
const RAD = Math.PI / 180;
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
		degPerSec: 14,
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
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX = {};
for (let i = 0; i < 64; i++) B64_INDEX[B64[i]] = i;
const mod = (a, n) => (a % n + n) % n;
const shortDelta = (from, to) => mod(to - from + 180, 360) - 180;
const wrapSigned = (deg) => mod(deg + 180, 360) - 180;
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const now = () => Date.now();
function isPlainObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
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
function clone(value) {
	if (Array.isArray(value)) return value.map(clone);
	if (isPlainObject(value)) {
		const out = {};
		for (const key of Object.keys(value)) out[key] = clone(value[key]);
		return out;
	}
	return value;
}
function sceneConfigFrom(meta) {
	const out = {};
	for (const key of CONFIG_KEYS) if (meta && meta[key] !== void 0) out[key] = meta[key];
	return out;
}
function base64ToBuffer(base64) {
	const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
	let padding = 0;
	if (clean.endsWith("==")) padding = 2;
	else if (clean.endsWith("=")) padding = 1;
	const bytes = new Uint8Array(clean.length / 4 * 3 - padding);
	let p = 0;
	for (let i = 0; i < clean.length; i += 4) {
		const n = B64_INDEX[clean[i]] << 18 | B64_INDEX[clean[i + 1]] << 12 | (B64_INDEX[clean[i + 2]] || 0) << 6 | (B64_INDEX[clean[i + 3]] || 0);
		bytes[p++] = n >> 16 & 255;
		if (p < bytes.length) bytes[p++] = n >> 8 & 255;
		if (p < bytes.length) bytes[p++] = n & 255;
	}
	return bytes.buffer;
}
function systemDpr() {
	try {
		if (typeof wx !== "undefined" && typeof wx.getWindowInfo === "function") return wx.getWindowInfo().pixelRatio || 1;
		if (typeof wx !== "undefined") return wx.getSystemInfoSync().pixelRatio || 1;
	} catch (_unused) {}
	return 1;
}
function windowSize() {
	try {
		const info = typeof wx.getWindowInfo === "function" ? wx.getWindowInfo() : wx.getSystemInfoSync();
		return {
			width: Number(info.windowWidth) || 0,
			height: Number(info.windowHeight) || 0
		};
	} catch (_unused2) {
		return {
			width: 0,
			height: 0
		};
	}
}
function screenAngle() {
	try {
		const info = typeof wx.getWindowInfo === "function" ? wx.getWindowInfo() : wx.getSystemInfoSync();
		return info.windowWidth > info.windowHeight ? 90 : 0;
	} catch (_unused3) {
		return 0;
	}
}
function headingOf(e, orientation) {
	const a = e.alpha;
	const b = e.beta;
	const g = e.gamma;
	if (typeof a !== "number") return null;
	if (typeof b !== "number" || typeof g !== "number") return mod(360 - a, 360);
	const A = a * RAD;
	const B = b * RAD;
	const G = g * RAD;
	const vx = Math.sin(G) * Math.cos(A) + Math.cos(G) * Math.sin(B) * Math.sin(A);
	const vy = Math.sin(G) * Math.sin(A) - Math.cos(G) * Math.sin(B) * Math.cos(A);
	if (Math.hypot(vx, vy) < .25) return orientation === 90 || orientation === 270 ? mod(a, 360) : mod(360 - a, 360);
	return mod(Math.atan2(-vx, -vy) / RAD, 360);
}
function pitchOf(e) {
	const b = e.beta;
	if (typeof b !== "number" || Number.isNaN(b)) return null;
	return mod(b, 360);
}
var Orbit360Client = class {
	/**
	* @param canvas 小程序 Canvas 2D 节点（type="2d"）
	* @param options
	* @param options.width 画布 CSS 宽度
	* @param options.height 画布 CSS 高度
	* @param options.config 用户配置覆盖
	* @param options.dprCap=2
	* @param options.concurrency=6
	* @param options.autoStartGyro=false
	* @param options.deviceMotionInterval='game'
	*/
	constructor(canvas, options = {}) {
		if (!canvas || typeof canvas.getContext !== "function") throw new Error("Orbit360Client: 需要小程序 Canvas 2D 节点");
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		if (!this.ctx) throw new Error("Orbit360Client: 无法获取 2D context");
		this.options = _objectSpread2({
			dprCap: 2,
			concurrency: 6,
			autoStartGyro: false,
			deviceMotionInterval: "game"
		}, options);
		this._systemDpr = Number(options.dpr) > 0 ? Number(options.dpr) : systemDpr();
		const fallback = windowSize();
		this._viewW = Number(options.width) || fallback.width || 0;
		this._viewH = Number(options.height) || fallback.height || 0;
		this._orientation = screenAngle();
		this._events = /* @__PURE__ */ new Map();
		this._userConfig = deepMerge({}, options.config || {});
		this._sceneConfig = {};
		this._config = this._resolveConfig();
		this._meta = null;
		this._format = null;
		this._quality = null;
		this._codec = null;
		this._layers = [];
		this._frames = [];
		this._count = 0;
		this._canvasW = 0;
		this._canvasH = 0;
		this._frameW = 0;
		this._frameH = 0;
		this._frameDeg = 1;
		this._degPerFrame = 360;
		this._angle = 0;
		this._target = 0;
		this._vel = 0;
		this._dragging = false;
		this._lastPointerX = 0;
		this._lastPointerY = 0;
		this._lastPointerT = 0;
		this._idleSince = now();
		this._autoWeight = 0;
		this._orientT = 0;
		this._invert = false;
		this._axis = "x";
		this._minAngle = -180;
		this._maxAngle = 180;
		this._limited = false;
		this._mouseFollow = false;
		this._inertia = true;
		this._fitMode = "contain";
		this._autoState = "off";
		this._autoDir = 1;
		this._autoSpeed = 14;
		this._gyro = false;
		this._gyroSeen = false;
		this._pendingGyro = false;
		this._gyroRef = null;
		this._gyroBase = 0;
		this._gyroGain = 1;
		this._gyroSmooth = true;
		this._gyroTimer = null;
		this._viewW = this._viewW || 1;
		this._viewH = this._viewH || 1;
		this._dpr = 1;
		this._dst = {
			x: 0,
			y: 0,
			w: 0,
			h: 0
		};
		this._drawnIndex = -1;
		this._lastT = 0;
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
		this._tempDirPromise = null;
		this._motionHandler = (e) => this._handleMotion(e);
		this._loopHandler = () => this._loop(now());
		this._applyConfig();
		this.resize();
		this._raf = this.canvas.requestAnimationFrame(this._loopHandler);
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
		const i = list.indexOf(handler);
		if (i >= 0) list.splice(i, 1);
		if (!list.length) this._events.delete(type);
		return this;
	}
	_emit(type, payload) {
		const list = this._events.get(type);
		if (!list || !list.length) return;
		for (const handler of list.slice()) try {
			handler(payload);
		} catch (err) {
			console.error(err);
		}
	}
	_emitState() {
		this._emit("state", this.getState());
	}
	_emitAngle() {
		this._emit("angle", {
			angle: this._angle,
			target: this._target,
			axis: this._axis,
			frameIndex: this._frameIndex()
		});
	}
	_emitFrame(index) {
		this._emit("frame", {
			index,
			count: this._count,
			frameDeg: this._frameDeg
		});
	}
	_resolveConfig() {
		const scene = deepMerge({}, this._sceneConfig);
		if (scene.defaults && scene.defaults.auto) scene.auto = deepMerge({}, scene.auto, scene.defaults.auto);
		return deepMerge({}, DEFAULTS, scene, this._userConfig);
	}
	_applyConfig() {
		const cfg = this._config;
		this._invert = !!cfg.drag.invert;
		this._axis = cfg.orbit.axis === "y" ? "y" : "x";
		const minAngle = Number(cfg.orbit.minAngle);
		const maxAngle = Number(cfg.orbit.maxAngle);
		let lo = clampNum(Number.isFinite(minAngle) ? minAngle : -180, -180, 180);
		let hi = clampNum(Number.isFinite(maxAngle) ? maxAngle : 180, -180, 180);
		if (lo > hi) [lo, hi] = [hi, lo];
		this._minAngle = lo;
		this._maxAngle = hi;
		this._limited = lo > -180 || hi < 180;
		if (this._limited) {
			this._target = clampNum(this._target, lo, hi);
			this._angle = clampNum(this._angle, lo, hi);
		}
		this._gyroGain = Number(cfg.gyro.gain);
		this._gyroSmooth = cfg.gyro.smooth !== false;
		this._inertia = cfg.drag.inertia !== false;
		this._mouseFollow = cfg.mouseFollow.enabled !== false;
		this._fitMode = cfg.video.fit === "cover" ? "cover" : "contain";
		this._autoState = cfg.auto.enabled ? cfg.auto.dir === "ccw" ? "ccw" : "cw" : "off";
		this._autoDir = this._autoState === "ccw" ? -1 : 1;
		const speed = Number(cfg.auto.degPerSec);
		this._autoSpeed = Number.isFinite(speed) ? speed : DEFAULTS.auto.degPerSec;
		this._recalcFrames();
	}
	_recalcFrames() {
		this._degPerFrame = this._frameSpan() / Math.max(1, this._count);
		this._frameDeg = this._degPerFrame;
	}
	_frameSpan() {
		const span = Number(this._config.orbit.spanDeg);
		if (!Number.isFinite(span) || span <= 0) return 360;
		return Math.min(360, span);
	}
	_normAngle(value) {
		const v = Number(value);
		if (!Number.isFinite(v)) return this._limited ? this._minAngle : 0;
		if (this._limited) return clampNum(v, this._minAngle, this._maxAngle);
		return wrapSigned(v);
	}
	_angleDelta(from, to) {
		return this._limited ? to - from : shortDelta(from, to);
	}
	setConfig(partial) {
		this._userConfig = deepMerge(this._userConfig, partial || {});
		this._config = this._resolveConfig();
		this._applyConfig();
		if (partial && (partial.video || partial.orbit)) this._layout();
		this._emitState();
		return this;
	}
	resetConfig() {
		this._userConfig = {};
		this._config = this._resolveConfig();
		this._applyConfig();
		this._layout();
		this._emitState();
		return this;
	}
	getConfig() {
		return clone(this._config);
	}
	getMeta() {
		return clone(this._meta);
	}
	getState() {
		const frameIndex = this._frameIndex();
		return {
			ready: this._ready,
			loading: this._loading,
			destroyed: this._destroyed,
			format: this._format,
			quality: this._quality,
			codec: this._codec,
			title: this._config.title || "环绕视角",
			angle: this._normAngle(this._angle),
			target: this._normAngle(this._target),
			axis: this._axis,
			limits: {
				min: this._minAngle,
				max: this._maxAngle,
				limited: this._limited
			},
			velocity: this._vel,
			frameIndex,
			frameCount: this._count,
			frameDeg: this._frameDeg,
			degPerFrame: this._degPerFrame,
			dragging: this._dragging,
			missingFrames: this._countMissingFrames(),
			auto: {
				state: this._autoState,
				enabled: this._autoState !== "off",
				direction: this._autoState === "off" ? this._config.auto.dir || "cw" : this._autoState,
				speed: this._autoSpeed,
				weight: this._autoWeight,
				idleDelayMs: this._config.auto.idleDelayMs,
				rampInMs: this._config.auto.rampInMs,
				rampOutMs: this._config.auto.rampOutMs
			},
			gyro: {
				enabled: this._gyro,
				pending: this._pendingGyro,
				seen: this._gyroSeen,
				absolute: false,
				supported: this.isGyroSupported(),
				gain: this._gyroGain,
				invert: !!this._config.gyro.invert,
				smooth: this._gyroSmooth,
				smoothMs: this._config.gyro.smoothMs
			},
			inertia: this._inertia,
			invert: this._invert,
			fit: this._fitMode,
			mouseFollow: {
				enabled: this._mouseFollow,
				degPerPx: this._config.mouseFollow.degPerPx
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
		return this._normAngle(this._angle);
	}
	getTargetAngle() {
		return this._normAngle(this._target);
	}
	getFrameIndex() {
		return this._frameIndex();
	}
	getFrameCount() {
		return this._count;
	}
	setAngle(deg, options = {}) {
		const value = Number(deg);
		if (!Number.isFinite(value)) throw new Error("setAngle: deg 必须是数字");
		this._target = this._normAngle(value);
		this._vel = 0;
		if (options.immediate) {
			this._angle = this._target;
			this._paint();
			this._emitAngle();
		}
		this._touchActivity();
		this._emitState();
		return this;
	}
	rotateBy(deg) {
		const value = Number(deg);
		if (!Number.isFinite(value)) throw new Error("rotateBy: deg 必须是数字");
		this._target = this._normAngle(this._target + value);
		this._touchActivity();
		this._emitState();
		return this;
	}
	reset(angle = 0, options = {}) {
		this._target = this._normAngle(Number(angle) || 0);
		this._vel = 0;
		if (this._gyro) {
			this._gyroRef = null;
			this._gyroBase = 0;
		}
		if (options.immediate) {
			this._angle = this._target;
			this._paint();
			this._emitAngle();
		}
		this._touchActivity();
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
			if (value.dir) dir = value.dir;
		}
		const auto = { enabled };
		if (dir) {
			if (dir !== "cw" && dir !== "ccw") throw new Error("setAutoRotate: dir 必须是 cw / ccw");
			auto.dir = dir;
		}
		this.setConfig({ auto });
		this._touchActivity();
		return this._autoState;
	}
	cycleAuto() {
		const next = this._autoState === "off" ? "cw" : this._autoState === "cw" ? "ccw" : "off";
		this.setAutoRotate(next);
		return next;
	}
	setAutoSpeed(degPerSec) {
		const value = Number(degPerSec);
		if (!Number.isFinite(value)) throw new Error("setAutoSpeed: 需要数字");
		return this.setAutoConfig({ degPerSec: value });
	}
	setAutoConfig(partial) {
		this._touchActivity();
		return this.setConfig({ auto: partial || {} });
	}
	setGyroConfig(partial) {
		return this.setConfig({ gyro: partial || {} });
	}
	setDragConfig(partial) {
		return this.setConfig({ drag: partial || {} });
	}
	setMotionConfig(partial) {
		return this.setConfig({ motion: partial || {} });
	}
	setOrbitConfig(partial) {
		const result = this.setConfig({ orbit: partial || {} });
		this._recalcFrames();
		this._paint();
		return result;
	}
	setVideoConfig(partial) {
		return this.setConfig({ video: partial || {} });
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
		return this.setConfig({ mouseFollow: value || {} });
	}
	async load(source, options = {}) {
		source = normalizeSource(source);
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
			let buffer;
			if (typeof source === "string") {
				this._setProgress(.03, "fetch", 0, 0);
				buffer = await readSource(source);
				this._setProgress(.38, "fetch", 0, 0);
			} else if (source instanceof ArrayBuffer) {
				buffer = source;
				this._setProgress(.38, "read", 0, 0);
			} else if (source && source.buffer instanceof ArrayBuffer) {
				buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				this._setProgress(.38, "read", 0, 0);
			} else throw new Error("load: 需要 URL / 本地路径 / ArrayBuffer / Uint8Array");
			if (token !== this._loadToken || this._destroyed) return this;
			const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
			if (!(head.length === 4 && head[0] === 79 && head[1] === 82 && head[2] === 66 && head[3] === 51)) throw new Error("微信小程序 SDK 只支持 ORB3（.orb）场景包");
			await this._loadOrb(buffer, token, options);
			if (token !== this._loadToken || this._destroyed) return this;
			this._loading = false;
			this._ready = true;
			this._phase = "ready";
			this._loaded = this._total;
			this._setProgress(1, "ready", this._loaded, this._total);
			this.resize();
			this._emitAngle();
			this._emitFrame(this._frameIndex());
			this._emit("ready", {
				meta: this.getMeta(),
				config: this.getConfig(),
				state: this.getState()
			});
			this._emitState();
			return this;
		} catch (err) {
			if (token === this._loadToken && !this._destroyed) {
				this._loading = false;
				this._ready = false;
				this._phase = "error";
				this._emit("error", err);
				this._emitState();
			}
			throw err;
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
		this._frames = [];
		this._count = 0;
		this._canvasW = 0;
		this._canvasH = 0;
		this._frameW = 0;
		this._frameH = 0;
		this._ready = false;
		this._loading = false;
		this._progress = 0;
		this._loaded = 0;
		this._total = 0;
		this._drawnIndex = -1;
		this._sceneConfig = {};
		this._config = this._resolveConfig();
		this._applyConfig();
		this._layout();
		this._emitState();
		return this;
	}
	async _loadOrb(buffer, token, options) {
		const orb = parse(buffer);
		if (token !== this._loadToken) return;
		const meta = orb.meta;
		const layers = [];
		const jobs = [];
		meta.videos.forEach((video, vi) => {
			const frames = Array.from({ length: video.frames.count });
			layers.push({
				rect: video.rect,
				frames,
				count: video.frames.count
			});
			for (let fi = 0; fi < video.frames.count; fi++) jobs.push({
				run: async () => {
					try {
						return await this._loadFrameImage(orb, vi, fi);
					} catch (_unused4) {
						return null;
					}
				},
				set: (img) => {
					if (!img) {
						frames[fi] = null;
						return;
					}
					const iw = Number(img.width) || video.frames.width;
					const ih = Number(img.height) || video.frames.height;
					frames[fi] = {
						img,
						sx: 0,
						sy: 0,
						sw: iw,
						sh: ih
					};
				}
			});
		});
		this._total = jobs.length;
		this._loaded = 0;
		await this._decodeJobs(jobs, token, .4, .98);
		if (token !== this._loadToken) return;
		this._meta = meta;
		this._sceneConfig = sceneConfigFrom(meta);
		this._format = "orb";
		this._quality = options.quality || null;
		this._codec = meta.codec || null;
		this._canvasW = meta.canvas.width;
		this._canvasH = meta.canvas.height;
		this._frameW = this._canvasW;
		this._frameH = this._canvasH;
		this._count = Math.max.apply(null, meta.videos.map((v) => v.frames.count));
		this._layers = layers;
		this._frames = [];
		this._config = this._resolveConfig();
		this._applyConfig();
		this._angle = this._target = this._normAngle(Number(meta.initialAngle) || 0);
	}
	_loadImage(src) {
		return new Promise((resolve) => {
			const img = this.canvas.createImage();
			let done = false;
			const finish = (value) => {
				if (done) return;
				done = true;
				resolve(value);
			};
			img.onload = () => setTimeout(() => finish(img), 0);
			img.onerror = () => finish(null);
			img.src = src;
		});
	}
	async _loadFrameImage(orb, vi, fi) {
		if (this.options.frameSource !== "data-url" && typeof wx !== "undefined" && wx.env && wx.env.USER_DATA_PATH && typeof wx.getFileSystemManager === "function") try {
			if (!this._tempDirPromise) this._tempDirPromise = ensureTempDir();
			const dir = await this._tempDirPromise;
			const ext = extForCodec(String(orb.meta.codec || ""));
			const filePath = `${dir}/${this._loadToken}-${vi}-${fi}.${ext}`;
			await writeTempFile(filePath, orb.frameBytes(vi, fi));
			const img = await this._loadImage(filePath);
			if (img) return img;
		} catch (_unused5) {}
		return await this._loadImage(orb.frameDataUrl(vi, fi));
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
				const img = await job.run();
				if (token !== this._loadToken || this._destroyed) return;
				job.set(img);
				done++;
				this._loaded = done;
				this._total = total;
				this._setProgress(from + done / total * (to - from), "decode", done, total);
			}
		};
		await Promise.all(Array.from({ length: concurrency }, worker));
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
		for (const layer of this._layers) for (const frame of layer.frames) if (!frame || !frame.img) missing++;
		return missing;
	}
	resize(width, height) {
		if (typeof width === "number" && width > 0) this._viewW = width;
		if (typeof height === "number" && height > 0) this._viewH = height;
		if (!this._viewW || !this._viewH) {
			const size = windowSize();
			this._viewW = this._viewW || size.width || 1;
			this._viewH = this._viewH || size.height || 1;
		}
		const w = this._viewW || 1;
		const h = this._viewH || 1;
		const cap = Number(this.options.dprCap) || 2;
		const dpr = Math.min(this._systemDpr || 1, cap);
		this._dpr = dpr;
		this._viewW = w;
		this._viewH = h;
		const bw = Math.round(w * dpr);
		const bh = Math.round(h * dpr);
		const resized = this.canvas.width !== bw || this.canvas.height !== bh;
		if (this.canvas.width !== bw) this.canvas.width = bw;
		if (this.canvas.height !== bh) this.canvas.height = bh;
		if (resized) this.ctx = this.canvas.getContext("2d");
		this.ctx.imageSmoothingEnabled = true;
		if ("imageSmoothingQuality" in this.ctx) this.ctx.imageSmoothingQuality = "medium";
		this._layout();
		return this;
	}
	setViewport(width, height) {
		return this.resize(width, height);
	}
	_fillBackdrop() {
		const w = this._viewW;
		const h = this._viewH;
		const g = this.ctx.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .42, Math.max(w, h) * .78);
		g.addColorStop(0, "#1b1f27");
		g.addColorStop(.62, "#0a0b0e");
		g.addColorStop(1, "#050608");
		this.ctx.fillStyle = g;
		this.ctx.fillRect(0, 0, w, h);
	}
	_layout() {
		var _cfg$video$portraitSc;
		if (!this._viewW || !this._viewH) return;
		const cfg = this._config;
		const vw = this._canvasW || this._frameW || cfg.video.width || 1280;
		const vh = this._canvasH || this._frameH || cfg.video.height || 720;
		const cover = this._fitMode === "cover";
		const scale = (cover ? Math.max(this._viewW / vw, this._viewH / vh) : Math.min(this._viewW / vw, this._viewH / vh) * (this._viewH > this._viewW ? (_cfg$video$portraitSc = cfg.video.portraitScale) !== null && _cfg$video$portraitSc !== void 0 ? _cfg$video$portraitSc : 1.25 : 1)) * (cover ? 1 : cfg.video.displayScale || 1);
		this._dst.w = vw * scale;
		this._dst.h = vh * scale;
		this._dst.x = (this._viewW - this._dst.w) / 2;
		this._dst.y = (this._viewH - this._dst.h) / 2;
		this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
		this._fillBackdrop();
		this._drawnIndex = -1;
		if (this._count && this._layers.length) this._paint();
	}
	_frameIndex() {
		if (!this._count) return 0;
		const angle = wrapSigned(this._angle * this._dirSign());
		const span = this._frameSpan();
		if (span >= 360) return mod(Math.round(mod(angle, 360) / this._degPerFrame), this._count);
		const t = (angle + span / 2) / span;
		return Math.min(this._count - 1, Math.max(0, Math.round(t * (this._count - 1))));
	}
	_dirSign() {
		return this._config.orbit.direction === "ccw" ? -1 : 1;
	}
	_layerFrame(layer, index) {
		if (!layer.count) return null;
		const i = layer.count === this._count ? index : mod(Math.floor(index * layer.count / this._count), layer.count);
		return layer.frames[i];
	}
	_paint() {
		if (!this._layers.length || !this._count) return;
		const index = this._frameIndex();
		if (index === this._drawnIndex) return;
		this._drawnIndex = index;
		const cw = this._canvasW || this._frameW || 1;
		const ch = this._canvasH || this._frameH || 1;
		const sx = this._dst.w / cw;
		const sy = this._dst.h / ch;
		this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
		for (const layer of this._layers) {
			const frame = this._layerFrame(layer, index);
			if (!frame || !frame.img) continue;
			const r = layer.rect;
			this.ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, this._dst.x + r.x * sx, this._dst.y + r.y * sy, r.width * sx, r.height * sy);
		}
		this._emitFrame(index);
	}
	_loop(t) {
		var _this$_config$motion$;
		if (this._destroyed || this._paused) return;
		const dt = Math.min(t - (this._lastT || t), 64);
		this._lastT = t;
		if (!this._dragging) {
			if (this._inertia && !this._gyro && Math.abs(this._vel) > 5e-4) {
				var _this$_config$drag$in;
				const next = this._normAngle(this._target + this._vel * dt);
				if (this._limited && next === this._target) this._vel = 0;
				this._target = next;
				this._vel *= Math.exp(-dt / ((_this$_config$drag$in = this._config.drag.inertiaMs) !== null && _this$_config$drag$in !== void 0 ? _this$_config$drag$in : 110));
				this._touchActivity();
			} else this._vel = 0;
		}
		this._updateAuto(dt, t);
		const prev = this._angle;
		const delta = this._angleDelta(this._angle, this._target);
		const tau = (_this$_config$motion$ = this._config.motion.smoothMs) !== null && _this$_config$motion$ !== void 0 ? _this$_config$motion$ : 62;
		const next = this._angle + delta * (1 - Math.exp(-dt / tau));
		this._angle = this._limited ? clampNum(next, this._minAngle, this._maxAngle) : mod(next, 360);
		if (Math.abs(this._angleDelta(this._angle, this._target)) < 5e-4) this._angle = this._target;
		this._paint();
		if (this._angle !== prev) this._emitAngle();
		this._raf = this.canvas.requestAnimationFrame(this._loopHandler);
	}
	_updateAuto(dt, t) {
		var _this$_config$auto$id, _this$_config$auto$ra, _this$_config$auto$ra2;
		const idle = t - this._idleSince;
		const want = this._autoState !== "off" && !this._gyro && !this._dragging && idle > ((_this$_config$auto$id = this._config.auto.idleDelayMs) !== null && _this$_config$auto$id !== void 0 ? _this$_config$auto$id : 2200) ? 1 : 0;
		const tau = want ? (_this$_config$auto$ra = this._config.auto.rampInMs) !== null && _this$_config$auto$ra !== void 0 ? _this$_config$auto$ra : 700 : this._dragging ? 120 : (_this$_config$auto$ra2 = this._config.auto.rampOutMs) !== null && _this$_config$auto$ra2 !== void 0 ? _this$_config$auto$ra2 : 280;
		this._autoWeight += (want - this._autoWeight) * (1 - Math.exp(-dt / tau));
		if (want === 0 && this._autoWeight < .004) {
			this._autoWeight = 0;
			return;
		}
		if (this._autoWeight <= 0) return;
		this._target = this._normAngle(this._target + this._autoDir * this._autoSpeed * this._autoWeight * dt / 1e3);
	}
	_touchActivity() {
		this._idleSince = now();
	}
	_touchPoint(e) {
		const t = (e && (e.touches || e.changedTouches) || [])[0];
		if (!t) return null;
		const x = typeof t.x === "number" ? t.x : t.clientX;
		const y = typeof t.y === "number" ? t.y : t.clientY;
		if (typeof x !== "number" || typeof y !== "number") return null;
		return {
			x,
			y,
			t: e.timeStamp || now()
		};
	}
	touchStart(e) {
		const p = this._touchPoint(e);
		if (!p) return this;
		if (this._pendingGyro) {
			this._pendingGyro = false;
			this.enableGyro();
		}
		this._dragging = true;
		this._vel = 0;
		this._lastPointerX = p.x;
		this._lastPointerY = p.y;
		this._lastPointerT = p.t;
		this._touchActivity();
		this._emit("dragstart", { pointerType: "touch" });
		clearTimeout(this._pressTimer);
		this._pressTimer = null;
		this._pressStart = {
			x: p.x,
			y: p.y
		};
		this._pressTimer = setTimeout(() => {
			this._pressTimer = null;
			this._suppressMove = true;
			this._dragging = false;
			this._vel = 0;
			this._emit("longpress", {});
			this._emitState();
		}, 420);
		this._emitState();
		return this;
	}
	touchMove(e) {
		var _this$_config$drag$de;
		const p = this._touchPoint(e);
		if (!p) return this;
		if (this._pressStart && Math.hypot(p.x - this._pressStart.x, p.y - this._pressStart.y) > 8) {
			clearTimeout(this._pressTimer);
			this._pressTimer = null;
			this._pressStart = null;
		}
		if (this._suppressMove) return this;
		if (!this._dragging) return this;
		const dx = p.x - this._lastPointerX;
		const dy = p.y - this._lastPointerY;
		const dt = Math.max(p.t - this._lastPointerT, 1);
		const deg = (this._axis === "y" ? dy : dx) * ((_this$_config$drag$de = this._config.drag.degPerPx) !== null && _this$_config$drag$de !== void 0 ? _this$_config$drag$de : .42) * (this._invert ? -1 : 1);
		this._target = this._normAngle(this._target + deg);
		if (this._gyro) this._gyroBase = this._normAngle(this._gyroBase + deg);
		const inst = dt > 90 ? 0 : deg / dt;
		this._vel = .6 * inst + .4 * this._vel;
		this._lastPointerX = p.x;
		this._lastPointerY = p.y;
		this._lastPointerT = p.t;
		this._touchActivity();
		return this;
	}
	touchEnd(_e) {
		clearTimeout(this._pressTimer);
		this._pressTimer = null;
		this._pressStart = null;
		if (this._suppressMove) {
			this._suppressMove = false;
			this._dragging = false;
			this._vel = 0;
			this._emitState();
			return this;
		}
		if (!this._dragging) return this;
		this._dragging = false;
		if (now() - this._lastPointerT > 90) this._vel = 0;
		this._vel = Math.max(-.55, Math.min(.55, this._vel));
		this._touchActivity();
		this._emit("dragend", { velocity: this._vel });
		this._emitState();
		return this;
	}
	touchCancel(e) {
		return this.touchEnd(e);
	}
	isGyroSupported() {
		return typeof wx !== "undefined" && typeof wx.startDeviceMotionListening === "function";
	}
	_initAutoGyro() {
		if (this._destroyed) return;
		if (!this.isGyroSupported()) return;
		this._pendingGyro = true;
		this._emit("gyrochange", {
			enabled: false,
			pending: true,
			reason: "permission",
			state: this.getState()
		});
		this._emitState();
	}
	enableGyro() {
		if (this._gyro) return Promise.resolve(true);
		return new Promise((resolve) => {
			if (!this.isGyroSupported()) {
				this._pendingGyro = false;
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
			wx.startDeviceMotionListening({
				interval: this.options.deviceMotionInterval || "game",
				success: () => {
					this._orientation = screenAngle();
					wx.onDeviceMotionChange(this._motionHandler);
					this._gyro = true;
					this._pendingGyro = false;
					this._gyroSeen = false;
					this._gyroRef = null;
					this._emit("gyrochange", {
						enabled: true,
						pending: false,
						reason: "enabled",
						state: this.getState()
					});
					this._emitState();
					clearTimeout(this._gyroTimer);
					this._gyroTimer = setTimeout(() => {
						if (this._destroyed || this._gyroSeen) return;
						this._stopGyro("no-readings");
					}, 2200);
					resolve(true);
				},
				fail: (err) => {
					this._pendingGyro = false;
					this._emit("gyrochange", {
						enabled: false,
						pending: false,
						reason: "error",
						error: err,
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
		clearTimeout(this._gyroTimer);
		this._gyroTimer = null;
		if (this._gyro) try {
			wx.offDeviceMotionChange(this._motionHandler);
			wx.stopDeviceMotionListening();
		} catch (_unused6) {}
		const wasEnabled = this._gyro;
		this._gyro = false;
		this._pendingGyro = false;
		this._gyroRef = null;
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
		this._gyroRef = null;
		this._gyroBase = this._target;
		return this;
	}
	_handleMotion(e) {
		const heading = this._axis === "y" ? pitchOf(e) : headingOf(e, this._orientation);
		if (heading === null) return;
		this._gyroSeen = true;
		clearTimeout(this._gyroTimer);
		this._gyroTimer = null;
		if (this._dragging) return;
		if (this._gyroRef === null) {
			this._gyroRef = heading;
			this._gyroBase = this._target;
			return;
		}
		const gain = this._gyroGain * (this._config.gyro.invert ? -1 : 1) * (this._invert ? -1 : 1);
		const delta = shortDelta(this._gyroRef, heading) * gain;
		const raw = this._normAngle(this._gyroBase - delta);
		if (this._gyroSmooth) {
			var _this$_config$gyro$sm;
			const t = now();
			const dt = Math.min(Math.max(t - this._orientT, 1), 120);
			this._orientT = t;
			const tau = (_this$_config$gyro$sm = this._config.gyro.smoothMs) !== null && _this$_config$gyro$sm !== void 0 ? _this$_config$gyro$sm : 80;
			this._target = this._normAngle(this._target + this._angleDelta(this._target, raw) * (1 - Math.exp(-dt / tau)));
		} else this._target = raw;
		this._touchActivity();
	}
	pause() {
		if (this._paused) return this;
		this._paused = true;
		if (this._raf) this.canvas.cancelAnimationFrame(this._raf);
		this._raf = null;
		return this;
	}
	resume() {
		if (!this._paused || this._destroyed) return this;
		this._paused = false;
		this._lastT = 0;
		this._raf = this.canvas.requestAnimationFrame(this._loopHandler);
		return this;
	}
	destroy() {
		if (this._destroyed) return;
		this._destroyed = true;
		this._loadToken++;
		if (this._raf) this.canvas.cancelAnimationFrame(this._raf);
		this._raf = null;
		this._stopGyro("destroyed");
		clearTimeout(this._pressTimer);
		this._pressTimer = null;
		this._layers = [];
		this._frames = [];
		this._meta = null;
		this._ready = false;
		this._loading = false;
		try {
			const dir = frameTempDir();
			if (dir) wx.getFileSystemManager().rmdir({
				dirPath: dir,
				recursive: true
			});
		} catch (_unused7) {}
		this._emit("destroy", {});
		this._events.clear();
	}
};
function extForCodec(codec) {
	if (/jpe?g/i.test(codec)) return "jpg";
	if (/avif/i.test(codec)) return "avif";
	if (/png/i.test(codec)) return "png";
	return "webp";
}
function frameTempDir() {
	try {
		if (typeof wx !== "undefined" && wx.env && wx.env.USER_DATA_PATH) return `${wx.env.USER_DATA_PATH}/orbit360-frames`;
	} catch (_unused8) {}
	return null;
}
function ensureTempDir() {
	const dir = frameTempDir();
	return new Promise((resolve, reject) => {
		if (!dir) {
			reject(/* @__PURE__ */ new Error("当前环境没有 USER_DATA_PATH"));
			return;
		}
		wx.getFileSystemManager().mkdir({
			dirPath: dir,
			recursive: true,
			success: () => resolve(dir),
			fail: () => resolve(dir)
		});
	});
}
function writeTempFile(filePath, bytes) {
	return new Promise((resolve, reject) => {
		const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		wx.getFileSystemManager().writeFile({
			filePath,
			data,
			success: () => resolve(filePath),
			fail: reject
		});
	});
}
function isWechatLocalPath(source) {
	return source.startsWith("wxfile://") || source.startsWith("http://tmp/") || source.startsWith("http://usr/") || source.startsWith("http://store/") || source.startsWith("http://disk/");
}
function isNetworkUrl(source) {
	return /^https?:\/\//i.test(source) && !isWechatLocalPath(source);
}
function normalizeSource(source) {
	if (source && typeof source === "object" && !(source instanceof ArrayBuffer) && !ArrayBuffer.isView(source) && typeof source.path === "string") return source.path;
	return source;
}
async function readSource(source) {
	if (source.startsWith("data:")) {
		const comma = source.indexOf(",");
		if (comma < 0) throw new Error("data URL 格式不正确");
		return base64ToBuffer(source.slice(comma + 1));
	}
	if (isNetworkUrl(source)) return new Promise((resolve, reject) => {
		wx.request({
			url: source,
			method: "GET",
			responseType: "arraybuffer",
			dataType: "其他",
			timeout: 6e4,
			success: (res) => {
				if (res.statusCode >= 200 && res.statusCode < 300 && res.data instanceof ArrayBuffer) resolve(res.data);
				else reject(/* @__PURE__ */ new Error(`包下载失败（HTTP ${res.statusCode}）`));
			},
			fail: (err) => reject(new Error(err && err.errMsg ? err.errMsg : "网络请求失败"))
		});
	});
	return new Promise((resolve, reject) => {
		const fs = wx.getFileSystemManager();
		const candidates = [source];
		if (source.startsWith("/")) candidates.push(source.slice(1));
		else candidates.push("/" + source);
		let index = 0;
		let lastError = null;
		const tryNext = () => {
			if (index >= candidates.length) {
				reject(new Error(lastError && lastError.errMsg ? lastError.errMsg : `读取文件失败：${source}`));
				return;
			}
			fs.readFile({
				filePath: candidates[index++],
				success: (res) => resolve(res.data),
				fail: (err) => {
					lastError = err;
					tryNext();
				}
			});
		};
		tryNext();
	});
}
function queryCanvas(options = {}) {
	return new Promise((resolve, reject) => {
		const selector = options.selector || "#orbit-canvas";
		const query = wx.createSelectorQuery();
		if (options.component && typeof query.in === "function") try {
			query.in(options.component);
		} catch (_unused9) {}
		query.select(selector).fields({
			node: true,
			size: true
		}).exec((res) => {
			const info = res && res[0];
			if (!info || !info.node) {
				reject(/* @__PURE__ */ new Error(`找不到 Canvas 节点：${selector}`));
				return;
			}
			resolve(info);
		});
	});
}
/**
* 创建微信小程序渲染客户端。
*
* 传 selector 时异步查询 Canvas 节点；传 canvas 节点时直接创建。
*
*   const client = await createClient({
*     selector: "#orbit-canvas",
*     component: this,
*     config: { auto: { enabled: true } },
*   });
*/
function createClient(options = {}) {
	if (options.canvas) return Promise.resolve(new Orbit360Client(options.canvas, _objectSpread2(_objectSpread2({}, options), {}, {
		width: options.width || options.canvas._width,
		height: options.height || options.canvas._height
	})));
	return queryCanvas(options).then((info) => {
		return new Orbit360Client(info.node, _objectSpread2(_objectSpread2({}, options), {}, {
			width: info.width,
			height: info.height
		}));
	});
}
//#endregion
export { Orbit360Client as Client, Orbit360Client, Orbit360Client as default, DEFAULTS, ENTRY_SIZE, FORMAT, HEADER_SIZE, MAGIC, VERSION as ORB_VERSION, OrbBundle, VERSION$1 as VERSION, VERSION_MAJOR, VERSION_MINOR, createClient, parse as parseOrb, queryCanvas };
