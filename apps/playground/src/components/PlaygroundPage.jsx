import React, { useEffect, useRef, useState } from "react";
import { useOrbitClient } from "../hooks/useOrbitClient";
import { useFullscreen } from "../hooks/useFullscreen";
import { resolveCatalogSource } from "../lib/catalog";
import { displayAngle, ringGeometry, frameLabel } from "../lib/format";
import { WakeSlider } from "./WakeSlider";
import { UploadDropzone } from "./UploadDropzone.jsx";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "./ui/Popover.jsx";
import { useI18n } from "../lib/I18nContext";

const CATALOG_URL = "catalog.json";
export default function PlaygroundPage() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [infoNotice, setInfoNotice] = useState("");
  const fileInputRef = useRef(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  // 比例切换选项：16:9 宽屏, 4:3 经典, 1:1 正方, 9:16 竖屏
  const ASPECT_RATIOS = [
    { id: "16/9", label: "16:9", maxW: "max-w-full", aspect: "aspect-[16/9]" },
    { id: "4/3", label: "4:3", maxW: "max-w-[720px]", aspect: "aspect-[4/3]" },
    { id: "1/1", label: "1:1", maxW: "max-w-[560px]", aspect: "aspect-square" },
    { id: "9/16", label: "9:16", maxW: "max-w-[360px]", aspect: "aspect-[9/16]" },
  ];
  const [selectedRatio, setSelectedRatio] = useState("16/9");
  const currentRatioObj = ASPECT_RATIOS.find((r) => r.id === selectedRatio) || ASPECT_RATIOS[0];
  // 全屏 hook 在 orbit 声明后初始化

  const showNotice = (msg, duration = 2400) => {
    setInfoNotice(msg);
    setTimeout(() => setInfoNotice(""), duration);
  };

  const orbit = useOrbitClient({
    config: {
      video: { fit: "contain" },
      auto: { enabled: false, degPerSec: 14 },
      drag: { degPerPx: 0.42, inertia: true },
      mouseFollow: { enabled: false },
      gyro: { gain: 1, smooth: true },
    },
    onReady: (next) => {
      setCurrentAngle(Math.round(next.angle || 0));
      showNotice(`已载入：${next.title || "场景"}`);
    },
    onGyroChange: (event, next) => {
      if (event.reason === "enabled") {
        showNotice(next.axis === "y" ? "前后倾斜手机环视" : "转动身体体感环视");
      } else if (event.reason === "no-readings") {
        showNotice("未检测到设备方向传感器，请用手势拖拽");
      } else if (["denied", "unsupported", "error"].includes(event.reason)) {
        showNotice("陀螺仪被拒绝或需 HTTPS 环境");
      }
    },
  });

  // 全屏 hook：传入 stageRef，实现仅 canvas 画板全屏（不受比例限制，填满物理屏幕）
  const fullscreen = useFullscreen(orbit.stageRef, {
    onChange: () => {
      orbit.clientRef.current?.resize?.();
    },
  });

  const state = orbit.state;
  const config = state?.config;
  const client = orbit.clientRef.current;
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

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // 监听全窗口文件拖入：当用户从桌面拖动文件至浏览器视口时，自动弹出接收 Dropzone
  useEffect(() => {
    const handleWindowDragEnter = (e) => {
      e.preventDefault();
      // 仅对携带文件的拖拽响应
      if (e.dataTransfer?.types?.includes("Files")) {
        setShowUploadModal(true);
      }
    };

    const handleWindowDragOver = (e) => {
      e.preventDefault();
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragover", handleWindowDragOver);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, []);
  // 1. 本地文件导入
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

  // 2. 切换官方预设场景
  const handleSelectExample = async (item) => {
    setActiveItem(item);
    const resolvedUrl = item.orb || item.packs?.uhd || item.packs?.hd || item.packs?.std;
    if (resolvedUrl && client) {
      try {
        await orbit.load(resolvedUrl);
        showNotice(`已切换场景：${item.title}`);
      } catch (err) {
        showNotice(`加载场景失败: ${err.message}`, 4000);
      }
    }
  };

  // 3. 角度控制与滑块
  const handleSliderChange = (deg) => {
    setCurrentAngle(deg);
    if (client) {
      if (state?.auto?.state !== "off") {
        client.stopAuto();
      }
      client.setAngle(deg);
    }
  };

  // 4. 重置回 0 度
  const handleReset = () => {
    if (client) {
      client.reset();
      setCurrentAngle(0);
      showNotice("已重置至 0°");
    }
  };

  // 5. 自动旋转循环（off -> cw -> ccw -> off）
  const handleAutoCycle = () => {
    if (!client) return;
    const next = client.cycleAuto();
    showNotice(
      next === "off" ? "自动旋转已关闭" : next === "cw" ? "顺时针自动旋转" : "逆时针自动旋转",
    );
  };

  // 6. 自动旋转速度
  const handleAutoSpeed = (spd) => {
    if (!client) return;
    client.setAutoSpeed(spd);
  };

  // 7. 拖拽反向切换
  const handleToggleInvert = () => {
    if (!client) return;
    const next = !state?.invert;
    client.setInvert(next);
    showNotice(next ? "拖拽方向已反向" : "拖拽方向已恢复正常");
  };

  // 8. 鼠标跟随模式
  const handleToggleMouseFollow = () => {
    if (!client) return;
    const next = !state?.mouseFollow?.enabled;
    client.setMouseFollow(next);
    showNotice(next ? "鼠标跟随转向已开启" : "鼠标跟随已关闭");
  };

  // 9. 物理惯性滑动
  const handleToggleInertia = () => {
    if (!client) return;
    const next = state?.inertia === false ? true : false;
    client.setInertia(next);
    showNotice(next ? "松手惯性减速已开启" : "松手惯性已关闭（即停）");
  };

  // 10. 视口铺满模式 (contain / cover)
  const handleToggleFit = () => {
    if (!client) return;
    const fit = state?.fit === "cover" ? "contain" : "cover";
    client.setFit(fit);
    showNotice(fit === "cover" ? "画布模式：铺满视口 (Cover)" : "画布模式：完整包含 (Contain)");
  };

  // 11. 陀螺仪体感开关与授权
  const handleToggleGyro = async () => {
    if (!client) return;
    if (state?.gyro?.enabled) {
      client.disableGyro();
      showNotice("陀螺仪已关闭");
    } else {
      await client.enableGyro();
    }
  };

  // 12. 陀螺仪校准
  const handleCalibrateGyro = () => {
    if (!client) return;
    client.calibrateGyro();
    showNotice("陀螺仪零点已重新校准");
  };

  // 13. 陀螺仪平滑
  const handleToggleGyroSmooth = () => {
    if (!client) return;
    const smooth = !config?.gyro?.smooth;
    client.setGyroConfig({ smooth });
    showNotice(smooth ? "陀螺仪平滑滤波已开" : "陀螺仪原始跟随（无滤波）");
  };

  // 14. 陀螺仪增益倍数
  const handleGyroGain = (gain) => {
    if (!client) return;
    client.setGyroConfig({ gain });
  };

  // 环形罗盘计算
  const ring = ringGeometry(orbit.angle);
  const autoMode = state?.auto?.state ?? "off";
  const autoSpeedVal = Number(config?.auto?.degPerSec ?? 14);
  const gyroGainVal = Number(config?.gyro?.gain ?? 1);
  const isGyroOn = !!state?.gyro?.enabled;

  return (
    <div className="w-full min-h-[calc(100vh-140px)] py-6 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col font-sans">
      {/* 顶部标题栏与全局动作 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-6 border-b border-neutral-100 dark:border-neutral-900">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 mb-2">
            <span>{t.playground.tag}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {t.playground.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t.playground.desc}
          </p>
        </div>

        {/* 隐藏的本地文件 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".orb,.zip,application/octet-stream,application/zip"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 顶部操作快捷栏 */}
        <div className="flex items-center gap-2">
          {fullscreen.supported && (
            <button
              type="button"
              onClick={fullscreen.toggle}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                fullscreen.active
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {fullscreen.active ? t.playground.fullscreen_exit : t.playground.fullscreen_enter}
            </button>
          )}

          <PopoverRoot open={showUploadModal} onOpenChange={setShowUploadModal}>
            <PopoverTrigger className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm cursor-pointer">
              {t.playground.upload_btn}
            </PopoverTrigger>

            <PopoverContent side="bottom" align="end" sideOffset={10}>
              <div className="flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                    {t.playground.upload_modal_title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <UploadDropzone
                  onFileUploaded={async (uploaded) => {
                    const targetFile =
                      uploaded && "file" in uploaded && uploaded.file
                        ? uploaded.file
                        : uploaded instanceof File
                          ? uploaded
                          : null;
                    if (targetFile) {
                      const lower = targetFile.name.toLowerCase();
                      if (!lower.endsWith(".orb") && !lower.endsWith(".zip")) {
                        showNotice("仅支持 .orb 和 .zip 场景文件", 4000);
                        return;
                      }
                      showNotice(`正在挂载文件：${targetFile.name}`);
                      setActiveItem({ id: "custom", title: targetFile.name });
                      try {
                        await orbit.load(targetFile);
                        showNotice(`已成功挂载渲染：${targetFile.name}`);
                        setTimeout(() => setShowUploadModal(false), 900);
                      } catch (err) {
                        showNotice(`挂载失败: ${err.message}`, 4000);
                      }
                    } else {
                      showNotice(`演示素材已上传：${uploaded.name}`);
                      setTimeout(() => setShowUploadModal(false), 1200);
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </PopoverRoot>
          <button type="button" onClick={handleReset}>
            {t.playground.reset_btn}
          </button>
        </div>
      </div>

      {/* 悬浮轻提示 */}
      {infoNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-900 text-xs font-mono shadow-xl backdrop-blur-md animate-fade-in pointer-events-none">
          {infoNotice}
        </div>
      )}

      {/* 主界面：左侧大画板与极简尾波滑块 + 右侧集成式控制台 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        {/* 左侧画板区 */}
        <div className="lg:col-span-8 flex flex-col items-center w-full min-h-[500px] justify-center">
          <div
            className={`w-full ${fullscreen.active ? "max-w-none w-screen h-screen" : currentRatioObj.maxW} flex items-center justify-center transition-all duration-300 ease-out`}
          >
            <div
              ref={orbit.stageRef}
              className={`w-full ${
                fullscreen.active
                  ? "w-screen h-screen fixed inset-0 z-[9999] rounded-none border-none max-h-none"
                  : `${currentRatioObj.aspect} max-h-[640px] rounded-3xl border border-neutral-800 shadow-[0_25px_60px_rgba(0,0,0,0.25)]`
              } bg-neutral-950 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-all duration-300`}
            >
              <canvas ref={orbit.canvasRef} className="w-full h-full block object-contain" />

              {/* 全屏状态下右上角浮动退出全屏按钮 */}
              {fullscreen.active && (
                <button
                  type="button"
                  onClick={fullscreen.toggle}
                  className="absolute top-6 right-6 z-50 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/90 text-xs font-mono backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                >
                  {fullscreen.active
                    ? `ESC ${t.playground.fullscreen_exit}`
                    : t.playground.fullscreen_enter}
                </button>
              )}
            </div>
          </div>

          {/* 画板下方尾波滑块控制 */}
          <div className="w-full max-w-[500px] flex items-center justify-center pt-6">
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

        {/* 右侧完整控制台（集成历史 ControlPanel 中的全部专业控制项） */}
        <div className="lg:col-span-4 space-y-5">
          {/* 实时方位角与帧率监控 HUD 卡片 */}
          <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <svg className="w-12 h-12 flex-shrink-0" viewBox="0 0 132 132" aria-hidden="true">
                <circle
                  cx="66"
                  cy="66"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                  strokeWidth="1.5"
                />
                <circle
                  cx="66"
                  cy="66"
                  r="52"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeDasharray={ring.dash}
                  transform="rotate(-90 66 66)"
                />
                <line
                  x1="66"
                  y1="66"
                  x2={66 + Math.sin((orbit.angle * Math.PI) / 180) * 44}
                  y2={66 - Math.cos((orbit.angle * Math.PI) / 180) * 44}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="font-mono">
                <div className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {displayAngle(orbit.angle)}°
                </div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  {t.playground.bearing_title}
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-[11px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
              <div className="text-neutral-800 dark:text-neutral-200 font-semibold">
                {frameLabel(orbit.frame)}
              </div>
              <div className="text-[10px] text-neutral-400">{t.playground.single_frame}</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-3">
            <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider flex justify-between items-center">
              <span>{t.playground.presets_title}</span>
              <span className="text-[10px] text-neutral-400">
                {catalog?.items?.length || 2} 项官方场景
              </span>
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

          {/* 2. 运动与交互控制（包含自动环绕、反向、惯性、鼠标跟随、填充） */}
          <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-4">
            <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
              {t.playground.motion_title}
            </div>

            {/* 常用状态切换网格按钮 */}
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={handleAutoCycle}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  autoMode !== "off"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>{t.playground.auto_spin}</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {autoMode === "off"
                    ? t.playground.auto_off
                    : autoMode === "cw"
                      ? t.playground.auto_cw
                      : t.playground.auto_ccw}
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleInvert}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  state?.invert
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>{t.playground.drag_invert}</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {state?.invert ? t.playground.invert_on : t.playground.invert_off}
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleMouseFollow}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  state?.mouseFollow?.enabled
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>{t.playground.mouse_follow}</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {state?.mouseFollow?.enabled ? t.playground.follow_on : t.playground.follow_off}
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleInertia}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  state?.inertia !== false
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>{t.playground.inertia}</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {state?.inertia !== false ? t.playground.inertia_on : t.playground.inertia_off}
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleInvert}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  state?.invert
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>拖拽反向</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {state?.invert ? "已反向" : "常规"}
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleMouseFollow}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  state?.mouseFollow?.enabled
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>鼠标跟随</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {state?.mouseFollow?.enabled ? "开启" : "关闭"}
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleInertia}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  state?.inertia !== false
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>松手惯性</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {state?.inertia !== false ? "平滑阻尼" : "立即停住"}
                </div>
              </button>
            </div>

            {/* 自动转速调节条形尾波滑块 */}
            <div className="space-y-1 pt-1 text-xs">
              <div className="text-neutral-700 dark:text-neutral-300 font-medium">
                {t.playground.auto_speed}
              </div>
              <div className="w-full flex items-center justify-center">
                <WakeSlider
                  bars={32}
                  wake={60}
                  min={2}
                  max={60}
                  step={1}
                  value={Math.round(autoSpeedVal)}
                  formatValue={(v) => `${v}°/s`}
                  onChange={(v) => handleAutoSpeed(v)}
                />
              </div>
            </div>

            {/* 视口排版模式 */}
            {/* 画布排版与比例控制器 */}
            <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                  {t.playground.fit_mode}
                </span>
                <button
                  type="button"
                  onClick={handleToggleFit}
                  className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {state?.fit === "cover" ? t.playground.fit_cover : t.playground.fit_contain}
                </button>
                <button
                  type="button"
                  onClick={handleToggleFit}
                  className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {state?.fit === "cover" ? "铺满 (Cover)" : "完整 (Contain)"}
                </button>
              </div>

              {/* 搬运自 Home 的等比/比例控制器 (16:9, 4:3, 1:1, 9:16) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {t.playground.aspect_ratio}
                  </span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                    {selectedRatio}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60">
                  {ASPECT_RATIOS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedRatio(item.id);
                        showNotice(`画幅已切换至 ${item.label}`);
                        setTimeout(() => orbit.clientRef.current?.resize?.(), 50);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        selectedRatio === item.id
                          ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. 陀螺仪体感控制系统 (Gyroscope Controls) */}
          <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-4">
            <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider flex justify-between items-center">
              <span>{t.playground.gyro_title}</span>
              <span
                className={`text-[10px] font-mono font-semibold ${isGyroOn ? "text-green-600 dark:text-green-400" : "text-neutral-400"}`}
              >
                {isGyroOn ? "CONNECTED" : "STANDBY"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={handleToggleGyro}
                className={`px-3 py-2 rounded-xl transition-all border text-left cursor-pointer ${
                  isGyroOn
                    ? "bg-green-600 text-white border-transparent font-semibold shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <div>{t.playground.gyro_switch}</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {isGyroOn ? "ON" : state?.gyro?.pending ? "PENDING" : "OFF"}
                </div>
              </button>

              <button
                type="button"
                disabled={!isGyroOn}
                onClick={handleCalibrateGyro}
                className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <div>{t.playground.gyro_calibrate}</div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">CALIBRATE</div>
              </button>
            </div>

            {/* 陀螺仪平滑与增益 */}
            <div className="space-y-3 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-700 dark:text-neutral-300">
                  {t.playground.gyro_smooth}
                </span>
                <button
                  type="button"
                  onClick={handleToggleGyroSmooth}
                  className="px-2.5 py-1 rounded-lg font-mono text-[11px] border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {config?.gyro?.smooth !== false ? "平滑 ON" : "原始 RAW"}
                </button>
              </div>

              <div className="space-y-1 pt-1 text-xs">
                <div className="text-neutral-700 dark:text-neutral-300 font-medium">
                  {t.playground.gyro_gain}
                </div>
                <div className="w-full flex items-center justify-center">
                  <WakeSlider
                    bars={30}
                    wake={55}
                    min={0.4}
                    max={3.0}
                    step={0.1}
                    value={Number(gyroGainVal.toFixed(1))}
                    formatValue={(v) => `${Number(v).toFixed(1)}×`}
                    onChange={(v) => handleGyroGain(v)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
