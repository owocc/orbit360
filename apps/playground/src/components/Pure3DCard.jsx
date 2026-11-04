import React, { useEffect, useRef, useState } from "react";
import { Client } from "@orbit360/javascript/web-client";

export function Pure3DCard({
  src,
  aspectRatio = "1/1",
  className = "",
  autoSpin = true,
  speed = 12,
  minAngle = -180,
  maxAngle = 180,
  dragSensitivity = 0.42,
  style = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const clientRef = useRef(null);
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
      client.on("ready", () => {
        if (destroyed) return;
        setIsLoaded(true);
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

  return (
    <div
      ref={containerRef}
      style={{
        aspectRatio,
        ...style,
      }}
      className={`relative overflow-hidden rounded-3xl bg-neutral-100 select-none shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition-all duration-300 hover:shadow-[0_30px_70px_rgba(0,0,0,0.25)] hover:scale-105 hover:z-30 cursor-grab active:cursor-grabbing ${className}`}
    >
      <canvas ref={canvasRef} className="h-full w-full block object-cover" />

      {/* 极轻微骨架占位 */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-neutral-100/80 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
