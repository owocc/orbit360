import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Pure3DCard } from "./Pure3DCard";
import { resolveMaterial } from "../lib/materials";

export const LazyCoverCard = forwardRef(function LazyCoverCard(
  {
    src,
    materialId,
    coverSrc,
    title,
    subtitle,
    badge,
    aspectRatio = "3/4",
    speed = 12,
    className = "",
    style = {},
    onFocusRequest,
  },
  ref,
) {
  const [isActivated, setIsActivated] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const cardRef = useRef(null);
  const containerRef = useRef(null);
  const pressRef = useRef(null);

  const material = resolveMaterial(materialId || src);
  const actualCover = coverSrc === undefined ? material.cover : coverSrc;
  const displayTitle = title || material.title;

  useImperativeHandle(ref, () => ({
    getContainer: () => (isActivated ? cardRef.current?.getContainer() : containerRef.current),
    getClient: () => cardRef.current?.getClient(),
    resize: () => cardRef.current?.resize(),
    material,
  }));

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pressRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
      pointerId: event.pointerId,
    };
    // 首次按下只负责把静态封面切换成可交互 Canvas，不立即打开弹窗。
    if (!isActivated) setIsActivated(true);
  };

  const handlePointerUp = (event) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    pressRef.current = null;

    const duration = Date.now() - press.time;
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    // 拖拽或长按（>500ms）不视为单击，不打开弹窗。
    if (duration > 500 || distance > 8) return;

    requestAnimationFrame(() => onFocusRequest?.(cardRef.current));
  };

  const handlePointerCancel = () => {
    pressRef.current = null;
  };

  const cardCaption = (
    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent text-white pointer-events-none">
      <div className="text-sm font-semibold leading-snug">{displayTitle}</div>
      {subtitle ? (
        <div className="mt-0.5 font-mono text-[10px] text-white/70">{subtitle}</div>
      ) : null}
    </div>
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        aspectRatio,
        ...style,
      }}
      className={`relative w-full rounded-3xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 select-none shadow-[0_20px_50px_rgba(0,0,0,0.14)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.22)] transition-shadow duration-300 cursor-pointer group ${className}`}
    >
      {isActivated ? (
        <div className="relative w-full h-full">
          <Pure3DCard
            ref={cardRef}
            materialId={src ? undefined : material.id}
            src={src}
            poster={actualCover || undefined}
            aspectRatio={aspectRatio}
            speed={speed}
            className="w-full h-full rounded-3xl"
          />
          {cardCaption}
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden">
          {actualCover && !coverFailed ? (
            <>
              <img
                src={actualCover}
                alt={displayTitle}
                loading="lazy"
                onError={() => setCoverFailed(true)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {cardCaption}
            </>
          ) : (
            <div className="w-full h-full bg-[radial-gradient(circle_at_30%_20%,#3b82f6_0%,#1e293b_45%,#0f172a_100%)] flex flex-col justify-between p-5 text-white">
              {badge ? (
                <span className="self-start rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] tracking-wider backdrop-blur-sm">
                  {badge}
                </span>
              ) : null}
              <div className="space-y-1">
                <div className="text-lg font-semibold leading-snug">{displayTitle}</div>
                {subtitle ? (
                  <div className="font-mono text-[11px] text-white/60">{subtitle}</div>
                ) : null}
              </div>
            </div>
          )}

          {/* 交互提示微型徽章 */}
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md flex items-center justify-center text-neutral-800 dark:text-white shadow-md transform group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
