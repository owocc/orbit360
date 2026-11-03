/* Orbit360 web client — 渲染核心（不含 DOM UI）
 *
 * 浏览器侧 Canvas 渲染器：加载 .orb / 旧版 zip、帧切换、拖拽、惯性、自动环绕、
 * 鼠标跟随、陀螺仪、自适应/铺满布局。所有控制项通过 API 配置，状态通过 API / 事件读取。
 */

import OrbBundle from '../orb.js';

const VERSION = '0.1.0';
const RAD = Math.PI / 180;
const HEADER_SIZE = 32;
const CONFIG_KEYS = [
  'title', 'video', 'orbit', 'drag', 'motion', 'auto', 'gyro',
  'mouseFollow', 'defaults', 'quality',
];

const DEFAULTS = {
  title: '',
  video: {
    displayScale: 1,
    portraitScale: 1.25,
    fit: 'contain',
    width: 1280,
    height: 720,
  },
  orbit: {
    spanDeg: 360,
    direction: 'cw',
  },
  drag: {
    degPerPx: 0.42,
    invert: false,
    inertia: true,
    inertiaMs: 110,
  },
  motion: {
    smoothMs: 62,
  },
  auto: {
    enabled: false,
    dir: 'cw',
    degPerSec: 14,
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
  mouseFollow: {
    enabled: true,
    degPerPx: 0.3,
  },
};

const mod = (a, n) => ((a % n) + n) % n;
const shortDelta = (from, to) => mod(to - from + 180, 360) - 180;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, ...sources) {
  const out = isPlainObject(base) ? { ...base } : {};
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
  for (const key of CONFIG_KEYS) {
    if (meta && meta[key] !== undefined) out[key] = meta[key];
  }
  return out;
}

function blobToBuffer(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('读取失败'));
    fr.readAsArrayBuffer(blob);
  });
}

function blobToText(blob) {
  if (blob.text) return blob.text();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('读取失败'));
    fr.readAsText(blob, 'utf-8');
  });
}

