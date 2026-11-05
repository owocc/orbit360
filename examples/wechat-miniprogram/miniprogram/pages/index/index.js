const { createClient } = require("../../sdk/orbit360.js");

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
  },

  lifetimes: {
    attached() {
      this._offs = [];
      this._disposed = false;
      this._lastAngle = null;
      this._lastFrame = null;
      this._lastProgress = -1;
      this._loadSeq = 0;
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
      wx.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["orb"],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          if (!file) return;
          if (file.name && !/\.orb$/i.test(file.name)) {
            wx.showToast({ title: "请选择 .orb 文件", icon: "none" });
            return;
          }
          void this.loadImported(file);
        },
        fail: (err) => {
          if (err && /cancel/i.test(err.errMsg || "")) return;
          wx.showToast({ title: "无法选择文件", icon: "none" });
        },
      });
    },

    async loadImported(file) {
      if (!this.client) return;
      const seq = ++this._loadSeq;
      this.setData({
        loading: true,
        progress: 0,
        error: "",
        title: file.name || "导入场景",
        angleText: "0°",
        frameText: "0",
        missing: 0,
      });
      try {
        await this.client.load(file);
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
        wx.showToast({ title: "导入成功", icon: "success" });
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
        wx.showToast({ title: "当前设备不支持陀螺仪", icon: "none" });
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
