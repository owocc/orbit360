import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Pure3DCard } from "./Pure3DCard";

export const LazyCoverCard = forwardRef(function LazyCoverCard(
  { src, coverSrc, aspectRatio = "3/4", speed = 12, className = "", style = {}, onFocusRequest },
  ref,
) {
  const [isActivated, setIsActivated] = useState(false);
  const cardRef = useRef(null);
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getContainer: () => (isActivated ? cardRef.current?.getContainer() : containerRef.current),
    getClient: () => cardRef.current?.getClient(),
    resize: () => cardRef.current?.resize(),
  }));

  const handlePointerDown = () => {
    if (!isActivated) {
      setIsActivated(true);
      setTimeout(() => {
        onFocusRequest?.(cardRef.current);
      }, 50);
    } else {
      onFocusRequest?.(cardRef.current);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      style={{
        aspectRatio,
        ...style,
      }}
      className={`relative w-full rounded-3xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 select-none shadow-[0_20px_50px_rgba(0,0,0,0.14)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.22)] transition-shadow duration-300 cursor-pointer group ${className}`}
    >
      {isActivated ? (
        <Pure3DCard
          ref={cardRef}
          src={src}
          aspectRatio={aspectRatio}
          speed={speed}
          className="w-full h-full rounded-3xl"
          onClick={() => onFocusRequest?.(cardRef.current)}
        />
      ) : (
        <div className="relative w-full h-full overflow-hidden">
          {/* 轻量静态 Cover 图片 */}
          <img
            src={coverSrc}
            alt="360 specimen preview"
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

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