// 只实现 STORED 与 DEFLATE：STORED 直接切片，DEFLATE 交给浏览器原生解压。
async function readZipEntries(blob) {
  const buf = new Uint8Array(await blobToBuffer(blob));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  const stop = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip 文件');

  const total = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries = new Map();

  for (let i = 0; i < total; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('zip 中央目录损坏');
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
    entries.set(name, { method, data: buf.subarray(dataStart, dataStart + compSize) });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function zipFileBlob(entries, name) {
  const e = entries.get(name);
  if (!e) return null;
  if (e.method === 0) return new Blob([e.data], { type: 'application/octet-stream' });
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([e.data]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).blob();
  }
  throw new Error(`${name} 使用了 deflate 压缩，当前浏览器无法解压`);
}

function loadImageBlob(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function isTouchDevice() {
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function screenAngle() {
  const so = typeof screen !== 'undefined' ? screen.orientation : null;
  if (so && typeof so.angle === 'number') return mod(so.angle, 360);
  return typeof window !== 'undefined' && typeof window.orientation === 'number'
    ? mod(window.orientation, 360) : 0;
}

// 由设备姿态解出水平方位角（yaw）：与握持倾斜、横竖屏都无关。
function headingOf(e) {
  if (typeof e.webkitCompassHeading === 'number'
      && !Number.isNaN(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) {
    return e.webkitCompassHeading;
  }
  const a = e.alpha, b = e.beta, g = e.gamma;
  if (typeof a !== 'number') return null;
  if (typeof b !== 'number' || typeof g !== 'number') return mod(360 - a, 360);

  const A = a * RAD, B = b * RAD, G = g * RAD;
  const vx = Math.sin(G) * Math.cos(A) + Math.cos(G) * Math.sin(B) * Math.sin(A);
  const vy = Math.sin(G) * Math.sin(A) - Math.cos(G) * Math.sin(B) * Math.cos(A);
  const horizontal = Math.hypot(vx, vy);

  if (horizontal < 0.25) {
    const sa = screenAngle();
    return (sa === 90 || sa === 270) ? mod(a, 360) : mod(360 - a, 360);
  }
  return mod(Math.atan2(-vx, -vy) / RAD, 360);
}

export class Orbit360Client {
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
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('Orbit360Client: 需要 canvas 元素');
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Orbit360Client: 无法获取 2D context');

    this.options = {
      dprCap: 2,
      autoStartGyro: false,
      concurrency: 6,
      dragClass: 'dragging',
      preventContextMenu: true,
      ...options,
    };
    this.container = options.container || canvas.parentElement || canvas;
    this.input = options.input || this.container;
    this.dragTarget = options.dragClassTarget || this.input;

    this._events = new Map();
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
    this._lastPointerT = 0;
    this._lastPointerType = '';
    this._hoverX = null;
    this._idleSince = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._autoWeight = 0;
    this._orientT = 0;
    this._invert = false;
    this._mouseFollow = true;
    this._inertia = true;
    this._fitMode = 'contain';
    this._autoState = 'off';
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
    this._dst = { x: 0, y: 0, w: 0, h: 0 };
    this._drawnIndex = -1;
    this._lastT = 0;

    this._loading = false;
    this._ready = false;
    this._destroyed = false;
    this._loadToken = 0;
    this._progress = 0;
    this._loaded = 0;
    this._total = 0;
    this._phase = 'idle';

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

  /* ---------- 事件 ---------- */

  on(type, handler) {
    if (typeof handler !== 'function') throw new Error('Orbit360Client: handler 必须是函数');
    let list = this._events.get(type);
    if (!list) { list = []; this._events.set(type, list); }
    list.push(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, payload => {
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
    for (const handler of list.slice()) {
      try { handler(payload); } catch (err) { console.error(err); }
    }
  }

  _emitState() {
    this._emit('state', this.getState());
  }

  _emitAngle() {
    this._emit('angle', {
      angle: this._angle,
      target: this._target,
      frameIndex: this._frameIndex(),
    });
  }

  _emitFrame(index) {
    this._emit('frame', {
      index,
      count: this._count,
      frameDeg: this._frameDeg,
    });
  }

  /* ---------- 配置 / 状态 ---------- */

  _resolveConfig() {
    const scene = deepMerge({}, this._sceneConfig);
    if (scene.defaults && scene.defaults.auto) {
      scene.auto = deepMerge({}, scene.auto, scene.defaults.auto);
    }
    return deepMerge({}, DEFAULTS, scene, this._userConfig);
  }

  _applyConfig() {
    const cfg = this._config;
    this._invert = !!cfg.drag.invert;
    this._gyroGain = Number(cfg.gyro.gain);
    this._gyroSmooth = cfg.gyro.smooth !== false;
    this._inertia = cfg.drag.inertia !== false;
    this._mouseFollow = cfg.mouseFollow.enabled !== false;
    this._fitMode = cfg.video.fit === 'cover' ? 'cover' : 'contain';

    this._autoState = cfg.auto.enabled ? (cfg.auto.dir === 'ccw' ? 'ccw' : 'cw') : 'off';
    this._autoDir = this._autoState === 'ccw' ? -1 : 1;
    const speed = Number(cfg.auto.degPerSec);
    this._autoSpeed = Number.isFinite(speed) ? speed : DEFAULTS.auto.degPerSec;

    this._recalcFrames();
  }

  _recalcFrames() {
    this._degPerFrame = 360 / Math.max(1, this._count);
    const span = Number(this._config.orbit.spanDeg);
    this._frameDeg = (Number.isFinite(span) ? span : 360) / Math.max(1, this._count);
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
      title: this._config.title || '环绕视角',
      angle: mod(this._angle, 360),
      target: mod(this._target, 360),
      velocity: this._vel,
      frameIndex,
      frameCount: this._count,
      frameDeg: this._frameDeg,
      degPerFrame: this._degPerFrame,
      dragging: this._dragging,
      missingFrames: this._countMissingFrames(),
      auto: {
        state: this._autoState,
        enabled: this._autoState !== 'off',
        direction: this._autoState === 'off' ? (this._config.auto.dir || 'cw') : this._autoState,
        speed: this._autoSpeed,
        weight: this._autoWeight,
        idleDelayMs: this._config.auto.idleDelayMs,
        rampInMs: this._config.auto.rampInMs,
        rampOutMs: this._config.auto.rampOutMs,
      },
      gyro: {
        enabled: this._gyro,
        pending: this._pendingGyro,
        seen: this._gyroSeen,
        absolute: this._hasAbsolute,
        supported: typeof DeviceOrientationEvent !== 'undefined',
        gain: this._gyroGain,
        invert: !!this._config.gyro.invert,
        smooth: this._gyroSmooth,
        smoothMs: this._config.gyro.smoothMs,
      },
      inertia: this._inertia,
      invert: this._invert,
      fit: this._fitMode,
      mouseFollow: {
        enabled: this._mouseFollow,
        degPerPx: this._config.mouseFollow.degPerPx,
      },
      progress: {
        progress: this._progress,
        loaded: this._loaded,
        total: this._total,
        phase: this._phase,
      },
      viewport: {
        width: this._viewW,
        height: this._viewH,
        dpr: this._dpr,
      },
      canvas: {
        width: this._canvasW,
        height: this._canvasH,
        frameWidth: this._frameW,
        frameHeight: this._frameH,
      },
      config: this.getConfig(),
      meta: this.getMeta(),
    };
  }

  getAngle() {
    return mod(this._angle, 360);
  }

  getTargetAngle() {
    return mod(this._target, 360);
  }

  getFrameIndex() {
    return this._frameIndex();
  }

  getFrameCount() {
    return this._count;
  }

  setAngle(deg, options = {}) {
    const value = Number(deg);
    if (!Number.isFinite(value)) throw new Error('setAngle: deg 必须是数字');
    this._target = mod(value, 360);
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
    if (!Number.isFinite(value)) throw new Error('rotateBy: deg 必须是数字');
    this._target = mod(this._target + value, 360);
    this._touchActivity();
    this._emitState();
    return this;
  }

  reset(angle = 0, options = {}) {
    this._target = mod(Number(angle) || 0, 360);
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

    if (typeof value === 'string') {
      if (value === 'off' || value === 'false') enabled = false;
      else if (value === 'on' || value === 'true') enabled = true;
      else if (value === 'cw' || value === 'ccw') { enabled = true; dir = value; }
      else throw new Error('setAutoRotate: 期望 off / on / cw / ccw');
    } else if (value && typeof value === 'object') {
      enabled = !!value.enabled;
      if (value.dir) dir = value.dir;
    }

    const auto = { enabled };
    if (dir) {
      if (dir !== 'cw' && dir !== 'ccw') throw new Error('setAutoRotate: dir 必须是 cw / ccw');
      auto.dir = dir;
    }
    this.setConfig({ auto });
    this._touchActivity();
    return this._autoState;
  }

  cycleAuto() {
    const next = this._autoState === 'off' ? 'cw'
      : (this._autoState === 'cw' ? 'ccw' : 'off');
    this.setAutoRotate(next);
    return next;
  }

  setAutoSpeed(degPerSec) {
    const value = Number(degPerSec);
    if (!Number.isFinite(value)) throw new Error('setAutoSpeed: 需要数字');
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
    if (mode !== 'contain' && mode !== 'cover') throw new Error('setFit: 期望 contain / cover');
    return this.setVideoConfig({ fit: mode });
  }

  setMouseFollow(value) {
    if (typeof value === 'boolean') return this.setConfig({ mouseFollow: { enabled: value } });
    return this.setConfig({ mouseFollow: value || {} });
  }

  /* ---------- 加载 ---------- */

  async load(source, options = {}) {
    const token = ++this._loadToken;
    this._loading = true;
    this._ready = false;
    this._phase = 'load';
    this._loaded = 0;
    this._total = 0;
    this._setProgress(0, 'load', 0, 0);
    this._emit('loadstart', { source });
    this._emitState();

    try {
      let blob;
      if (typeof source === 'string') {
        this._setProgress(0.03, 'fetch', 0, 0);
        const res = await fetch(source, { cache: options.cache || 'default' });
        if (!res.ok) throw new Error(`包下载失败（HTTP ${res.status}）`);
        this._setProgress(0.12, 'fetch', 0, 0);
        blob = await res.blob();
        this._setProgress(0.38, 'fetch', 0, 0);
      } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
        blob = source;
        this._setProgress(0.38, 'read', 0, 0);
      } else if (source instanceof ArrayBuffer) {
        blob = new Blob([source]);
        this._setProgress(0.38, 'read', 0, 0);
      } else if (ArrayBuffer.isView(source)) {
        blob = new Blob([source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)]);
        this._setProgress(0.38, 'read', 0, 0);
      } else {
        throw new Error('load: 需要 URL / Blob / File / ArrayBuffer');
      }

      if (token !== this._loadToken || this._destroyed) return this;
      const head = blob.size >= 4 ? new Uint8Array(await blobToBuffer(blob.slice(0, 4))) : null;
      const isOrb = head && head[0] === 0x4f && head[1] === 0x52 && head[2] === 0x42 && head[3] === 0x33;
      if (isOrb) await this._loadOrb(blob, token, options);
      else await this._loadZip(blob, token, options);

      if (token !== this._loadToken || this._destroyed) return this;
      this._loading = false;
      this._ready = true;
      this._phase = 'ready';
      this._loaded = this._total;
      this._setProgress(1, 'ready', this._loaded, this._total);
      this.resize();
      this._emitAngle();
      this._emitFrame(this._frameIndex());
      this._emit('ready', {
        meta: this.getMeta(),
        config: this.getConfig(),
        state: this.getState(),
      });
      this._emitState();
      return this;
    } catch (err) {
      if (token === this._loadToken && !this._destroyed) {
        this._loading = false;
        this._ready = false;
        this._phase = 'error';
        this._emit('error', err);
        this._emitState();
      }
      throw err;
    }
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

  async _loadOrb(blob, token, options) {
    if (typeof OrbBundle === 'undefined' || typeof OrbBundle.fromBlob !== 'function') {
      throw new Error('缺少 ORB3 解析器');
    }
    const orb = await OrbBundle.fromBlob(blob);
    if (token !== this._loadToken) return;

    const meta = orb.meta;
    const layers = [];
    const jobs = [];
    meta.videos.forEach((video, vi) => {
      const frames = new Array(video.frames.count);
      layers.push({ rect: video.rect, frames, count: video.frames.count });
      for (let fi = 0; fi < video.frames.count; fi++) {
        jobs.push({
          run: async () => {
            const frame = orb.frameBlob(vi, fi);
            return frame ? loadImageBlob(frame) : null;
          },
          set: img => {
            frames[fi] = img
              ? { img, sx: 0, sy: 0, sw: video.frames.width, sh: video.frames.height }
              : null;
          },
        });
      }
    });

    this._total = jobs.length;
    this._loaded = 0;
    await this._decodeJobs(jobs, token, 0.4, 0.98);
    if (token !== this._loadToken) return;

    this._meta = meta;
    this._sceneConfig = sceneConfigFrom(meta);
    this._format = 'orb';
    this._quality = options.quality || null;
    this._codec = meta.codec || null;
    this._canvasW = meta.canvas.width;
    this._canvasH = meta.canvas.height;
    this._frameW = this._canvasW;
    this._frameH = this._canvasH;
    this._count = Math.max.apply(null, meta.videos.map(v => v.frames.count));
    this._layers = layers;
    this._frames = [];
    this._angle = this._target = mod(Number(meta.initialAngle) || 0, 360);
    this._config = this._resolveConfig();
    this._applyConfig();
  }

  async _loadZip(blob, token, options) {
    const entries = await readZipEntries(blob);
    if (token !== this._loadToken) return;
    const metaBlob = await zipFileBlob(entries, 'meta.json');
    if (!metaBlob) throw new Error('包里缺少 meta.json');
    const meta = JSON.parse(await blobToText(metaBlob));
    const pack = meta.pack;
    if (!pack || !Array.isArray(pack.files) || !pack.files.length) {
      throw new Error('meta 缺少 pack.files');
    }

    const imgs = new Map();
    const jobs = pack.files.map(name => ({
      run: async () => {
        const file = await zipFileBlob(entries, name);
        return file ? loadImageBlob(file) : null;
      },
      set: img => imgs.set(name, img),
    }));
    this._total = jobs.length;
    this._loaded = 0;
    await this._decodeJobs(jobs, token, 0.4, 0.98);
    if (token !== this._loadToken) return;

    const count = pack.count || pack.files.length;
    let frames;
    if (pack.type === 'atlas') {
      const per = pack.cols * pack.rows;
      frames = Array.from({ length: count }, (_, i) => {
        const img = imgs.get(pack.files[Math.floor(i / per)]);
        if (!img) return null;
        const k = i % per;
        return {
          img,
          sx: (k % pack.cols) * pack.frameW,
          sy: Math.floor(k / pack.cols) * pack.frameH,
          sw: pack.frameW,
          sh: pack.frameH,
        };
      });
    } else {
      frames = Array.from({ length: count }, (_, i) => {
        const img = imgs.get(pack.files[i]);
        return img ? { img, sx: 0, sy: 0, sw: pack.frameW, sh: pack.frameH } : null;
      });
    }

    this._meta = meta;
    this._sceneConfig = sceneConfigFrom(meta);
    this._format = 'zip';
    this._quality = options.quality || meta.quality || 'std';
    this._codec = meta.codec || null;
    this._canvasW = pack.frameW;
    this._canvasH = pack.frameH;
    this._frameW = pack.frameW;
    this._frameH = pack.frameH;
    this._count = count;
    this._frames = frames;
    this._layers = [{
      rect: { x: 0, y: 0, width: pack.frameW, height: pack.frameH },
      frames,
      count,
    }];
    this._angle = this._target = mod(Number(meta.initialAngle) || 0, 360);
    this._config = this._resolveConfig();
    this._applyConfig();
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
        this._setProgress(from + (done / total) * (to - from), 'decode', done, total);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  _setProgress(progress, phase, loaded, total) {
    this._progress = Math.max(0, Math.min(1, Number(progress) || 0));
    this._phase = phase;
    this._loaded = loaded;
    this._total = total;
    this._emit('progress', {
      progress: this._progress,
      phase,
      loaded,
      total,
    });
  }

  _countMissingFrames() {
    let missing = 0;
    for (const layer of this._layers) {
      for (const frame of layer.frames) {
        if (!frame || !frame.img) missing++;
      }
    }
    return missing;
  }

  /* ---------- 画布 / 渲染 ---------- */

  resize() {
    const w = this.container.clientWidth
      || (typeof window !== 'undefined' ? window.innerWidth : 0) || 1;
    const h = this.container.clientHeight
      || (typeof window !== 'undefined' ? window.innerHeight : 0) || 1;
    const cap = Number(this.options.dprCap) || 2;
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, cap);
    this._dpr = dpr;
    this._viewW = w;
    this._viewH = h;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'medium';
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
    const g = this.ctx.createRadialGradient(
      w * 0.5, h * 0.42, 0,
      w * 0.5, h * 0.42, Math.max(w, h) * 0.78,
    );
    g.addColorStop(0, '#1b1f27');
    g.addColorStop(0.62, '#0a0b0e');
    g.addColorStop(1, '#050608');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, w, h);
  }

  _layout() {
    if (!this._viewW || !this._viewH) return;
    const cfg = this._config;
    const vw = this._canvasW || this._frameW || cfg.video.width || 1280;
    const vh = this._canvasH || this._frameH || cfg.video.height || 720;
    const cover = this._fitMode === 'cover';
    const base = cover
      ? Math.max(this._viewW / vw, this._viewH / vh)
      : Math.min(this._viewW / vw, this._viewH / vh)
        * (this._viewH > this._viewW ? (cfg.video.portraitScale ?? 1.25) : 1);
    const scale = base * (cover ? 1 : (cfg.video.displayScale || 1));
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
    return mod(Math.round(mod(this._angle * this._dirSign(), 360) / this._degPerFrame), this._count);
  }

  _dirSign() {
    return this._config.orbit.direction === 'ccw' ? -1 : 1;
  }

  _layerFrame(layer, index) {
    if (!layer.count) return null;
    const i = layer.count === this._count ? index
      : mod(Math.floor(index * layer.count / this._count), layer.count);
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
      this.ctx.drawImage(
        frame.img, frame.sx, frame.sy, frame.sw, frame.sh,
        this._dst.x + r.x * sx, this._dst.y + r.y * sy, r.width * sx, r.height * sy,
      );
    }
    this._emitFrame(index);
  }

  /* ---------- 主循环 ---------- */

  _loop(t) {
    if (this._destroyed) return;
    const dt = Math.min(t - (this._lastT || t), 64);
    this._lastT = t;

    if (!this._dragging) {
      if (this._inertia && !this._gyro && Math.abs(this._vel) > 0.0005) {
        this._target += this._vel * dt;
        this._vel *= Math.exp(-dt / (this._config.drag.inertiaMs ?? 110));
        this._touchActivity();
      } else {
        this._vel = 0;
      }
    }
    this._updateAuto(dt, t);

    const prev = this._angle;
    const delta = shortDelta(this._angle, this._target);
    const tau = this._config.motion.smoothMs ?? 62;
    this._angle = mod(this._angle + delta * (1 - Math.exp(-dt / tau)), 360);
    if (Math.abs(shortDelta(this._angle, this._target)) < 0.0005) {
      this._angle = mod(this._target, 360);
    }
    this._target = mod(this._target, 360);

    this._paint();
    if (this._angle !== prev) this._emitAngle();
    this._raf = requestAnimationFrame(this._loop);
  }

  _updateAuto(dt, t) {
    const idle = t - this._idleSince;
    const want = (this._autoState !== 'off' && !this._gyro && !this._dragging
      && idle > (this._config.auto.idleDelayMs ?? 2200)) ? 1 : 0;
    const tau = want
      ? (this._config.auto.rampInMs ?? 700)
      : (this._dragging ? 120 : (this._config.auto.rampOutMs ?? 280));

    this._autoWeight += (want - this._autoWeight) * (1 - Math.exp(-dt / tau));
    if (want === 0 && this._autoWeight < 0.004) { this._autoWeight = 0; return; }
    if (this._autoWeight <= 0) return;
    this._target += this._autoDir * this._autoSpeed * this._autoWeight * dt / 1000;
  }

  /* ---------- 指针 / 手势 ---------- */

  _touchActivity() {
    this._idleSince = performance.now();
  }

  _bindEvents() {
    this._onResize = () => this._queueResize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.container);
    }

    this._onPointerDown = e => this._handlePointerDown(e);
    this._onPointerMove = e => this._handlePointerMove(e);
    this._onPointerUp = e => this._handlePointerUp(e);
    this._onPointerLeave = () => { this._hoverX = null; };
    this._onDblClick = () => {
      if (this._lastPointerType === 'touch') return;
      this._emit('doubletap', {});
    };
    this._onContextMenu = e => {
      if (this.options.preventContextMenu) e.preventDefault();
    };

    this.input.addEventListener('pointerdown', this._onPointerDown);
    this.input.addEventListener('pointermove', this._onPointerMove);
    this.input.addEventListener('pointerup', this._onPointerUp);
    this.input.addEventListener('pointercancel', this._onPointerUp);
    this.input.addEventListener('pointerleave', this._onPointerLeave);
    this.input.addEventListener('dblclick', this._onDblClick);
    this.input.addEventListener('contextmenu', this._onContextMenu);

    this._onAbsolute = e => this._handleOrientation(e, true);
    this._onRelative = e => this._handleOrientation(e, false);
  }

  _handlePointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    this._lastPointerType = e.pointerType || '';
    if (this._pendingGyro) {
      this._pendingGyro = false;
      this.enableGyro();
    }
    this._dragging = true;
    this._vel = 0;
    this._hoverX = null;
    this._lastPointerX = e.clientX;
    this._lastPointerT = e.timeStamp;
    this.dragTarget.classList.add(this.options.dragClass);
    try { this.input.setPointerCapture(e.pointerId); } catch (_) { /* 合成事件无活动指针 */ }
    this._touchActivity();
    this._emit('dragstart', { pointerType: this._lastPointerType });

    clearTimeout(this._pressTimer);
    this._pressTimer = null;
    this._pressStart = { x: e.clientX, y: e.clientY };
    if (e.pointerType !== 'mouse') {
      this._pressTimer = setTimeout(() => {
        this._pressTimer = null;
        this._suppressMove = true;
        this._dragging = false;
        this._vel = 0;
        this.dragTarget.classList.remove(this.options.dragClass);
        this._emit('longpress', {});
      }, 420);
    }
    this._emitState();
  }

  _handlePointerMove(e) {
    if (this._pressStart && Math.hypot(e.clientX - this._pressStart.x, e.clientY - this._pressStart.y) > 8) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
      this._pressStart = null;
    }
    if (this._suppressMove) return;

    if (!this._dragging) {
      if (this._mouseFollow && e.pointerType === 'mouse' && e.buttons === 0) {
        if (this._hoverX === null) { this._hoverX = e.clientX; return; }
        const mx = e.clientX - this._hoverX;
        this._hoverX = e.clientX;
        if (mx) {
          const d = mx * (this._config.mouseFollow.degPerPx ?? 0.3) * (this._invert ? -1 : 1);
          this._target += d;
          if (this._gyro) this._gyroBase = mod(this._gyroBase + d, 360);
          this._touchActivity();
        }
      }
      return;
    }

    const dx = e.clientX - this._lastPointerX;
    const dt = Math.max(e.timeStamp - this._lastPointerT, 1);
    const deg = dx * (this._config.drag.degPerPx ?? 0.42) * (this._invert ? -1 : 1);
    this._target += deg;
    if (this._gyro) this._gyroBase = mod(this._gyroBase + deg, 360);
    const inst = dt > 90 ? 0 : deg / dt;
    this._vel = 0.6 * inst + 0.4 * this._vel;
    this._lastPointerX = e.clientX;
    this._lastPointerT = e.timeStamp;
    this._touchActivity();
  }

  _handlePointerUp(e) {
    clearTimeout(this._pressTimer);
    this._pressTimer = null;
    this._pressStart = null;
    this._hoverX = null;
    this.dragTarget.classList.remove(this.options.dragClass);
    if (e && e.pointerId !== undefined && this.input.hasPointerCapture?.(e.pointerId)) {
      try { this.input.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
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
    this._vel = Math.max(-0.55, Math.min(0.55, this._vel));
    this._touchActivity();
    this._emit('dragend', { velocity: this._vel });
    this._emitState();
  }

  /* ---------- 陀螺仪 ---------- */

  isGyroSupported() {
    return typeof DeviceOrientationEvent !== 'undefined';
  }

  _initAutoGyro() {
    if (!isTouchDevice()) return;
    if (!this.isGyroSupported()) return;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      this._pendingGyro = true;
      this._emit('gyrochange', {
        enabled: false,
        pending: true,
        reason: 'permission',
        state: this.getState(),
      });
      this._emitState();
    } else {
      this.enableGyro();
    }
  }

  async enableGyro() {
    if (this._gyro) return true;
    try {
      if (!this.isGyroSupported()) {
        const err = new Error('unsupported');
        err.code = 'unsupported';
        throw err;
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          const err = new Error('permission denied');
          err.code = 'denied';
          throw err;
        }
      }
      window.addEventListener('deviceorientationabsolute', this._onAbsolute, true);
      window.addEventListener('deviceorientation', this._onRelative, true);
      this._gyro = true;
      this._pendingGyro = false;
      this._gyroSeen = false;
      this._hasAbsolute = false;
      this._gyroRef = null;
      this._emit('gyrochange', { enabled: true, pending: false, reason: 'enabled', state: this.getState() });
      this._emitState();

      clearTimeout(this._gyroTimer);
      this._gyroTimer = setTimeout(() => {
        if (this._destroyed || this._gyroSeen) return;
        this._stopGyro('no-readings');
      }, 2200);
      return true;
    } catch (err) {
      this._pendingGyro = false;
      this._emit('gyrochange', {
        enabled: false,
        pending: false,
        reason: err.code || 'error',
        error: err,
        state: this.getState(),
      });
      this._emitState();
      return false;
    }
  }

  disableGyro() {
    this._stopGyro('disabled');
    return this;
  }

  _stopGyro(reason) {
    clearTimeout(this._gyroTimer);
    this._gyroTimer = null;
    if (this._gyro) {
      window.removeEventListener('deviceorientationabsolute', this._onAbsolute, true);
      window.removeEventListener('deviceorientation', this._onRelative, true);
    }
    const wasEnabled = this._gyro;
    this._gyro = false;
    this._pendingGyro = false;
    this._gyroRef = null;
    if (wasEnabled || reason === 'no-readings') {
      this._emit('gyrochange', {
        enabled: false,
        pending: false,
        reason,
        state: this.getState(),
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
    const heading = headingOf(e);
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

    const gain = this._gyroGain
      * (this._config.gyro.invert ? -1 : 1)
      * (this._invert ? -1 : 1);
    const delta = shortDelta(this._gyroRef, heading) * gain;
    const raw = mod(this._gyroBase - delta, 360);

    if (this._gyroSmooth) {
      const now = performance.now();
      const dt = Math.min(Math.max(now - this._orientT, 1), 120);
      this._orientT = now;
      const tau = this._config.gyro.smoothMs ?? 80;
      this._target = mod(
        this._target + shortDelta(this._target, raw) * (1 - Math.exp(-dt / tau)),
        360,
      );
    } else {
      this._target = raw;
    }
    this._touchActivity();
  }

  /* ---------- 生命周期 ---------- */

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._loadToken++;
    cancelAnimationFrame(this._raf);
    this._stopGyro('destroyed');
    clearTimeout(this._pressTimer);
    this._pressTimer = null;
    this._resizeObserver?.disconnect();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.input.removeEventListener('pointerdown', this._onPointerDown);
    this.input.removeEventListener('pointermove', this._onPointerMove);
    this.input.removeEventListener('pointerup', this._onPointerUp);
    this.input.removeEventListener('pointercancel', this._onPointerUp);
    this.input.removeEventListener('pointerleave', this._onPointerLeave);
    this.input.removeEventListener('dblclick', this._onDblClick);
    this.input.removeEventListener('contextmenu', this._onContextMenu);
    this._layers = [];
    this._frames = [];
    this._meta = null;
    this._ready = false;
    this._loading = false;
    this._emit('destroy', {});
    this._events.clear();
  }
}

export function createClient(canvas, options) {
  return new Orbit360Client(canvas, options);
}

export { Orbit360Client as Client, VERSION, DEFAULTS };
export default Orbit360Client;
