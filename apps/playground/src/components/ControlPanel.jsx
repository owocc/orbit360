import { AngleHud } from "./AngleHud.jsx";
import { frameLabel } from "../lib/format.js";

function autoLabel(state) {
  if (state === "off") return "自动环绕";
  return state === "ccw" ? "逆时针" : "顺时针";
}

export function ControlPanel({
  state,
  frame,
  angle,
  axis,
  fullscreen,
  fullscreenSupported,
  qualityButton,
  importFileRef,
  onImportFile,
  onToggleFullscreen,
  onToggleGyro,
  onCalibrate,
  onReset,
  onToggleInvert,
  onGain,
  onToggleMouseFollow,
  onToggleGyroSmooth,
  onToggleInertia,
  onToggleFit,
  onAuto,
  onAutoSpeed,
  onImport,
  onQuality,
}) {
  const config = state?.config;
  const gain = Number(config?.gyro?.gain ?? 1);
  const autoSpeed = Number(config?.auto?.degPerSec ?? 36);
  const gyroOn = !!state?.gyro?.enabled;
  const gyroText = gyroOn ? "陀螺仪已开" : state?.gyro?.pending ? "待授权" : "陀螺仪";

  return (
    <div id="panel">
      <div className="p-sub">{frameLabel(frame)}</div>

      <AngleHud angle={angle} axis={axis} />

      <label className="p-sens">
        <span>陀螺仪</span>
        <input
          type="range"
          min="0.4"
          max="3"
          step="0.1"
          value={gain}
          aria-label="陀螺仪灵敏度"
          onChange={(event) => onGain(Number.parseFloat(event.target.value) || 1)}
        />
        <b>{gain.toFixed(1)}×</b>
      </label>

      <label className="p-sens">
        <span>自动转速</span>
        <input
          type="range"
          min="2"
          max="60"
          step="1"
          value={autoSpeed}
          aria-label="自动旋转速度"
          onChange={(event) => onAutoSpeed(Number.parseFloat(event.target.value) || 36)}
        />
        <b>{Math.round(autoSpeed)}°/s</b>
      </label>

      <div className="p-btns">
        <button
          type="button"
          className={fullscreen ? "on" : undefined}
          hidden={!fullscreenSupported}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? "退出全屏" : "全屏"}
        </button>
        <button type="button" className={gyroOn ? "on" : undefined} onClick={onToggleGyro}>
          {gyroText}
        </button>
        <button type="button" onClick={onReset}>
          重置
        </button>
        <button type="button" disabled={!gyroOn} onClick={onCalibrate}>
          校准
        </button>
        <button type="button" className={state?.invert ? "on" : undefined} onClick={onToggleInvert}>
          反向
        </button>
        <button
          type="button"
          className={state?.mouseFollow?.enabled ? "on" : undefined}
          onClick={onToggleMouseFollow}
        >
          鼠标跟随
        </button>
        <button
          type="button"
          className={state?.auto?.state !== "off" ? "on" : undefined}
          onClick={onAuto}
        >
          {autoLabel(state?.auto?.state ?? "off")}
        </button>
        <button type="button" onClick={onImport}>
          导入
        </button>
      </div>

      <div className="p-toggles">
        <button
          type="button"
          className={config?.gyro?.smooth !== false ? "on" : undefined}
          onClick={onToggleGyroSmooth}
        >
          陀螺仪平滑
        </button>
        <button
          type="button"
          className={state?.inertia !== false ? "on" : undefined}
          onClick={onToggleInertia}
        >
          惯性
        </button>
        <button
          type="button"
          className={state?.fit === "cover" ? "on" : undefined}
          onClick={onToggleFit}
        >
          {state?.fit === "cover" ? "铺满" : "自适应"}
        </button>
        <button
          type="button"
          className={qualityButton?.active ? "on" : undefined}
          hidden={!qualityButton?.visible}
          onClick={onQuality}
        >
          {qualityButton?.label || "标准"}
        </button>
      </div>

      <input
        ref={importFileRef}
        type="file"
        accept=".zip,.orb,application/zip,application/octet-stream"
        hidden
        onChange={onImportFile}
      />
    </div>
  );
}
