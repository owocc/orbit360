import React, { useRef, useState, useCallback } from "react";
import { Pure3DCard } from "./Pure3DCard";
import { useFlipFocus } from "./FlipFocusModal";

export function HeroCardStack() {
  const cardRefs = useRef({});
  const { focusCard } = useFlipFocus();
  const [activeIndex, setActiveIndex] = useState(2); // 默认中间第3张为当前焦点

  const cards = [
    { id: "c1", materialId: "maid", aspect: "3/4", speed: 10 },
    { id: "c2", materialId: "orbit", aspect: "3/4", speed: 14 },
    { id: "c3", materialId: "maid", aspect: "3/4", speed: -8 },
    { id: "c4", materialId: "orbit", aspect: "3/4", speed: 12 },
    { id: "c5", materialId: "maid", aspect: "3/4", speed: -15 },
  ];

  // 轮播切换下一张 / 上一张
  const nextCard = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % cards.length);
  }, [cards.length]);

  const prevCard = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }, [cards.length]);

  // 移动端手势左右滑动切换
  const touchStartRef = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    // 水平滑动距离大于 40px 且水平位移大于垂直位移，触发左右轮播切换
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextCard();
      else prevCard();
    }
  };

  return (
    <div className="w-full flex flex-col items-center pt-6 sm:pt-8 pb-16 overflow-hidden max-w-full">
      {/* 核心标题区 */}
      <div className="relative text-center max-w-2xl mx-auto mb-8 sm:mb-14 px-4 select-none">
        {/* 左侧用户浮动气泡 */}
        <div className="absolute -top-4 -left-2 sm:-left-16 bg-[#2563eb] text-white text-[11px] sm:text-[12px] font-medium font-sans px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full shadow-md select-none transform -rotate-6">
          @coplin
        </div>

        {/* 右侧用户浮动气泡 */}
        <div className="absolute top-10 -right-2 sm:-right-16 bg-[#22c55e] text-white text-[11px] sm:text-[12px] font-medium font-sans px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full shadow-md select-none transform rotate-6">
          @andrea
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight font-sans">
          A place to display your
          <br />
          masterpiece.
        </h1>
      </div>

      {/* 全屏幕宽度裁剪视窗：左右滑动轮播，卡片大幅放大并具备景深遮罩裁剪 */}
      <div
        id="showcase"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-screen left-1/2 -translate-x-1/2 h-[340px] xs:h-[370px] sm:h-[420px] md:h-[450px] flex items-center justify-center mb-8 sm:mb-12 overflow-hidden select-none cursor-ew-resize"
      >
        {/* 展台中心定位：通过计算相对于 activeIndex 的偏移实现全屏幕居中轮播 */}
        <div className="relative w-full h-full flex items-center justify-center">
          {cards.map((card, i) => {
            // 计算当前卡片相对于活动卡片的偏移量 (-2, -1, 0, 1, 2)
            const offset = i - activeIndex;
            const absOffset = Math.abs(offset);

            // 动态响应式计算：居中放大卡片，两侧卡片层叠倾斜后退
            const rotateDeg = offset * 6;
            const translateY = absOffset * 10;
            const scale = 1 - absOffset * 0.1;
            const zIndex = 30 - absOffset * 5;
            // 移动端卡片水平步长
            const translateX = offset * 140;

            return (
              <div
                key={card.id}
                onClick={() => {
                  // 点击非当前居中卡片直接居中；若已是居中卡片则进入 FLIP 聚焦大图
                  if (offset !== 0) {
                    setActiveIndex(i);
                  } else {
                    const cardHandle = cardRefs.current[card.id];
                    const containerEl = cardHandle?.getContainer();
                    if (containerEl) {
                      focusCard(
                        {
                          id: card.id,
                          clientRef: { current: cardHandle.getClient() },
                        },
                        containerEl,
                      );
                    }
                  }
                }}
                style={{
                  transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotateDeg}deg) scale(${scale})`,
                  zIndex,
                  opacity: absOffset > 2 ? 0 : 1,
                  pointerEvents: absOffset > 2 ? "none" : "auto",
                }}
                className="absolute w-52 xs:w-56 sm:w-64 md:w-72 aspect-[3/4] transition-all duration-500 ease-out cursor-pointer"
              >
                <Pure3DCard
                  ref={(el) => (cardRefs.current[card.id] = el)}
                  materialId={card.materialId}
                  aspectRatio={card.aspect}
                  speed={card.speed}
                  autoSpin={offset === 0}
                  className="w-full h-full shadow-[0_25px_60px_rgba(0,0,0,0.22)]"
                />
              </div>
            );
          })}
        </div>

        {/* 左右滑动手势指示器与切卡按钮 */}
        <button
          type="button"
          onClick={prevCard}
          aria-label="Previous card"
          className="absolute left-3 sm:left-8 z-40 w-9 h-9 rounded-full bg-white/70 dark:bg-neutral-900/70 hover:bg-white dark:hover:bg-neutral-800 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-md flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition-all opacity-70 hover:opacity-100"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={nextCard}
          aria-label="Next card"
          className="absolute right-3 sm:right-8 z-40 w-9 h-9 rounded-full bg-white/70 dark:bg-neutral-900/70 hover:bg-white dark:hover:bg-neutral-800 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-md flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition-all opacity-70 hover:opacity-100"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 轮播圆点指示器 */}
      <div className="flex items-center gap-1.5 mb-8">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === activeIndex
                ? "w-6 bg-neutral-900 dark:bg-white"
                : "w-1.5 bg-neutral-300 dark:bg-neutral-700"
            }`}
          />
        ))}
      </div>

      {/* 底部极简小副标题与双按钮 */}
      <div className="text-center max-w-md mx-auto space-y-6 px-4">
        <p className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
          Artists can display their masterpieces, and buyers can discover and purchase works that
          resonate with them.
        </p>

        <div className="flex items-center justify-center gap-3">
          <a
            href="#gallery"
            className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm font-sans"
          >
            Explore 360°
          </a>
          <a
            href="#features"
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors font-sans"
          >
            Read more
          </a>
        </div>
      </div>
    </div>
  );
}
