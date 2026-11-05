const { createClient } = require("../../sdk/orbit360.js");

// 可选：填一个可访问的 .orb 地址后，空状态会多出「加载演示场景」按钮。
// 模拟器调试时用本地 HTTP 服务（project.config.json 已关闭 urlCheck）。
const DEMO_URL = "";

Component({
  data: {
    title: "未导入场景",
    angleText: "0°",
    frameText: "0",
    progress: 0,
    loading: false,
    error: "",
    ready: false,
    auto: false,
    gyro: false,
    fit: "contain",
    fitText: "自适应",
    missing: 0,
    demoUrl: DEMO_URL,
    canChooseFile: false,
    url: "",
  },

  lifetimes: {
    attached() {
      this._offs = [];
      this._disposed = false;
      this._lastAngle = null;
      this._lastFrame = null;
      this._lastProgress = -1;
      this._loadSeq = 0;
      // 抖音小程序通常没有 tt.chooseMessageFile，此时退回「URL / 剪贴板」导入。
      this.setData({ canChooseFile: typeof tt.chooseMessageFile === "function" });
    },
    ready() {
      // ready 时 Canvas 节点已经完成布局，能拿到正确的 width / height。
      void this.init();
    },
    detached() {
      this._disposed = true;
      this.dispose();
    },
  },

  pageLifetimes: {
    hide() {
      this._hidden = true;
      if (this.client) {
        this.client.pause();
        this.client.disableGyro();
      }
    },
    show() {
      this._hidden = false;
      if (this.client) this.client.resume();
    },
  },

  methods: {
    async init() {
      try {
        const client = await createClient({
          selector: "#orbit-canvas",
          component: this,
          config: {
            auto: { enabled: true, dir: "cw", degPerSec: 12 },
            video: { fit: "contain" },
          },
        });
        if (this._disposed) {
          client.destroy();
          return;
        }
        this.client = client;
        console.log("[orbit360] viewport", client.getState().viewport);
        this._offs.push(client.on("state", (state) => this.syncState(state)));
        this._offs.push(
          client.on("angle", ({ angle, frameIndex }) => this.syncAngle(angle, frameIndex)),
        );
        this._offs.push(client.on("frame", ({ index, count }) => this.syncFrame(index, count)));
        this._offs.push(client.on("progress", ({ progress }) => this.syncProgress(progress)));
        this._offs.push(
          client.on("error", (err) => {
            this.setData({ error: errorText(err), loading: false });
          }),
        );
      } catch (err) {
        this.setData({ error: errorText(err) });
      }
    },

    importScene() {
      if (!this.client || this.data.loading) return;
      if (this.data.canChooseFile) this.chooseFile();
      else this.loadFromClipboard();
    },

    chooseFile() {
      tt.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["orb"],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          if (!file) return;
          if (file.name && !/\.orb$/i.test(file.name)) {
            tt.showToast({ title: "请选择 .orb 文件", icon: "none" });
            return;
          }
          void this.loadImported(file.path, file.name, file);
        },
        fail: (err) => {
          if (err && /cancel/i.test(err.errMsg || "")) return;
          tt.showToast({ title: "无法选择文件", icon: "none" });
        },
      });
    },

    loadFromClipboard() {
      tt.getClipboardData({
        success: (res) => {
          const url = String((res && res.data) || "").trim();
          if (!isSceneUrl(url)) {
            tt.showToast({ title: "剪贴板没有 .orb 地址", icon: "none" });
            return;
          }
          this.setData({ url });
          void this.loadImported(url, nameFromUrl(url));
        },
        fail: () => {
          tt.showToast({ title: "读取剪贴板失败", icon: "none" });
        },
      });
    },

    onUrlInput(e) {
      this.setData({ url: (e.detail && e.detail.value) || "" });
    },

    loadUrl() {
      if (!this.client || this.data.loading) return;
      const url = String(this.data.url || "").trim();
      if (!isSceneUrl(url)) {
        tt.showToast({ title: "请输入 http(s) 或 data: 地址", icon: "none" });
        return;
      }
      void this.loadImported(url, nameFromUrl(url));
    },

    loadDemo() {
      if (!DEMO_URL || !this.client || this.data.loading) return;
      void this.loadImported(DEMO_URL, "演示场景");
    },

    async loadImported(source, name, raw) {
      if (!this.client) return;
      const seq = ++this._loadSeq;
      this.setData({
        loading: true,
        progress: 0,
        error: "",
        title: name || "导入场景",
        angleText: "0°",
        frameText: "0",
        missing: 0,
      });
      try {
        await this.client.load(raw || source);
        if (seq !== this._loadSeq || this._disposed) return;
        const state = this.client.getState();
        const layer = this.client._layers && this.client._layers[0];
        const first = layer && layer.frames && layer.frames[0];
        console.log("[orbit360] loaded", {
          viewport: state.viewport,
          canvas: state.canvas,
          missing: state.missingFrames,
          frameCount: state.frameCount,
          image:
            first && first.img ? [first.img.width, first.img.height, first.sw, first.sh] : null,
        });
        this.setData({ loading: false });
        this._lastAngle = null;
        this._lastFrame = null;
        tt.showToast({ title: "导入成功", icon: "success" });
      } catch (err) {
        if (seq !== this._loadSeq || this._disposed) return;
        this.setData({ loading: false, error: errorText(err) });
      }
    },

    syncState(state) {
      const fitText = state.fit === "cover" ? "铺满" : "自适应";
      const missing = state.missingFrames || 0;
      this.setData({
        title: state.title || this.data.title,
        ready: state.ready,
        auto: state.auto.enabled,
        gyro: state.gyro.enabled,
        fit: state.fit,
        fitText,
        missing,
      });
    },

    syncAngle(angle, frameIndex) {
      const rounded = Math.round(angle);
      if (rounded === this._lastAngle && frameIndex === this._lastFrame) return;
      this._lastAngle = rounded;
      this._lastFrame = frameIndex;
      this.setData({
        angleText: `${rounded}°`,
        frameText: `${frameIndex + 1}`,
      });
    },

    syncFrame(index, count) {
      this._lastFrame = index;
      if (this.data.frameCount !== count) {
        this.setData({ frameText: `${index + 1}`, frameCount: count });
      }
    },

    syncProgress(progress) {
      const percent = Math.round(progress * 100);
      if (percent === this._lastProgress) return;
      this._lastProgress = percent;
      this.setData({ progress: percent });
    },

    toggleAuto() {
      if (!this.client || !this.data.ready) return;
      this.client.cycleAuto();
    },

    async toggleGyro() {
      if (!this.client || !this.data.ready) return;
      const state = this.client.getState();
      if (state.gyro.enabled) {
        this.client.disableGyro();
        return;
      }
      const ok = await this.client.enableGyro();
      if (!ok && !this._disposed) {
        tt.showToast({ title: "当前设备不支持陀螺仪", icon: "none" });
      }
    },

    toggleFit() {
      if (!this.client || !this.data.ready) return;
      this.client.setFit(this.client.getState().fit === "cover" ? "contain" : "cover");
    },

    onTouchStart(e) {
      if (this.client) this.client.touchStart(e);
    },

    onTouchMove(e) {
      if (this.client) this.client.touchMove(e);
    },

    onTouchEnd(e) {
      if (this.client) this.client.touchEnd(e);
    },

    onTouchCancel(e) {
      if (this.client) this.client.touchCancel(e);
    },

    dispose() {
      for (const off of this._offs || []) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      this._offs = [];
      if (this.client) {
        this.client.destroy();
        this.client = null;
      }
    },
  },
});

function errorText(err) {
  if (!err) return "未知错误";
  if (typeof err === "string") return err;
  return err.errMsg || err.message || String(err);
}

function isSceneUrl(value) {
  return /^https?:\/\//i.test(value) || /^data:application\/octet-stream/i.test(value);
}

function nameFromUrl(url) {
  if (!url || url.startsWith("data:")) return "网络场景";
  const path = url.split("?")[0].split("#")[0];
  const name = path.slice(path.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(name) || "网络场景";
  } catch {
    return name || "网络场景";
  }
}
