/* orb.js — ORB3 场景包解析（浏览器 / Node，无依赖）
 *
 *   var orb = await OrbBundle.fromBlob(file);   // File / Blob
 *   orb.meta                                    // JSON meta
 *   orb.frameBlob(videoIndex, frameIndex)       // 该帧的 Blob（按 offset/length 切片）
 *   orb.frameEntry(videoIndex, frameIndex)      // { video, length, offset }
 *
 * 也支持整文件 ArrayBuffer：
 *   var orb = OrbBundle.parse(arrayBuffer);
 *
 * 头部 32B：magic "ORB3" / version / prefixLen / metaLen / indexLen /
 *           frameCount / indexEntrySize / flags（全部小端）
 * Index 每帧 16B：<IIQ> videoIndex, length, absoluteOffset
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbBundle = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAGIC = [0x4f, 0x52, 0x42, 0x33];   // "ORB3"
  var HEADER_SIZE = 32;
  var ENTRY_SIZE = 16;
  var FORMAT = 'orbit360.bundle';
  var VERSION = 1;

  function fail(msg) { throw new Error('ORB3: ' + msg); }

  function isInt(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
  }

  function readBlob(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error('读取失败')); };
      fr.readAsArrayBuffer(blob);
    });
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  function parseHeader(buffer) {
    if (buffer.byteLength < HEADER_SIZE) fail('头部不足 32 字节');
    var dv = new DataView(buffer);
    for (var i = 0; i < 4; i++) {
      if (dv.getUint8(i) !== MAGIC[i]) fail('magic 不是 ORB3');
    }
    var h = {
      version: dv.getUint32(4, true),
      prefixLen: dv.getUint32(8, true),
      metaLen: dv.getUint32(12, true),
      indexLen: dv.getUint32(16, true),
      frameCount: dv.getUint32(20, true),
      indexEntrySize: dv.getUint32(24, true),
      flags: dv.getUint32(28, true),
    };
    if (h.version !== VERSION) fail('不支持的版本 ' + h.version);
    if (h.indexEntrySize !== ENTRY_SIZE) fail('不支持的索引项大小 ' + h.indexEntrySize);
    if (h.indexLen !== h.frameCount * ENTRY_SIZE) fail('indexLen 与 frameCount 不一致');
    if (h.prefixLen !== HEADER_SIZE + h.metaLen + h.indexLen) fail('prefixLen 不一致');
    if (h.frameCount <= 0) fail('frameCount 为 0');
    return h;
  }

  function parsePrefix(buffer, h, fileSize, strictEnd) {
    if (buffer.byteLength < h.prefixLen) fail('Header/Meta/Index 不完整');
    var dv = new DataView(buffer, 0, h.prefixLen);

    var meta;
    try {
      meta = JSON.parse(decodeUtf8(new Uint8Array(buffer, HEADER_SIZE, h.metaLen)));
    } catch (err) {
      fail('meta 不是合法 JSON: ' + err.message);
    }
    if (!meta || meta.format !== FORMAT) fail('meta.format 不是 ' + FORMAT);
    var canvas = meta.canvas || {};
    if (!isInt(canvas.width) || !isInt(canvas.height) || canvas.width <= 0 || canvas.height <= 0) {
      fail('meta 缺少合法的 canvas.width/height');
    }
    if (meta.totalFrames !== h.frameCount) fail('meta.totalFrames 与头部不一致');
    if (typeof meta.codec !== 'string' || !meta.codec) fail('meta 缺少 codec');
    if (!Array.isArray(meta.videos) || !meta.videos.length) fail('meta 缺少 videos 数组');

    var sum = 0;
    var expectStart = 0;
    var vi;
    for (vi = 0; vi < meta.videos.length; vi++) {
      var v = meta.videos[vi];
      var f = v && v.frames;
      var r = v && v.rect;
      if (!v || !f || !r) fail('视频 ' + vi + ' 缺少 rect/frames');
      if (!isInt(f.count) || f.count <= 0) fail('视频 ' + vi + ' 的 frames.count 非法');
      if (f.indexStart !== expectStart) fail('视频 ' + vi + ' 的 indexStart 不连续');
      if (!isInt(r.x) || !isInt(r.y) || !isInt(r.width) || !isInt(r.height)) {
        fail('视频 ' + vi + ' 的 rect 不是整数');
      }
      if (r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 ||
          r.x + r.width > canvas.width || r.y + r.height > canvas.height) {
        fail('视频 ' + vi + ' 的 rect 越界');
      }
      expectStart += f.count;
      sum += f.count;
    }
    if (sum !== h.frameCount) fail('videos 帧数之和与 frameCount 不一致');

    var entries = new Array(h.frameCount);
    var expectedOff = h.prefixLen;
    var e = 0;
    for (vi = 0; vi < meta.videos.length; vi++) {
      var count = meta.videos[vi].frames.count;
      for (var k = 0; k < count; k++) {
        var base = HEADER_SIZE + h.metaLen + e * ENTRY_SIZE;
        var ev = dv.getUint32(base, true);
        var len = dv.getUint32(base + 4, true);
        var lo = dv.getUint32(base + 8, true);
        var hi = dv.getUint32(base + 12, true);
        var off = hi * 4294967296 + lo;
        if (ev !== vi) fail('第 ' + e + ' 条索引的 video 编号不对');
        if (!len || off !== expectedOff) fail('第 ' + e + ' 条索引偏移不连续');
        if (fileSize != null && off + len > fileSize) fail('第 ' + e + ' 条索引越界');
        entries[e] = [ev, len, off];
        expectedOff += len;
        e++;
      }
    }
    if (fileSize != null && strictEnd && expectedOff !== fileSize) {
      fail('索引与文件长度不一致（可能被截断）');
    }
    return { meta: meta, entries: entries };
  }

  function makeResult(h, meta, entries, size, blob) {
    function frameEntry(vi, fi) {
      var v = meta.videos[vi];
      if (!v) fail('没有视频 ' + vi);
      if (!isInt(fi) || fi < 0 || fi >= v.frames.count) fail('视频 ' + vi + ' 没有第 ' + fi + ' 帧');
      var e = entries[v.frames.indexStart + fi];
      return { video: e[0], length: e[1], offset: e[2] };
    }
    function frameBlob(vi, fi) {
      if (!blob) fail('parse() 的结果没有 Blob，请用 fromBlob()');
      var e = frameEntry(vi, fi);
      return blob.slice(e.offset, e.offset + e.length);
    }
    return {
      header: h,
      meta: meta,
      entries: entries,
      prefixLen: h.prefixLen,
      size: size,
      blob: blob,
      frameEntry: frameEntry,
      frameBlob: frameBlob,
    };
  }

  function parse(buffer) {
    if (!buffer || typeof buffer.byteLength !== 'number') fail('需要 ArrayBuffer');
    var h = parseHeader(buffer);
    if (buffer.byteLength < h.prefixLen) fail('Header/Meta/Index 不完整');
    var whole = buffer.byteLength > h.prefixLen;
    var parts = parsePrefix(buffer, h, whole ? buffer.byteLength : null, whole);
    return makeResult(h, parts.meta, parts.entries, buffer.byteLength, null);
  }

  function fromBlob(blob) {
    if (!blob || typeof blob.slice !== 'function') fail('需要 Blob / File');
    return readBlob(blob.slice(0, HEADER_SIZE)).then(function (headBuf) {
      var h = parseHeader(headBuf);
      if (h.prefixLen > blob.size) fail('文件被截断（prefixLen 超出文件）');
      return readBlob(blob.slice(0, h.prefixLen)).then(function (prefixBuf) {
        var parts = parsePrefix(prefixBuf, h, blob.size, true);
        return makeResult(h, parts.meta, parts.entries, blob.size, blob);
      });
    });
  }

  return {
    parse: parse,
    fromBlob: fromBlob,
    HEADER_SIZE: HEADER_SIZE,
    ENTRY_SIZE: ENTRY_SIZE,
    VERSION: VERSION,
  };
}));
