import React, { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@orbit360/javascript/web-client";
import { AUTO_SPIN_DEG_PER_SEC } from "../lib/rotation";

export function MaskedOrbitViewer({
  src,
  title = "360° MODEL",
  tag = "SPEC",
  maskShape = "none", // "arch" | "squircle" | "pill" | "diamond" | "hex" | "stamp" | "none"
  aspectRatio = "1/1",
  className = "",
  autoSpin = true,
  speed = AUTO_SPIN_DEG_PER_SEC,
  minAngle = -180,
  maxAngle = 180,
  dragSensitivity = 0.42,
  showBadge = true,
  showControls = true,
  accentColor = "#000000",
  bgExpand = "glow", // "glow" | "rings" | "grid" | "stars" | "none"
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const clientRef = useRef(null);

  const [frameIndex, setFrameIndex] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [isAuto, setIsAuto] = useState(autoSpin);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !src) return;

    let destroyed = false;

    const client = new Client(canvasRef.current, {
      container: containerRef.current,
      input: containerRef.current,
      config: {
        video: {
          fit: "cover",
        },
        auto: {
          enabled: autoSpin,
          degPerSec: speed,
        },
        drag: {
          degPerPx: dragSensitivity,
        },
        orbit: {
          minAngle,
          maxAngle,
        },
      },
      autoStartGyro: false,
    });

    clientRef.current = client;

    const offs = [
      client.on("frame", (ev) => {
        if (destroyed) return;
        setFrameIndex(ev.index);
        setFrameCount(ev.count);
      }),
      client.on("ready", (ev) => {
        if (destroyed) return;
        setIsLoaded(true);
        if (ev.state) {
          // state initialized
          setFrameIndex(ev.state.frameIndex || 0);
          setFrameCount(ev.state.frameCount || 0);
        }
      }),
      client.on("error", () => {
        if (destroyed) return;
      }),
    ];

    client.load(src).catch(() => {});

    return () => {
      destroyed = true;
      offs.forEach((off) => off());
      client.destroy();
      clientRef.current = null;
    };
  }, [src, minAngle, maxAngle, speed, dragSensitivity]);

  const toggleAuto = useCallback(() => {
    if (!clientRef.current) return;
    const next = !isAuto;
    clientRef.current.setAuto({ enabled: next });
    setIsAuto(next);
  }, [isAuto]);

  const resetAngle = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.setAngle(0);
  }, []);

  // 遮罩样式映射
  const maskStyleMap = {
    arch: {
      clipPath: "ellipse(48% 50% at 50% 50%)",
      borderRadius: "9999px 9999px 1.5rem 1.5rem",
    },
    squircle: {
      borderRadius: "2.5rem",
    },
    pill: {
      borderRadius: "9999px",
    },
    diamond: {
      clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
    },
    hex: {
      clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
    },
    stamp: {
      clipPath:
        "polygon(0% 0%, 100% 0%, 100% 92%, 94% 96%, 88% 92%, 82% 96%, 76% 92%, 70% 96%, 64% 92%, 58% 96%, 52% 92%, 46% 96%, 40% 92%, 34% 96%, 28% 92%, 22% 96%, 16% 92%, 10% 96%, 4% 92%, 0% 96%)",
      borderRadius: "1rem",
    },
    none: {
      borderRadius: "0.75rem",
    },
  };

  const currentMask = maskStyleMap[maskShape] || maskStyleMap.none;

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 背后扩大内容层 (Background Expanded Layer - 专门衬托透明/3D主体) */}
      <div className="absolute -inset-4 sm:-inset-6 pointer-events-none -z-10 overflow-visible transition-transform duration-500 group-hover:scale-105">
        {bgExpand === "glow" && (
          <div
            className="w-full h-full rounded-full opacity-25 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
            style={{ backgroundColor: accentColor }}
          />
        )}
        {bgExpand === "rings" && (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute w-[115%] h-[115%] rounded-full border border-neutral-300 border-dashed animate-[spin_60s_linear_infinite] opacity-60" />
            <div className="absolute w-[130%] h-[130%] rounded-full border border-neutral-200 opacity-40" />
          </div>
        )}
        {bgExpand === "grid" && (
          <div className="w-full h-full bg-[radial-gradient(#d1d5db_1.2px,transparent_1.2px)] [background-size:12px_12px] opacity-70" />
        )}
        {bgExpand === "stars" && (
          <div className="relative w-full h-full">
            <span className="absolute -top-3 -right-2 font-mono text-sm text-neutral-400 font-bold select-none">
              +
            </span>
            <span className="absolute -bottom-2 -left-2 font-mono text-sm text-neutral-400 font-bold select-none">
              *
            </span>
            <span className="absolute top-1/2 -right-4 font-mono text-xs text-neutral-300 select-none">
              ✦
            </span>
          </div>
        )}
      </div>

      {/* 实体遮罩视窗 */}
      <div
        ref={containerRef}
        style={{
          aspectRatio,
          ...currentMask,
        }}
        className={`relative overflow-hidden border-2 border-neutral-900 bg-neutral-100 select-none touch-pan-y shadow-[4px_4px_0px_#000000] transition-all duration-200 group-hover:shadow-[6px_6px_0px_#000000] group-hover:-translate-y-0.5`}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full block cursor-grab active:cursor-grabbing"
        />

        {/* 顶部标签已禁用 */}
        {showBadge && tag && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none z-10">
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-black text-white rounded">
              {tag}
            </span>
          </div>
        )}

        {/* 加载占位 */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#faf8f5]/90 z-20">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest animate-pulse">
              LOADING 360°...
            </span>
          </div>
        )}

        {/* 底部悬浮控制 */}
        {showControls && isLoaded && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={toggleAuto}
              className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border border-black transition-colors ${
                isAuto ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
              }`}
            >
              {isAuto ? "SPIN" : "PAUSE"}
            </button>
            <button
              type="button"
              onClick={resetAngle}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border border-black bg-white text-black hover:bg-neutral-100 transition-colors"
            >
              RESET
            </button>
          </div>
        )}
      </div>

      {/* 视窗底部标题与元信息 */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono px-0.5">
        <span className="font-bold text-neutral-900 truncate tracking-tight">{title}</span>
        {frameCount > 0 && (
          <span className="text-neutral-500 text-[10px]">
            {frameIndex + 1}/{frameCount}F
          </span>
        )}
      </div>
    </div>
  );
}
