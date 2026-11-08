import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Client } from "@orbit360/javascript/web-client";
import { useFlipFocus } from "./FlipFocusModal";
import { getMaterialBlob, resolveMaterial } from "../lib/materials";
import { beginPress, isSingleClick } from "../lib/card-interaction.js";
import { AUTO_SPIN_DEG_PER_SEC } from "../lib/rotation";

export const Pure3DCard = forwardRef(function Pure3DCard(
  {
    src,
    materialId,
    aspectRatio = "1/1",
    className = "",
    autoSpin = true,
    speed = AUTO_SPIN_DEG_PER_SEC,
    minAngle = -180,
    maxAngle = 180,
    dragSensitivity = 0.42,
    style = {},
    poster,
    onClick,
    onAngleChange,
  },
  ref,
) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const clientRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const pressRef = useRef(null);
  const { isFocused } = useFlipFocus();

  const activeMaterial = resolveMaterial(materialId || src);
  // 未显式传入封面时使用素材注册表里的首帧封面：.orb 解析/下载期间先显示封面，避免空白。
  const posterSrc = poster ?? activeMaterial.cover ?? null;

  useEffect(() => {
    setPosterFailed(false);
  }, [posterSrc]);

  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
    getClient: () => clientRef.current,
    resize: () => clientRef.current?.resize(),
    material: activeMaterial,
  }));

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !activeMaterial.src) return;

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
      client.on("angle", (ev) => {
        if (destroyed) return;
        onAngleChange?.(ev.angle);
      }),
      client.on("ready", () => {
        if (destroyed) return;
        setIsLoaded(true);
      }),
      client.on("error", () => {
        if (destroyed) return;
      }),
    ];

    // 通过全局单例缓存池加载 Blob，相同 materialId 永不重复发起 HTTP 请求
    getMaterialBlob(activeMaterial.id)
      .then((blob) => {
        if (!destroyed && clientRef.current) {
          return clientRef.current.load(blob);
        }
      })
      .catch(() => {});

    return () => {
      destroyed = true;
      offs.forEach((off) => off());
      client.destroy();
      clientRef.current = null;
    };
  }, [activeMaterial.id, minAngle, maxAngle, speed, dragSensitivity]);

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pressRef.current = beginPress(e);
  };

  const handlePointerUp = (e) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (isFocused) return;
    if (isSingleClick(press, e)) onClick?.(e);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pressRef.current = null;
      }}
      style={{
        aspectRatio,
        ...style,
      }}
      className={`relative overflow-hidden rounded-3xl bg-neutral-100 select-none touch-pan-y shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition-shadow duration-300 hover:shadow-[0_30px_70px_rgba(0,0,0,0.25)] cursor-grab active:cursor-grabbing ${className}`}
    >
      <canvas ref={canvasRef} className="h-full w-full block object-cover" />

      {/* 加载期间显示封面；封面自身尚未加载完成时保持空白，避免闪烁骨架。 */}
      {!isLoaded &&
        (posterSrc && !posterFailed ? (
          <img
            src={posterSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
            onError={() => setPosterFailed(true)}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-100/80 pointer-events-none" />
        ))}
    </div>
  );
});
