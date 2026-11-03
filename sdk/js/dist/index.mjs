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
	VERSION
};
//#endregion
export { ENTRY_SIZE, FORMAT, HEADER_SIZE, MAGIC, VERSION, VERSION_MAJOR, VERSION_MINOR, OrbBundle as default, fromBlob, parse };
