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
const MAGIC = [
	79,
	82,
	66,
	51
];
const FORMAT = "orbit360.bundle";
const VERSION$1 = 65538;
function fail(msg) {
	throw new Error("ORB3: " + msg);
}
function versionText(raw) {
	return raw === 1 ? "1.0" : `${raw >>> 16}.${raw & 65535}`;
}
function isInt(n) {
	return typeof n === "number" && Number.isFinite(n) && Math.floor(n) === n;
}
function readBlob(blob) {
	if (blob.arrayBuffer) return blob.arrayBuffer();
	const { promise, resolve, reject } = Promise.withResolvers();
	const fr = new FileReader();
	fr.onload = () => resolve(fr.result);
	fr.onerror = () => reject(fr.error || /* @__PURE__ */ new Error("读取失败"));
	fr.readAsArrayBuffer(blob);
	return promise;
}
function decodeUtf8(bytes) {
	if (typeof TextDecoder === "function") return new TextDecoder("utf-8").decode(bytes);
	let s = "";
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
	return decodeURIComponent(escape(s));
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
function makeResult(h, meta, entries, size, blob) {
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
	function frameBlob(vi, fi) {
		if (!blob) fail("parse() 的结果没有 Blob，请用 fromBlob()");
		const e = frameEntry(vi, fi);
		return blob.slice(e.offset, e.offset + e.length);
	}
	return {
		header: h,
		meta,
		entries,
		prefixLen: h.prefixLen,
		size,
		blob,
		frameEntry,
		frameBlob
	};
}
function parse(buffer) {
	if (!buffer || typeof buffer.byteLength !== "number") fail("需要 ArrayBuffer");
	const h = parseHeader(buffer);
	if (buffer.byteLength < h.prefixLen) fail("Header/Meta/Index 不完整");
	const whole = buffer.byteLength > h.prefixLen;
	const parts = parsePrefix(buffer, h, whole ? buffer.byteLength : null, whole);
	return makeResult(h, parts.meta, parts.entries, buffer.byteLength, null);
}
function fromBlob(_x) {
	return _fromBlob.apply(this, arguments);
}
function _fromBlob() {
	_fromBlob = _asyncToGenerator(function* (blob) {
		if (!blob || typeof blob.slice !== "function") fail("需要 Blob / File");
		const h = parseHeader(yield readBlob(blob.slice(0, 32)));
		if (h.prefixLen > blob.size) fail("文件被截断（prefixLen 超出文件）");
		const parts = parsePrefix(yield readBlob(blob.slice(0, h.prefixLen)), h, blob.size, true);
		return makeResult(h, parts.meta, parts.entries, blob.size, blob);
	});
	return _fromBlob.apply(this, arguments);
}
const OrbBundle = {
	parse,
	fromBlob,
	HEADER_SIZE: 32,
	ENTRY_SIZE: 16,
	VERSION: VERSION$1
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
const VERSION = "0.1.0";
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
		touchScale: 2.5,
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
const mod = (a, n) => (a % n + n) % n;
const shortDelta = (from, to) => mod(to - from + 180, 360) - 180;
const wrapSigned = (deg) => mod(deg + 180, 360) - 180;
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
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
function blobToBuffer(blob) {
	if (blob.arrayBuffer) return blob.arrayBuffer();
	return new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onload = () => resolve(fr.result);
		fr.onerror = () => reject(fr.error || /* @__PURE__ */ new Error("读取失败"));
		fr.readAsArrayBuffer(blob);
	});
}
function blobToText(blob) {
	if (blob.text) return blob.text();
	return new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onload = () => resolve(fr.result);
		fr.onerror = () => reject(fr.error || /* @__PURE__ */ new Error("读取失败"));
		fr.readAsText(blob, "utf-8");
	});
}
function readZipEntries(_x) {
	return _readZipEntries.apply(this, arguments);
}
function _readZipEntries() {
	_readZipEntries = _asyncToGenerator(function* (blob) {
		const buf = new Uint8Array(yield blobToBuffer(blob));
		const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
		let eocd = -1;
		const stop = Math.max(0, buf.length - 22 - 65535);
		for (let i = buf.length - 22; i >= stop; i--) if (dv.getUint32(i, true) === 101010256) {
			eocd = i;
			break;
		}
		if (eocd < 0) throw new Error("不是有效的 zip 文件");
		const total = dv.getUint16(eocd + 10, true);
		let off = dv.getUint32(eocd + 16, true);
		const entries = /* @__PURE__ */ new Map();
		for (let i = 0; i < total; i++) {
			if (dv.getUint32(off, true) !== 33639248) throw new Error("zip 中央目录损坏");
			const method = dv.getUint16(off + 10, true);
			const compSize = dv.getUint32(off + 20, true);
			const nameLen = dv.getUint16(off + 28, true);
			const extraLen = dv.getUint16(off + 30, true);
			const commentLen = dv.getUint16(off + 32, true);
			const localOff = dv.getUint32(off + 42, true);
			const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
			const lNameLen = dv.getUint16(localOff + 26, true);
			const lExtraLen = dv.getUint16(localOff + 28, true);
			const dataStart = localOff + 30 + lNameLen + lExtraLen;
			entries.set(name, {
				method,
				data: buf.subarray(dataStart, dataStart + compSize)
			});
			off += 46 + nameLen + extraLen + commentLen;
		}
		return entries;
	});
	return _readZipEntries.apply(this, arguments);
}
function zipFileBlob(_x2, _x3) {
	return _zipFileBlob.apply(this, arguments);
}
function _zipFileBlob() {
	_zipFileBlob = _asyncToGenerator(function* (entries, name) {
		const e = entries.get(name);
		if (!e) return null;
		if (e.method === 0) return new Blob([e.data], { type: "application/octet-stream" });
		if (typeof DecompressionStream === "function") {
			const stream = new Blob([e.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
			return yield new Response(stream).blob();
		}
		throw new Error(`${name} 使用了 deflate 压缩，当前浏览器无法解压`);
	});
	return _zipFileBlob.apply(this, arguments);
}
function loadImageBlob(blob) {
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
function isTouchDevice() {
	if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return true;
	if (typeof navigator === "undefined") return false;
	if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")) return true;
	return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
function screenAngle() {
	const so = typeof screen !== "undefined" ? screen.orientation : null;
	if (so && typeof so.angle === "number") return mod(so.angle, 360);
	return typeof window !== "undefined" && typeof window.orientation === "number" ? mod(window.orientation, 360) : 0;
}
function headingOf(e) {
	if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) return e.webkitCompassHeading;
	const a = e.alpha, b = e.beta, g = e.gamma;
	if (typeof a !== "number") return null;
	if (typeof b !== "number" || typeof g !== "number") return mod(360 - a, 360);
	const A = a * RAD, B = b * RAD, G = g * RAD;
	const vx = Math.sin(G) * Math.cos(A) + Math.cos(G) * Math.sin(B) * Math.sin(A);
	const vy = Math.sin(G) * Math.sin(A) - Math.cos(G) * Math.sin(B) * Math.cos(A);
	if (Math.hypot(vx, vy) < .25) {
		const sa = screenAngle();
		return sa === 90 || sa === 270 ? mod(a, 360) : mod(360 - a, 360);
	}
	return mod(Math.atan2(-vx, -vy) / RAD, 360);
}
function pitchOf(e) {
	const b = e.beta;
	if (typeof b !== "number" || Number.isNaN(b)) return null;
	return mod(b, 360);
}
var Orbit360Client = class {
	/**
	* @param {HTMLCanvasElement} canvas
	* @param {object} [options]
	* @param {HTMLElement} [options.container] 尺寸参考元素，默认 canvas.parentElement
	* @param {HTMLElement} [options.input] 指针事件目标，默认 container
	* @param {object} [options.config] 用户配置覆盖
	* @param {number} [options.dprCap=2]
	* @param {boolean} [options.autoStartGyro=false]
	* @param {number} [options.concurrency=6]
	* @param {string} [options.dragClass='dragging']
	*/
	constructor(canvas, options = {}) {
		if (!canvas || typeof canvas.getContext !== "function") throw new Error("Orbit360Client: 需要 canvas 元素");
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d", { alpha: false });
		if (!this.ctx) throw new Error("Orbit360Client: 无法获取 2D context");
		this.options = _objectSpread2({
			dprCap: 2,
			autoStartGyro: false,
			concurrency: 6,
			dragClass: "dragging",
			preventContextMenu: true
		}, options);
		this.container = options.container || canvas.parentElement || canvas;
		this.input = options.input || this.container;
		this.dragTarget = options.dragClassTarget || this.input;
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
		this._lastPointerType = "";
		this._hoverX = null;
		this._hoverY = null;
		this._idleSince = typeof performance !== "undefined" ? performance.now() : Date.now();
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
		this._hasAbsolute = false;
		this._gyroRef = null;
		this._gyroBase = 0;
		this._gyroGain = 1;
		this._gyroSmooth = true;
		this._gyroTimer = null;
		this._viewW = 0;
		this._viewH = 0;
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
		this._loadToken = 0;
		this._progress = 0;
		this._loaded = 0;
		this._total = 0;
		this._phase = "idle";
		this._pressTimer = null;
		this._pressStart = null;
		this._suppressMove = false;
		this._resizeQueued = false;
		this._loop = this._loop.bind(this);
		this._bindEvents();
		this._applyConfig();
		this.resize();
		this._raf = requestAnimationFrame(this._loop);
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
				absolute: this._hasAbsolute,
				supported: typeof DeviceOrientationEvent !== "undefined",
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
	load(_x4) {
		var _this = this;
		return _asyncToGenerator(function* (source, options = {}) {
			const token = ++_this._loadToken;
			_this._loading = true;
			_this._ready = false;
			_this._phase = "load";
			_this._loaded = 0;
			_this._total = 0;
			_this._setProgress(0, "load", 0, 0);
			_this._emit("loadstart", { source });
			_this._emitState();
			try {
				let blob;
				if (typeof source === "string") {
					_this._setProgress(.03, "fetch", 0, 0);
					const res = yield fetch(source, { cache: options.cache || "default" });
					if (!res.ok) throw new Error(`包下载失败（HTTP ${res.status}）`);
					_this._setProgress(.12, "fetch", 0, 0);
					blob = yield res.blob();
					_this._setProgress(.38, "fetch", 0, 0);
				} else if (typeof Blob !== "undefined" && source instanceof Blob) {
					blob = source;
					_this._setProgress(.38, "read", 0, 0);
				} else if (source instanceof ArrayBuffer) {
					blob = new Blob([source]);
					_this._setProgress(.38, "read", 0, 0);
				} else if (ArrayBuffer.isView(source)) {
					blob = new Blob([source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)]);
					_this._setProgress(.38, "read", 0, 0);
				} else throw new Error("load: 需要 URL / Blob / File / ArrayBuffer");
				if (token !== _this._loadToken || _this._destroyed) return _this;
				const head = blob.size >= 4 ? new Uint8Array(yield blobToBuffer(blob.slice(0, 4))) : null;
				if (head && head[0] === 79 && head[1] === 82 && head[2] === 66 && head[3] === 51) yield _this._loadOrb(blob, token, options);
				else yield _this._loadZip(blob, token, options);
				if (token !== _this._loadToken || _this._destroyed) return _this;
				_this._loading = false;
				_this._ready = true;
				_this._phase = "ready";
				_this._loaded = _this._total;
				_this._setProgress(1, "ready", _this._loaded, _this._total);
				_this.resize();
				_this._emitAngle();
				_this._emitFrame(_this._frameIndex());
				_this._emit("ready", {
					meta: _this.getMeta(),
					config: _this.getConfig(),
					state: _this.getState()
				});
				_this._emitState();
				return _this;
			} catch (err) {
				if (token === _this._loadToken && !_this._destroyed) {
					_this._loading = false;
					_this._ready = false;
					_this._phase = "error";
					_this._emit("error", err);
					_this._emitState();
				}
				throw err;
			}
		}).apply(this, arguments);
	}
	loadUrl(url, options = {}) {
		return this.load(url, options);
	}
	loadBlob(blob, options = {}) {
		return this.load(blob, options);
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
	_loadOrb(blob, token, options) {
		var _this2 = this;
		return _asyncToGenerator(function* () {
			if (typeof OrbBundle === "undefined" || typeof OrbBundle.fromBlob !== "function") throw new Error("缺少 ORB3 解析器");
			const orb = yield OrbBundle.fromBlob(blob);
			if (token !== _this2._loadToken) return;
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
					run: function() {
						var _ref = _asyncToGenerator(function* () {
							const frame = orb.frameBlob(vi, fi);
							return frame ? loadImageBlob(frame) : null;
						});
						return function run() {
							return _ref.apply(this, arguments);
						};
					}(),
					set: (img) => {
						frames[fi] = img ? {
							img,
							sx: 0,
							sy: 0,
							sw: video.frames.width,
							sh: video.frames.height
						} : null;
					}
				});
			});
			_this2._total = jobs.length;
			_this2._loaded = 0;
			yield _this2._decodeJobs(jobs, token, .4, .98);
			if (token !== _this2._loadToken) return;
			_this2._meta = meta;
			_this2._sceneConfig = sceneConfigFrom(meta);
			_this2._format = "orb";
			_this2._quality = options.quality || null;
			_this2._codec = meta.codec || null;
			_this2._canvasW = meta.canvas.width;
			_this2._canvasH = meta.canvas.height;
			_this2._frameW = _this2._canvasW;
			_this2._frameH = _this2._canvasH;
			_this2._count = Math.max.apply(null, meta.videos.map((v) => v.frames.count));
			_this2._layers = layers;
			_this2._frames = [];
			_this2._config = _this2._resolveConfig();
			_this2._applyConfig();
			_this2._angle = _this2._target = _this2._normAngle(Number(meta.initialAngle) || 0);
		})();
	}
	_loadZip(blob, token, options) {
		var _this3 = this;
		return _asyncToGenerator(function* () {
			const entries = yield readZipEntries(blob);
			if (token !== _this3._loadToken) return;
			const metaBlob = yield zipFileBlob(entries, "meta.json");
			if (!metaBlob) throw new Error("包里缺少 meta.json");
			const meta = JSON.parse(yield blobToText(metaBlob));
			const pack = meta.pack;
			if (!pack || !Array.isArray(pack.files) || !pack.files.length) throw new Error("meta 缺少 pack.files");
			const imgs = /* @__PURE__ */ new Map();
			const jobs = pack.files.map((name) => ({
				run: function() {
					var _ref2 = _asyncToGenerator(function* () {
						const file = yield zipFileBlob(entries, name);
						return file ? loadImageBlob(file) : null;
					});
					return function run() {
						return _ref2.apply(this, arguments);
					};
				}(),
				set: (img) => imgs.set(name, img)
			}));
			_this3._total = jobs.length;
			_this3._loaded = 0;
			yield _this3._decodeJobs(jobs, token, .4, .98);
			if (token !== _this3._loadToken) return;
			const count = pack.count || pack.files.length;
			let frames;
			if (pack.type === "atlas") {
				const per = pack.cols * pack.rows;
				frames = Array.from({ length: count }, (_, i) => {
					const img = imgs.get(pack.files[Math.floor(i / per)]);
					if (!img) return null;
					const k = i % per;
					return {
						img,
						sx: k % pack.cols * pack.frameW,
						sy: Math.floor(k / pack.cols) * pack.frameH,
						sw: pack.frameW,
						sh: pack.frameH
					};
				});
			} else frames = Array.from({ length: count }, (_, i) => {
				const img = imgs.get(pack.files[i]);
				return img ? {
					img,
					sx: 0,
					sy: 0,
					sw: pack.frameW,
					sh: pack.frameH
				} : null;
			});
			_this3._meta = meta;
			_this3._sceneConfig = sceneConfigFrom(meta);
			_this3._format = "zip";
			_this3._quality = options.quality || meta.quality || "std";
			_this3._codec = meta.codec || null;
			_this3._canvasW = pack.frameW;
			_this3._canvasH = pack.frameH;
			_this3._frameW = pack.frameW;
			_this3._frameH = pack.frameH;
			_this3._count = count;
			_this3._frames = frames;
			_this3._layers = [{
				rect: {
					x: 0,
					y: 0,
					width: pack.frameW,
					height: pack.frameH
				},
				frames,
				count
			}];
			_this3._config = _this3._resolveConfig();
			_this3._applyConfig();
			_this3._angle = _this3._target = _this3._normAngle(Number(meta.initialAngle) || 0);
		})();
	}
	_decodeJobs(jobs, token, from, to) {
		var _this4 = this;
		return _asyncToGenerator(function* () {
			const total = Math.max(1, jobs.length);
			let done = 0;
			let next = 0;
			const concurrency = Math.max(1, Number(_this4.options.concurrency) || 6);
			const worker = function() {
				var _ref3 = _asyncToGenerator(function* () {
					while (next < jobs.length) {
						if (token !== _this4._loadToken || _this4._destroyed) return;
						const job = jobs[next++];
						const img = yield job.run();
						if (token !== _this4._loadToken || _this4._destroyed) return;
						job.set(img);
						done++;
						_this4._loaded = done;
						_this4._total = total;
						_this4._setProgress(from + done / total * (to - from), "decode", done, total);
					}
				});
				return function worker() {
					return _ref3.apply(this, arguments);
				};
			}();
			yield Promise.all(Array.from({ length: concurrency }, worker));
		})();
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
	resize() {
		const w = this.container.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0) || 1;
		const h = this.container.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || 1;
		const cap = Number(this.options.dprCap) || 2;
		const dpr = Math.min(typeof window !== "undefined" && window.devicePixelRatio || 1, cap);
		this._dpr = dpr;
		this._viewW = w;
		this._viewH = h;
		const bw = Math.round(w * dpr);
		const bh = Math.round(h * dpr);
		if (this.canvas.width !== bw) this.canvas.width = bw;
		if (this.canvas.height !== bh) this.canvas.height = bh;
		this.ctx.imageSmoothingEnabled = true;
		this.ctx.imageSmoothingQuality = "medium";
		this._layout();
		return this;
	}
	_queueResize() {
		if (this._resizeQueued) return;
		this._resizeQueued = true;
		requestAnimationFrame(() => {
			this._resizeQueued = false;
			this.resize();
		});
	}
	_fillBackdrop() {
		const w = this._viewW, h = this._viewH;
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
		if (this._destroyed) return;
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
		this._raf = requestAnimationFrame(this._loop);
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
		this._idleSince = performance.now();
	}
	_bindEvents() {
		this._onResize = () => this._queueResize();
		window.addEventListener("resize", this._onResize);
		window.addEventListener("orientationchange", this._onResize);
		if (typeof ResizeObserver === "function") {
			this._resizeObserver = new ResizeObserver(this._onResize);
			this._resizeObserver.observe(this.container);
		}
		this._onPointerDown = (e) => this._handlePointerDown(e);
		this._onPointerMove = (e) => this._handlePointerMove(e);
		this._onPointerUp = (e) => this._handlePointerUp(e);
		this._onPointerLeave = () => {
			this._hoverX = null;
			this._hoverY = null;
		};
		this._onDblClick = () => {
			if (this._lastPointerType === "touch") return;
			this._emit("doubletap", {});
		};
		this._onContextMenu = (e) => {
			if (this.options.preventContextMenu) e.preventDefault();
		};
		this.input.addEventListener("pointerdown", this._onPointerDown);
		this.input.addEventListener("pointermove", this._onPointerMove);
		this.input.addEventListener("pointerup", this._onPointerUp);
		this.input.addEventListener("pointercancel", this._onPointerUp);
		this.input.addEventListener("pointerleave", this._onPointerLeave);
		this.input.addEventListener("dblclick", this._onDblClick);
		this.input.addEventListener("contextmenu", this._onContextMenu);
		this._onAbsolute = (e) => this._handleOrientation(e, true);
		this._onRelative = (e) => this._handleOrientation(e, false);
	}
	_handlePointerDown(e) {
		if (e.button !== void 0 && e.button !== 0 && e.pointerType === "mouse") return;
		this._lastPointerType = e.pointerType || "";
		if (this._pendingGyro) {
			this._pendingGyro = false;
			this.enableGyro();
		}
		this._dragging = true;
		this._vel = 0;
		this._hoverX = null;
		this._hoverY = null;
		this._lastPointerX = e.clientX;
		this._lastPointerY = e.clientY;
		this._lastPointerT = e.timeStamp;
		this.dragTarget.classList.add(this.options.dragClass);
		try {
			this.input.setPointerCapture(e.pointerId);
		} catch (_) {}
		this._touchActivity();
		this._emit("dragstart", { pointerType: this._lastPointerType });
		clearTimeout(this._pressTimer);
		this._pressTimer = null;
		this._pressStart = {
			x: e.clientX,
			y: e.clientY
		};
		if (e.pointerType !== "mouse") this._pressTimer = setTimeout(() => {
			this._pressTimer = null;
			this._suppressMove = true;
			this._dragging = false;
			this._vel = 0;
			this.dragTarget.classList.remove(this.options.dragClass);
			this._emit("longpress", {});
		}, 420);
		this._emitState();
	}
	_handlePointerMove(e) {
		var _this$_config$drag$to, _this$_config$drag$de;
		if (this._pressStart && Math.hypot(e.clientX - this._pressStart.x, e.clientY - this._pressStart.y) > 8) {
			clearTimeout(this._pressTimer);
			this._pressTimer = null;
			this._pressStart = null;
		}
		if (this._suppressMove) return;
		if (!this._dragging) {
			if (this._mouseFollow && e.pointerType === "mouse" && e.buttons === 0) {
				if (this._hoverX === null || this._hoverY === null) {
					this._hoverX = e.clientX;
					this._hoverY = e.clientY;
					return;
				}
				const mx = e.clientX - this._hoverX;
				const my = e.clientY - this._hoverY;
				this._hoverX = e.clientX;
				this._hoverY = e.clientY;
				const px = this._axis === "y" ? my : mx;
				if (px) {
					var _this$_config$mouseFo;
					const d = px * ((_this$_config$mouseFo = this._config.mouseFollow.degPerPx) !== null && _this$_config$mouseFo !== void 0 ? _this$_config$mouseFo : .3) * (this._invert ? -1 : 1);
					this._target = this._normAngle(this._target + d);
					if (this._gyro) this._gyroBase = this._normAngle(this._gyroBase + d);
					this._touchActivity();
				}
			}
			return;
		}
		const dx = e.clientX - this._lastPointerX;
		const dy = e.clientY - this._lastPointerY;
		const dt = Math.max(e.timeStamp - this._lastPointerT, 1);
		const px = this._axis === "y" ? dy : dx;
		const touchScale = e.pointerType && e.pointerType !== "mouse" ? (_this$_config$drag$to = this._config.drag.touchScale) !== null && _this$_config$drag$to !== void 0 ? _this$_config$drag$to : 2.5 : 1;
		const deg = px * ((_this$_config$drag$de = this._config.drag.degPerPx) !== null && _this$_config$drag$de !== void 0 ? _this$_config$drag$de : .42) * touchScale * (this._invert ? -1 : 1);
		this._target = this._normAngle(this._target + deg);
		if (this._gyro) this._gyroBase = this._normAngle(this._gyroBase + deg);
		const inst = dt > 90 ? 0 : deg / dt;
		this._vel = .6 * inst + .4 * this._vel;
		this._lastPointerX = e.clientX;
		this._lastPointerY = e.clientY;
		this._lastPointerT = e.timeStamp;
		this._touchActivity();
	}
	_handlePointerUp(e) {
		var _this$input$hasPointe, _this$input;
		clearTimeout(this._pressTimer);
		this._pressTimer = null;
		this._pressStart = null;
		this._hoverX = null;
		this._hoverY = null;
		this.dragTarget.classList.remove(this.options.dragClass);
		if (e && e.pointerId !== void 0 && ((_this$input$hasPointe = (_this$input = this.input).hasPointerCapture) === null || _this$input$hasPointe === void 0 ? void 0 : _this$input$hasPointe.call(_this$input, e.pointerId))) try {
			this.input.releasePointerCapture(e.pointerId);
		} catch (_) {}
		if (this._suppressMove) {
			this._suppressMove = false;
			this._dragging = false;
			this._vel = 0;
			this._emitState();
			return;
		}
		if (!this._dragging) return;
		this._dragging = false;
		if (performance.now() - this._lastPointerT > 90) this._vel = 0;
		this._vel = Math.max(-.55, Math.min(.55, this._vel));
		this._touchActivity();
		this._emit("dragend", { velocity: this._vel });
		this._emitState();
	}
	isGyroSupported() {
		return typeof DeviceOrientationEvent !== "undefined";
	}
	_initAutoGyro() {
		if (!isTouchDevice()) return;
		if (!this.isGyroSupported()) return;
		if (typeof DeviceOrientationEvent.requestPermission === "function") {
			this._pendingGyro = true;
			this._emit("gyrochange", {
				enabled: false,
				pending: true,
				reason: "permission",
				state: this.getState()
			});
			this._emitState();
		} else this.enableGyro();
	}
	enableGyro() {
		var _this5 = this;
		return _asyncToGenerator(function* () {
			if (_this5._gyro) return true;
			try {
				if (!_this5.isGyroSupported()) {
					const err = /* @__PURE__ */ new Error("unsupported");
					err.code = "unsupported";
					throw err;
				}
				if (typeof DeviceOrientationEvent.requestPermission === "function") {
					if ((yield DeviceOrientationEvent.requestPermission()) !== "granted") {
						const err = /* @__PURE__ */ new Error("permission denied");
						err.code = "denied";
						throw err;
					}
				}
				window.addEventListener("deviceorientationabsolute", _this5._onAbsolute, true);
				window.addEventListener("deviceorientation", _this5._onRelative, true);
				_this5._gyro = true;
				_this5._pendingGyro = false;
				_this5._gyroSeen = false;
				_this5._hasAbsolute = false;
				_this5._gyroRef = null;
				_this5._emit("gyrochange", {
					enabled: true,
					pending: false,
					reason: "enabled",
					state: _this5.getState()
				});
				_this5._emitState();
				clearTimeout(_this5._gyroTimer);
				_this5._gyroTimer = setTimeout(() => {
					if (_this5._destroyed || _this5._gyroSeen) return;
					_this5._stopGyro("no-readings");
				}, 2200);
				return true;
			} catch (err) {
				_this5._pendingGyro = false;
				_this5._emit("gyrochange", {
					enabled: false,
					pending: false,
					reason: err.code || "error",
					error: err,
					state: _this5.getState()
				});
				_this5._emitState();
				return false;
			}
		})();
	}
	disableGyro() {
		this._stopGyro("disabled");
		return this;
	}
	_stopGyro(reason) {
		clearTimeout(this._gyroTimer);
		this._gyroTimer = null;
		if (this._gyro) {
			window.removeEventListener("deviceorientationabsolute", this._onAbsolute, true);
			window.removeEventListener("deviceorientation", this._onRelative, true);
		}
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
	_handleOrientation(e, absolute) {
		const heading = this._axis === "y" ? pitchOf(e) : headingOf(e);
		if (heading === null) return;
		if (absolute) this._hasAbsolute = true;
		else if (this._hasAbsolute) return;
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
			const now = performance.now();
			const dt = Math.min(Math.max(now - this._orientT, 1), 120);
			this._orientT = now;
			const tau = (_this$_config$gyro$sm = this._config.gyro.smoothMs) !== null && _this$_config$gyro$sm !== void 0 ? _this$_config$gyro$sm : 80;
			this._target = this._normAngle(this._target + this._angleDelta(this._target, raw) * (1 - Math.exp(-dt / tau)));
		} else this._target = raw;
		this._touchActivity();
	}
	destroy() {
		var _this$_resizeObserver;
		if (this._destroyed) return;
		this._destroyed = true;
		this._loadToken++;
		cancelAnimationFrame(this._raf);
		this._stopGyro("destroyed");
		clearTimeout(this._pressTimer);
		this._pressTimer = null;
		(_this$_resizeObserver = this._resizeObserver) === null || _this$_resizeObserver === void 0 || _this$_resizeObserver.disconnect();
		window.removeEventListener("resize", this._onResize);
		window.removeEventListener("orientationchange", this._onResize);
		this.input.removeEventListener("pointerdown", this._onPointerDown);
		this.input.removeEventListener("pointermove", this._onPointerMove);
		this.input.removeEventListener("pointerup", this._onPointerUp);
		this.input.removeEventListener("pointercancel", this._onPointerUp);
		this.input.removeEventListener("pointerleave", this._onPointerLeave);
		this.input.removeEventListener("dblclick", this._onDblClick);
		this.input.removeEventListener("contextmenu", this._onContextMenu);
		this._layers = [];
		this._frames = [];
		this._meta = null;
		this._ready = false;
		this._loading = false;
		this._emit("destroy", {});
		this._events.clear();
	}
};
function createClient(canvas, options) {
	return new Orbit360Client(canvas, options);
}
//#endregion
export { Orbit360Client as Client, Orbit360Client, Orbit360Client as default, DEFAULTS, VERSION, createClient };
