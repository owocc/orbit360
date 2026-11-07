import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlPanel } from "./components/ControlPanel.jsx";
import { ExampleBar } from "./components/ExampleBar.jsx";
import { Loader } from "./components/Loader.jsx";
import { Stage } from "./components/Stage.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { useFullscreen } from "./hooks/useFullscreen.js";
import { useHint } from "./hooks/useHint.js";
import { useOrbitClient } from "./hooks/useOrbitClient.js";
import { useUiVisibility } from "./hooks/useUiVisibility.js";
import { QUALITY_LABEL, availableQualities, resolveCatalogSource } from "./lib/catalog.js";
import { hintForAxis } from "./lib/format.js";
import { readQualityPref, readUserConfig, writeAutoPref, writeQualityPref } from "./lib/prefs.js";

const CATALOG_URL = "/catalog.json";

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const initialConfig = useMemo(() => readUserConfig(), []);
  const importFileRef = useRef(null);

  const ui = useUiVisibility();
  const [axis, setAxis] = useState("x");
  const hints = useHint(hintForAxis(axis));

  const [loader, setLoader] = useState({ done: false, hidden: false, error: null });
  const [catalog, setCatalog] = useState(null);
  const [entry, setEntry] = useState(null);
  const [exampleId, setExampleId] = useState(null);
  const [quality, setQuality] = useState(null);

  const draggingRef = useRef(false);
  const isDragging = useCallback(() => draggingRef.current, []);

  const orbit = useOrbitClient({
    config: initialConfig,
    onReady: (next) => {
      setAxis(next.axis || "x");
      ui.scheduleHide(isDragging);
      if (next.missingFrames) {
        hints.flashHint(
          `${next.missingFrames} 帧解码失败（${next.quality || next.codec || next.format}）`,
        );
      }
    },
    onGyroChange: (event, next) => {
      if (event.reason === "enabled") {
        hints.flashHint(
          next.axis === "y" ? "前后倾斜手机环视 · 仍可上下拖拽微调" : "转动身体环视 · 仍可拖拽微调",
          3200,
        );
      } else if (event.reason === "no-readings") {
        hints.flashHint("未检测到方向传感器，请用拖拽", 2600);
      } else if (["denied", "unsupported", "error"].includes(event.reason)) {
        hints.flashHint("陀螺仪被拒绝或需 HTTPS，桌面请用拖拽", 2600);
      }
    },
    onLongpress: () => {
      ui.toggle();
      navigator.vibrate?.(8);
    },
    onDoubletap: () => ui.toggle(),
  });

  const fullscreen = useFullscreen({
    onChange: () => orbit.clientRef.current?.resize(),
    onError: hints.flashHint,
  });

  const state = orbit.state;
  const title = state?.title || "环绕视角";

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    draggingRef.current = !!state?.dragging;
  }, [state?.dragging]);

  useEffect(() => {
    if (state?.axis) setAxis(state.axis === "y" ? "y" : "x");
  }, [state?.axis]);

  useEffect(() => {
    if (!orbit.ready) return undefined;
    setLoader((current) => ({ ...current, done: true }));
    const timer = setTimeout(() => {
      setLoader((current) => ({ ...current, hidden: true }));
    }, 600);
    return () => clearTimeout(timer);
  }, [orbit.ready]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const orbUrl = params.get("orb");
      if (orbUrl) {
        setEntry(null);
        setExampleId(null);
        await orbit.load(orbUrl, { quality: null });
        return;
      }

      const response = await fetch(CATALOG_URL, { cache: "no-cache" });
      const nextCatalog = response.ok ? await response.json() : null;
      if (cancelled) return;

      const source = resolveCatalogSource(nextCatalog, params, readQualityPref());
      if (cancelled) return;

      setCatalog(nextCatalog);
      setEntry(source.entry);
      setExampleId(source.exampleId);
      setQuality(source.quality);
      await orbit.load(source.url, { quality: source.quality });
    }

    boot().catch((err) => {
      console.error(err);
      if (!cancelled) {
        setLoader((current) => ({ ...current, error: err.message }));
      }
    });

    return () => {
      cancelled = true;
    };
    // 启动只解析一次 URL / catalog。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const client = orbit.clientRef.current;
      if (!client) return;
      const step = event.shiftKey ? 15 : 3;
      if (event.key === "ArrowRight") {
        client.rotateBy(step);
        ui.scheduleHide(isDragging);
        event.preventDefault();
      } else if (event.key === "ArrowLeft") {
        client.rotateBy(-step);
        ui.scheduleHide(isDragging);
        event.preventDefault();
      } else if (event.key === " ") {
        const next = client.cycleAuto();
        writeAutoPref(next, client.getConfig().auto.degPerSec);
        hints.flashHint(
          next === "off" ? "自动旋转已关闭" : next === "cw" ? "顺时针自动旋转" : "逆时针自动旋转",
          1400,
        );
        event.preventDefault();
      } else if (event.key === "h" || event.key === "H") {
        ui.toggle();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [orbit.clientRef, hints.flashHint, ui.scheduleHide, ui.toggle, isDragging]);

  useEffect(() => {
    if (!params.has("debug")) return;
    window.__orbit = {
      client: orbit.clientRef.current,
      state,
      catalog,
      entry,
      flashHint: hints.flashHint,
      setUI: ui.toggle,
    };
  }, [params, orbit.clientRef, state, catalog, entry, hints.flashHint, ui.toggle]);

  const handleExample = (item) => {
    if (item.id === exampleId) {
      ui.scheduleHide(isDragging);
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("e", item.id);
    url.searchParams.delete("q");
    location.href = url.toString();
  };

  const handleToggleGyro = async () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    if (client.getState().gyro.enabled) {
      client.disableGyro();
      hints.flashHint("陀螺仪已关闭", 1600);
    } else {
      await client.enableGyro();
    }
  };

  const handleToggleInvert = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    const next = !client.getState().invert;
    client.setInvert(next);
    hints.flashHint(next ? "方向已反向" : "方向已恢复", 1400);
  };

  const handleToggleMouseFollow = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    const enabled = !client.getState().mouseFollow.enabled;
    client.setMouseFollow(enabled);
    hints.flashHint(enabled ? "鼠标移动即可转向" : "鼠标跟随已关闭", 1600);
  };

  const handleToggleGyroSmooth = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    const smooth = !client.getState().config.gyro.smooth;
    client.setGyroConfig({ smooth });
    hints.flashHint(smooth ? "陀螺仪平滑已开" : "陀螺仪原始跟随（会有抖动）", 1600);
  };

  const handleToggleInertia = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    const inertia = !client.getState().inertia;
    client.setInertia(inertia);
    hints.flashHint(inertia ? "松手惯性已开" : "松手即停", 1600);
  };

  const handleToggleFit = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    const fit = client.getState().fit === "cover" ? "contain" : "cover";
    client.setFit(fit);
    hints.flashHint(fit === "cover" ? "铺满视口" : "自适应显示", 1400);
  };

  const handleAuto = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    const next = client.cycleAuto();
    writeAutoPref(next, client.getConfig().auto.degPerSec);
    hints.flashHint(
      next === "off" ? "自动旋转已关闭" : next === "cw" ? "顺时针自动旋转" : "逆时针自动旋转",
      1400,
    );
  };

  const handleAutoSpeed = (speed) => {
    const client = orbit.clientRef.current;
    if (!client) return;
    client.setAutoSpeed(speed);
    writeAutoPref(client.getState().auto.state, speed);
  };

  const handleGain = (gain) => {
    orbit.clientRef.current?.setGyroConfig({ gain });
  };

  const handleReset = () => {
    orbit.clientRef.current?.reset();
    hints.flashHint("已重置到 0°", 1400);
  };

  const handleCalibrate = () => {
    orbit.clientRef.current?.calibrateGyro();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    hints.flashHint(`正在解析 ${file.name}`, 4000);
    setEntry(null);
    setExampleId(null);
    setQuality(null);
    try {
      await orbit.load(file, { quality: null });
      const next = orbit.clientRef.current?.getState();
      hints.flashHint(`已载入 ${next?.title || file.name}`, 2400);
    } catch (err) {
      hints.flashHint(`导入失败：${err.message}`, 4000);
    }
  };

  const qualities = availableQualities(entry);
  const stateQuality = state?.quality || quality;
  const qualityButton = {
    visible: state?.format === "zip" && !!entry && qualities.length > 1,
    active: stateQuality !== "std",
    label: QUALITY_LABEL[stateQuality] || stateQuality,
  };

  const handleQuality = () => {
    if (qualities.length < 2) return;
    const index = qualities.indexOf(stateQuality);
    const next = qualities[(index + 1) % qualities.length];
    if (!next || next === stateQuality) return;
    writeQualityPref(next);
    const url = new URL(location.href);
    url.searchParams.set("q", next);
    location.href = url.toString();
  };

  return (
    <>
      <Stage stageRef={orbit.stageRef} canvasRef={orbit.canvasRef} />

      <TopBar title={title} hint={hints.hint} hintHidden={hints.hintHidden} />

      <ControlPanel
        state={state}
        frame={orbit.frame}
        angle={orbit.angle}
        axis={axis}
        fullscreen={fullscreen.active}
        fullscreenSupported={fullscreen.supported}
        qualityButton={qualityButton}
        importFileRef={importFileRef}
        onImportFile={handleImportFile}
        onToggleFullscreen={fullscreen.toggle}
        onToggleGyro={handleToggleGyro}
        onCalibrate={handleCalibrate}
        onReset={handleReset}
        onToggleInvert={handleToggleInvert}
        onGain={handleGain}
        onToggleMouseFollow={handleToggleMouseFollow}
        onToggleGyroSmooth={handleToggleGyroSmooth}
        onToggleInertia={handleToggleInertia}
        onToggleFit={handleToggleFit}
        onAuto={handleAuto}
        onAutoSpeed={handleAutoSpeed}
        onImport={() => importFileRef.current?.click()}
        onQuality={handleQuality}
      />

      <ExampleBar items={catalog?.items} currentId={exampleId} onSelect={handleExample} />

      {!loader.hidden && (
        <Loader progress={orbit.progress.progress} error={loader.error} done={loader.done} />
      )}
    </>
  );
}
