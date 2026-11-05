import { OrbitRenderController } from "@orbit360/expo-render";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RingHud } from "./RingHud";

interface ControlPanelProps {
  controller: OrbitRenderController;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleGyro: () => void;
  onReset: () => void;
  onCalibrate: () => void;
  onToggleInvert: () => void;
  onToggleMouseFollow: () => void;
  onCycleAuto: () => void;
  onToggleGyroSmooth: () => void;
  onToggleInertia: () => void;
  onToggleFit: () => void;
  onImportFile: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  controller,
  fullscreen,
  onToggleFullscreen,
  onToggleGyro,
  onReset,
  onCalibrate,
  onToggleInvert,
  onToggleMouseFollow,
  onCycleAuto,
  onToggleGyroSmooth,
  onToggleInertia,
  onToggleFit,
  onImportFile,
}) => {
  const state = controller.state;
  const config = controller.config;
  const gyroOn = state.gyro.enabled;
  const autoState = state.auto.state;

  const autoLabel = autoState === "off" ? "自动环绕" : autoState === "ccw" ? "逆时针" : "顺时针";

  const frameLabel =
    state.frameCount > 0
      ? `帧 ${state.frameIndex + 1} / ${state.frameCount} · ${state.frameDeg.toFixed(2)}°/帧`
      : "— / —";

  return (
    <View style={styles.panel}>
      {/* Frame count subtitle */}
      <Text style={styles.subText}>{frameLabel}</Text>

      {/* Compass Ring Hud */}
      <View style={styles.hudRow}>
        <RingHud angle={state.angle} axis={state.axis} size={76} />
      </View>

      {/* Sliders / Sensitivities */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>陀螺仪</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() =>
            controller.setGyroGain(Math.max(0.4, Number((config.gyroGain - 0.2).toFixed(1))))
          }
        >
          <Text style={styles.stepBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.sliderValue}>{config.gyroGain.toFixed(1)}×</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() =>
            controller.setGyroGain(Math.min(3.0, Number((config.gyroGain + 0.2).toFixed(1))))
          }
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>自动转速</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => controller.setAutoSpeed(Math.max(2, Math.round(config.autoDegPerSec - 2)))}
        >
          <Text style={styles.stepBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.sliderValue}>{Math.round(config.autoDegPerSec)}°/s</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() =>
            controller.setAutoSpeed(Math.min(60, Math.round(config.autoDegPerSec + 2)))
          }
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Main Buttons */}
      <View style={styles.buttonGrid}>
        <TouchableOpacity
          style={[styles.btn, fullscreen && styles.btnActive]}
          onPress={onToggleFullscreen}
        >
          <Text style={[styles.btnText, fullscreen && styles.btnTextActive]}>
            {fullscreen ? "退出全屏" : "全屏"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, gyroOn && styles.btnActive]} onPress={onToggleGyro}>
          <Text style={[styles.btnText, gyroOn && styles.btnTextActive]}>
            {gyroOn ? "陀螺仪已开" : "陀螺仪"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onReset}>
          <Text style={styles.btnText}>重置</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, !gyroOn && styles.btnDisabled]}
          disabled={!gyroOn}
          onPress={onCalibrate}
        >
          <Text style={[styles.btnText, !gyroOn && styles.btnTextDisabled]}>校准</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, state.invert && styles.btnActive]}
          onPress={onToggleInvert}
        >
          <Text style={[styles.btnText, state.invert && styles.btnTextActive]}>反向</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, state.mouseFollow && styles.btnActive]}
          onPress={onToggleMouseFollow}
        >
          <Text style={[styles.btnText, state.mouseFollow && styles.btnTextActive]}>鼠标跟随</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, autoState !== "off" && styles.btnActive]}
          onPress={onCycleAuto}
        >
          <Text style={[styles.btnText, autoState !== "off" && styles.btnTextActive]}>
            {autoLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onImportFile}>
          <Text style={styles.btnText}>导入</Text>
        </TouchableOpacity>
      </View>

      {/* Toggles */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, config.gyroSmooth && styles.toggleBtnActive]}
          onPress={onToggleGyroSmooth}
        >
          <Text style={[styles.toggleBtnText, config.gyroSmooth && styles.toggleBtnTextActive]}>
            陀螺仪平滑
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, state.inertia && styles.toggleBtnActive]}
          onPress={onToggleInertia}
        >
          <Text style={[styles.toggleBtnText, state.inertia && styles.toggleBtnTextActive]}>
            惯性
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, state.fit === "cover" && styles.toggleBtnActive]}
          onPress={onToggleFit}
        >
          <Text style={[styles.toggleBtnText, state.fit === "cover" && styles.toggleBtnTextActive]}>
            {state.fit === "cover" ? "铺满" : "自适应"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    width: 280,
    backgroundColor: "rgba(13, 15, 19, 0.88)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  subText: {
    fontSize: 10.5,
    color: "#8B909A",
    textAlign: "center",
    marginBottom: 6,
  },
  hudRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  sliderLabel: {
    fontSize: 11,
    color: "#8B909A",
    width: 52,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  sliderValue: {
    fontSize: 11,
    color: "#6EE7B7",
    fontVariant: ["tabular-nums"],
    width: 44,
    textAlign: "center",
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  btnActive: {
    backgroundColor: "rgba(110, 231, 183, 0.18)",
    borderColor: "#6EE7B7",
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 11,
    color: "#E2E8F0",
  },
  btnTextActive: {
    color: "#6EE7B7",
    fontWeight: "600",
  },
  btnTextDisabled: {
    color: "#64748B",
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  toggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  toggleBtnActive: {
    backgroundColor: "rgba(110, 231, 183, 0.15)",
    borderColor: "#6EE7B7",
  },
  toggleBtnText: {
    fontSize: 10,
    color: "#8B909A",
  },
  toggleBtnTextActive: {
    color: "#6EE7B7",
  },
});
