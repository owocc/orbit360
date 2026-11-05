import React, { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@orbit360/javascript/web-client";

export function OrbitViewer({
  src,
  title = "360° 视图",
  autoSpin = true,
  aspectRatio = "16/9",
  className = "",
  showControls = true,
  showBadge = true,
  initialAngle = 0,
  minAngle = -180,
  maxAngle = 180,
  speed = 14,
  dragSensitivity = 0.42,
  onAngleChange,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const clientRef = useRef(null);

  // angle state removed
  const [frameIndex, setFrameIndex] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [isAuto, setIsAuto] = useState(autoSpin);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !src) return;

    let destroyed = false;

    const client = new Client(canvasRef.current, {
      container: containerRef.current,
      input: containerRef.current,
      config: {
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
      client.on("angle", (ev) => {
        if (destroyed) return;
        onAngleChange?.(Math.round(ev.angle));
      }),
      client.on("frame", (ev) => {
        if (destroyed) return;
        setFrameIndex(ev.index);
        setFrameCount(ev.count);
      }),
      client.on("ready", (ev) => {
        if (destroyed) return;
        setIsLoaded(true);
        if (ev.state) {
          // initialized
          setFrameIndex(ev.state.frameIndex || 0);
          setFrameCount(ev.state.frameCount || 0);
        }
      }),
      client.on("error", (err) => {
        if (destroyed) return;
        console.error("OrbitViewer SDK error:", err);
        setError("加载资源失败");
      }),
    ];

    client.load(src).catch(() => {
      if (!destroyed) setError("解析场景包失败");
    });

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

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/90 select-none group ${className}`}
      style={{ aspectRatio }}
    >
      <canvas ref={canvasRef} className="h-full w-full block cursor-grab active:cursor-grabbing" />

      {/* 状态徽标 */}
      {showBadge && (
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-neutral-900/90 border border-neutral-800 text-neutral-300 backdrop-blur-sm">
            {title}
          </span>
          {frameCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-950/80 border border-neutral-800 text-neutral-500">
              {frameIndex + 1}/{frameCount}F
            </span>
          )}
        </div>
      )}

      {/* 交互提示 */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 backdrop-blur-xs">
          <div className="text-center font-mono text-xs text-neutral-400">
            <span className="inline-block animate-pulse">加载二进制帧数据...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/90 text-neutral-400 font-mono text-xs">
          <span>{error}</span>
        </div>
      )}

      {/* 底部浮动微控制器 */}
      {showControls && isLoaded && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={toggleAuto}
            className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
              isAuto
                ? "bg-neutral-800 border-neutral-700 text-neutral-100"
                : "bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isAuto ? "自旋: 开" : "自旋: 关"}
          </button>
          <button
            type="button"
            onClick={resetAngle}
            className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-800 bg-neutral-900/90 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
          >
            归零
          </button>
        </div>
      )}
    </div>
  );
}
