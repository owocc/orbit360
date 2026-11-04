import { OrbitRenderController, OrbitRenderWidget } from "@orbit360/expo-render";
import { Asset } from "expo-asset";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Gyroscope } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, GestureResponderEvent, Platform, StyleSheet, View } from "react-native";
import { ControlPanel } from "./src/components/ControlPanel";
import { CatalogItem, ExampleBar } from "./src/components/ExampleBar";
import { Loader } from "./src/components/Loader";
import { TopBar } from "./src/components/TopBar";

// Catalog items bundled
const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: "maid",
    title: "沙发少女",
    orb: "maid",
  },
  {
    id: "orbit",
    title: "环绕视角",
    orb: "orbit",
  },
];

export default function App() {
  const controllerRef = useRef(new OrbitRenderController());
  const controller = controllerRef.current;

  const [uiVisible, setUiVisible] = useState(true);
  const [hintText, setHintText] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>("maid");
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const flashHint = useCallback((text: string, durationMs = 2000) => {
    clearTimeout(hintTimerRef.current as unknown as number);
    setHintText(text);
    setHintVisible(true);
    hintTimerRef.current = setTimeout(() => {
      setHintVisible(false);
    }, durationMs) as unknown as number;
  }, []);

  const toggleUI = useCallback(() => {
    setUiVisible((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // Sensor integration
  useEffect(() => {
    Gyroscope.setUpdateInterval(20); // 50Hz
    let lastT = Date.now();

    const subscription = Gyroscope.addListener((data) => {
      if (!controller.gyro.enabled) return;
      const now = Date.now();
      const dt = (now - lastT) / 1000.0;
      lastT = now;
      if (dt <= 0 || dt > 0.2) return;

      const windowDim = Dimensions.get("window");
      const isLandscape = windowDim.width > windowDim.height;
      const rotation = isLandscape ? 90 : 0;

      controller.handleGyroscopeDelta(data.x, data.y, data.z, dt, rotation);
    });

    return () => {
      subscription.remove();
    };
  }, [controller]);

  // Load a catalog item
  const loadItem = useCallback(
    async (item: CatalogItem) => {
      console.log("loadItem called for:", item.id);
      setSelectedExampleId(item.id);
      setIsLoading(true);
      setLoadProgress(0.1);
      setLoadError(null);

      try {
        const mod =
          item.orb === "maid"
            ? require("./assets/maid/scene.orb")
            : require("./assets/orbit/scene.orb");
        const asset = Asset.fromModule(mod);
        // 在 Expo Go 下，fetch(file://...) 不支持，直接通过 asset.uri (HTTP 端口) 获取 arrayBuffer
        const target = asset.uri;
        console.log("Fetching orb from HTTP asset.uri:", target);
        const res = await fetch(target);
        if (!res.ok) throw new Error(`HTTP ${res.status} on ${target}`);
        const ab = await res.arrayBuffer();
        console.log("Downloaded orb arrayBuffer byteLength:", ab.byteLength);
        const bytes = new Uint8Array(ab);
        await controller.loadOrbBytes(bytes, item.title);
        setIsLoading(false);
        flashHint(
          controller.axis === "y" ? "上下拖拽旋转 · 前后倾斜手机" : "左右拖拽旋转 · 倾斜手机环视",
          2500,
        );
      } catch (err: unknown) {
        console.error("loadItem error:", err);
        setIsLoading(false);
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        setLoadError(msg);
        flashHint(`加载失败: ${msg}`, 4000);
      }
    },
    [controller, flashHint],
  );

  useEffect(() => {
    const unsub = controller.addListener(() => {
      setLoadProgress(controller.progress);
    });
    void loadItem(CATALOG_ITEMS[0]);
    return () => unsub();
  }, [controller, loadItem]);
  const handleToggleGyro = useCallback(() => {
    if (controller.gyro.enabled) {
      controller.disableGyro();
      flashHint("陀螺仪已关闭", 1400);
    } else {
      controller.enableGyro();
      flashHint(
        controller.axis === "y"
          ? "前后倾斜手机环视 · 仍可上下拖拽微调"
          : "转动身体环视 · 仍可拖拽微调",
        2400,
      );
    }
  }, [controller, flashHint]);

  const handleToggleInvert = useCallback(() => {
    const next = !controller.invert;
    controller.setInvert(next);
    flashHint(next ? "方向已反向" : "方向已恢复", 1400);
  }, [controller, flashHint]);

  const handleToggleInertia = useCallback(() => {
    const next = !controller.inertia;
    controller.setInertia(next);
    flashHint(next ? "松手惯性已开" : "松手即停", 1400);
  }, [controller, flashHint]);

  const handleToggleFit = useCallback(() => {
    const next = controller.fit === "cover" ? "contain" : "cover";
    controller.setFit(next);
    flashHint(next === "cover" ? "铺满视口" : "自适应显示", 1400);
  }, [controller, flashHint]);

  const handleToggleMouseFollow = useCallback(() => {
    const next = !controller.config.mouseFollowEnabled;
    controller.setMouseFollow(next);
    flashHint(next ? "鼠标移动即可转向" : "鼠标跟随已关闭", 1400);
  }, [controller, flashHint]);

  const handleToggleGyroSmooth = useCallback(() => {
    const next = !controller.config.gyroSmooth;
    controller.setGyroSmooth(next);
    flashHint(next ? "陀螺仪平滑已开" : "陀螺仪原始跟随（会有抖动）", 1400);
  }, [controller, flashHint]);

  const handleCycleAuto = useCallback(() => {
    const next = controller.cycleAuto();
    flashHint(
      next === "off" ? "自动旋转已关闭" : next === "cw" ? "顺时针自动旋转" : "逆时针自动旋转",
      1400,
    );
  }, [controller, flashHint]);

  const handleReset = useCallback(() => {
    controller.reset();
    flashHint("已重置到 0°", 1400);
  }, [controller, flashHint]);

  const handleCalibrate = useCallback(() => {
    controller.calibrateGyro();
    flashHint("陀螺仪已校准", 1400);
  }, [controller, flashHint]);

  const handleToggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  const handleImportFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const name = (file.name || "").toLowerCase();
        if (!name.endsWith(".orb") && !name.endsWith(".zip")) {
          flashHint("请选择 .orb 或 .zip 格式文件", 3000);
          return;
        }

        flashHint(`正在载入 ${file.name}`, 2000);
        setIsLoading(true);
        setSelectedExampleId(null);

        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryStr = atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        await controller.loadOrbBytes(bytes, file.name);
        setIsLoading(false);
        flashHint(`已载入 ${controller.title}`, 2000);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      flashHint(`导入失败: ${msg}`, 3000);
    }
  }, [controller, flashHint]);

  // Double tap detection on overlay container
  const lastTapRef = useRef<number>(0);
  const handleTouchEnd = useCallback(
    (_e: GestureResponderEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        toggleUI();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [toggleUI],
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden={fullscreen} style="light" />

      {/* Stage Canvas */}
      <OrbitRenderWidget controller={controller} style={styles.stage} />

      {/* Top Bar */}
      <View
        style={[styles.topBarWrap, { opacity: uiVisible ? 1 : 0 }]}
        pointerEvents={uiVisible ? "box-none" : "none"}
      >
        <TopBar title={controller.title} hint={hintText} hintVisible={hintVisible} />
      </View>

      {/* Control Panel (Bottom Left) */}
      <View
        style={[styles.panelWrap, { opacity: uiVisible ? 1 : 0 }]}
        pointerEvents={uiVisible ? "auto" : "none"}
      >
        <ControlPanel
          controller={controller}
          fullscreen={fullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleGyro={handleToggleGyro}
          onReset={handleReset}
          onCalibrate={handleCalibrate}
          onToggleInvert={handleToggleInvert}
          onToggleMouseFollow={handleToggleMouseFollow}
          onCycleAuto={handleCycleAuto}
          onToggleGyroSmooth={handleToggleGyroSmooth}
          onToggleInertia={handleToggleInertia}
          onToggleFit={handleToggleFit}
          onImportFile={handleImportFile}
        />
      </View>

      {/* Example Bar (Bottom Right) */}
      <View
        style={[styles.exampleBarWrap, { opacity: uiVisible ? 1 : 0 }]}
        pointerEvents={uiVisible ? "auto" : "none"}
      >
        <ExampleBar items={CATALOG_ITEMS} currentId={selectedExampleId} onSelect={loadItem} />
      </View>

      {/* Loader */}
      {isLoading && <Loader progress={loadProgress} error={loadError} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050608",
  },
  stage: {
    ...StyleSheet.absoluteFill,
  },
  topBarWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  panelWrap: {
    position: "absolute",
    bottom: 20,
    left: 14,
    zIndex: 10,
  },
  exampleBarWrap: {
    position: "absolute",
    bottom: 20,
    right: 14,
    zIndex: 10,
  },
});
