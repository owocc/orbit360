import React, { useEffect, useRef, useState } from "react";
import { useOrbitClient } from "../hooks/useOrbitClient";
import { resolveCatalogSource } from "../lib/catalog";
import { displayAngle } from "../lib/format";
import { WakeSlider } from "./WakeSlider";

const CATALOG_URL = "catalog.json";

export default function PlaygroundPage() {
  const [catalog, setCatalog] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isAutoSpin, setIsAutoSpin] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(14);
  const [fitMode, setFitMode] = useState("contain");
  const [infoNotice, setInfoNotice] = useState("");
  const fileInputRef = useRef(null);

  const showNotice = (msg, duration = 2400) => {
    setInfoNotice(msg);
    setTimeout(() => setInfoNotice(""), duration);
  };

  const orbit = useOrbitClient({
    config: {
      video: { fit: fitMode },
      auto: { enabled: false, degPerSec: autoSpeed },
      drag: { degPerPx: 0.42, inertia: true },
    },
    onReady: (next) => {
      setCurrentAngle(Math.round(next.angle || 0));
      showNotice(`已载入：${next.title || "场景"}`);
    },
  });

  // 加载素材清单
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const res = await fetch(CATALOG_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error("无法读取 catalog.json");
        const data = await res.json();
        if (cancelled) return;
        setCatalog(data);

        const params = new URLSearchParams(location.search);
        const resolved = resolveCatalogSource(data, params);
        if (cancelled) return;

        setActiveItem(resolved.entry);
        if (orbit.clientRef.current && resolved.url) {
          await orbit.load(resolved.url, { quality: resolved.quality });
        }
      } catch (err) {
        if (!cancelled) showNotice(`加载清单失败: ${err.message}`, 4000);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // 切换官方示例
  const handleSelectExample = async (item) => {
    setActiveItem(item);
    const resolvedUrl = item.orb || item.packs?.uhd || item.packs?.hd || item.packs?.std;
    if (resolvedUrl && orbit.clientRef.current) {
      try {
        await orbit.load(resolvedUrl);
        showNotice(`已切换场景：${item.title}`);
      } catch (err) {
        showNotice(`加载场景失败: ${err.message}`, 4000);
      }
    }
  };
  // 本地文件导入 (.orb 二进制容器或兼容序列帧包)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    showNotice(`正在解析文件：${file.name}`, 4000);
    setActiveItem({ id: "custom", title: file.name });
    try {
      await orbit.load(file);
      showNotice(`已成功载入本地素材：${file.name}`);
    } catch (err) {
      showNotice(`导入解析失败: ${err.message}`, 4000);
    }
  };

  // 滑块控制实时旋转角度
  const handleSliderChange = (deg) => {
    setCurrentAngle(deg);
    const client = orbit.clientRef.current;
    if (client) {
      if (isAutoSpin) {
        client.stopAuto();
        setIsAutoSpin(false);
      }
      client.setAngle(deg);
    }
  };

  // 自动旋转开关
  const handleToggleAuto = () => {
    const client = orbit.clientRef.current;
    if (!client) return;
    if (isAutoSpin) {
      client.stopAuto();
      setIsAutoSpin(false);
      showNotice("已停止自动旋转");
    } else {
      client.startAuto("cw");
      setIsAutoSpin(true);
      showNotice("已开启自动旋转");
    }
  };

  // 重置回 0 度
  const handleReset = () => {
    const client = orbit.clientRef.current;
    if (client) {
      client.reset();
      setCurrentAngle(0);
      showNotice("已重置至 0°");
    }
  };

  // 缩放模式 contain / cover
  const handleToggleFit = () => {
    const nextFit = fitMode === "contain" ? "cover" : "contain";
    setFitMode(nextFit);
    const client = orbit.clientRef.current;
    if (client) {
      client.setFit(nextFit);
      showNotice(`画布模式：${nextFit === "contain" ? "完整包含 (Contain)" : "铺满裁剪 (Cover)"}`);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-140px)] py-6 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col font-sans">
      {/* 顶部标题与简述 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-6 border-b border-neutral-100 dark:border-neutral-900">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 mb-2">
            <span>LABORATORY & SANDBOX</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Orbit360 Playground
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            实时调试引擎渲染管线。支持拖拽交互、全景参数控制以及导入本地 .orb 场景文件。
          </p>
        </div>

        {/* 隐藏的本地文件导入 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".orb,.zip"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 右侧核心操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm cursor-pointer"
          >
            导入 .orb 文件
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer text-neutral-700 dark:text-neutral-300"
          >
            重置 0°
          </button>
        </div>
      </div>

      {/* 悬浮轻提示 */}
      {infoNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-900 text-xs font-mono shadow-xl backdrop-blur-md animate-fade-in pointer-events-none">
          {infoNotice}
        </div>
      )}

      {/* 主工作台：左侧/上侧 画板容器 + 右侧/下侧 实时控制面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        <div className="lg:col-span-8 flex flex-col items-center">
          <div
            ref={orbit.stageRef}
            className="w-full aspect-[16/10] sm:aspect-[16/9] max-h-[620px] rounded-3xl bg-neutral-950 relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.25)] flex items-center justify-center cursor-grab active:cursor-grabbing border border-neutral-800"
          >
            <canvas ref={orbit.canvasRef} className="w-full h-full block object-contain" />

            {/* 画布内右下角状态指示 */}
            <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-[11px] font-mono flex items-center gap-3 pointer-events-none select-none">
              <span>角度: {displayAngle(orbit.angle)}°</span>
              <span>
                帧: {orbit.frame.index + 1}/{orbit.frame.count || 240}
              </span>
            </div>
          </div>

          {/* 画板正下方的极简尾波滑块控制 */}
          <div className="w-full max-w-[480px] flex items-center justify-center pt-6">
            <WakeSlider
              bars={42}
              wake={75}
              min={-180}
              max={180}
              value={currentAngle}
              onChange={handleSliderChange}
            />
          </div>
        </div>

        {/* 控制面板区 */}
        <div className="lg:col-span-4 space-y-6">
          {/* 素材切换器 */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-3">
            <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
              场景预设
            </div>
            <div className="grid grid-cols-2 gap-2">
              {catalog?.items?.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectExample(item)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold font-sans text-left transition-all cursor-pointer ${
                    activeItem?.id === item.id
                      ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-700"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-800/60"
                  }`}
                >
                  <div className="truncate">{item.title}</div>
                  <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                    {item.source?.frames || 240} 帧
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 实时参数调优 */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-4">
            <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
              运动与排版属性
            </div>

            <div className="space-y-3 font-sans text-xs">
              {/* 自动旋转开关 */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-700 dark:text-neutral-300">自动旋转状态</span>
                <button
                  type="button"
                  onClick={handleToggleAuto}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    isAutoSpin
                      ? "bg-green-600 text-white"
                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {isAutoSpin ? "运行中" : "已暂停"}
                </button>
              </div>

              {/* 旋转速度微调 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>旋转角速度</span>
                  <span className="font-mono">{autoSpeed}°/s</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="45"
                  value={autoSpeed}
                  onChange={(e) => {
                    const spd = Number(e.target.value);
                    setAutoSpeed(spd);
                    orbit.clientRef.current?.setAutoSpeed(spd);
                  }}
                  className="w-full accent-neutral-900 dark:accent-white cursor-pointer"
                />
              </div>

              {/* 布局适应模式 */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-neutral-700 dark:text-neutral-300">填充模式</span>
                <button
                  type="button"
                  onClick={handleToggleFit}
                  className="px-3 py-1 rounded-lg font-mono font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {fitMode}
                </button>
              </div>
            </div>
          </div>

          {/* 引擎技术指标 */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-2 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            <div className="font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
              ENGINE METRICS
            </div>
            <div className="flex justify-between">
              <span>渲染架构:</span>
              <span className="text-neutral-800 dark:text-neutral-200">Pure Canvas Hard-cut</span>
            </div>
            <div className="flex justify-between">
              <span>文件容器:</span>
              <span className="text-neutral-800 dark:text-neutral-200">
                {activeItem?.orb ? ".orb Binary Range" : "Custom Blob"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>显存占用:</span>
              <span className="text-neutral-800 dark:text-neutral-200">&lt; 15MB VRAM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
