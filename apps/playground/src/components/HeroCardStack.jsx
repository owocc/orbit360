import React, { useRef, useState, useCallback, useEffect } from "react";
import { Pure3DCard } from "./Pure3DCard";
import { useFlipFocus } from "./FlipFocusModal";
import * as m from "../paraglide/messages.js";
import { ClientOnly } from "./ui/ClientOnly";
export function HeroCardStack() {
  const cardRefs = useRef({});
  const { focusCard } = useFlipFocus();
  const [activeIndex, setActiveIndex] = useState(2); // 默认中间第3张为当前焦点

  // 统一服务端渲染基准宽度为 1200，挂载后再同步真实窗口宽度，避免水合失配
  const [windowWidth, setWindowWidth] = useState(1200);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const cards = [
    { id: "c1", materialId: "maid", aspect: "3/4" },
    { id: "c2", materialId: "orbit", aspect: "3/4" },
    { id: "c3", materialId: "maid", aspect: "3/4" },
    { id: "c4", materialId: "orbit", aspect: "3/4" },
    { id: "c5", materialId: "maid", aspect: "3/4" },
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

  // 保持始终互相物理层叠（Stacked Overlap）：步长小于卡片宽度（留出约 40% ~ 50% 的重叠区）
  const getStepX = () => {
    if (windowWidth >= 1280) return 175; // 大屏卡片宽约 256px，步长 175px，产生 80px 明显重叠
    if (windowWidth >= 1024) return 155; // 笔记本卡片宽约 240px，步长 155px，产生 85px 重叠
    if (windowWidth >= 768) return 140; // 平板卡片宽约 224px，步长 140px，产生 84px 重叠
    if (windowWidth >= 480) return 115; // 移动大屏步长 115px
    return 95; // 手机屏幕步长 95px，卡片宽 176px，叠合感强
  };
  const stepX = getStepX();

  return (
    <div className="w-full flex flex-col items-center pt-6 sm:pt-10 pb-20 overflow-x-clip max-w-full">
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
          {m.hero_title_1()}
          <br />
          {m.hero_title_2()}
        </h1>
      </div>

      {/* 限制整体展台的最大宽度 max-w-6xl，卡片尺寸收敛克制，整体沉稳高级 */}
      <div
        id="showcase"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-6xl mx-auto h-[360px] xs:h-[390px] sm:h-[430px] md:h-[460px] lg:h-[480px] flex items-center justify-center mb-8 sm:mb-10 select-none cursor-ew-resize overflow-visible"
      >
        {/* 展台中心定位：通过计算相对于 activeIndex 的偏移实现全屏幕居中轮播 */}
        <ClientOnly
          fallback={
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="w-44 xs:w-48 sm:w-56 md:w-60 lg:w-64 max-w-[280px] aspect-[3/4] rounded-3xl bg-neutral-100 dark:bg-neutral-800/60 shadow-xl" />
            </div>
          }
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {cards.map((card, i) => {
              const offset = i - activeIndex;
              const absOffset = Math.abs(offset);

              // 动态响应式计算：居中放大卡片，两侧卡片层叠倾斜后退
              const rotateDeg = offset * (windowWidth >= 1024 ? 5.5 : 7);
              const translateY = absOffset * (windowWidth >= 1024 ? 10 : 12);
              const scale = 1 - absOffset * 0.06;
              const zIndex = 30 - absOffset * 5;
              const translateX = offset * stepX;

              return (
                <div
                  key={card.id}
                  style={{
                    transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotateDeg}deg) scale(${scale})`,
                    zIndex,
                    opacity: absOffset > 2 ? 0 : 1,
                    pointerEvents: absOffset > 2 ? "none" : "auto",
                  }}
                  className="absolute w-44 xs:w-48 sm:w-56 md:w-60 lg:w-64 max-w-[280px] aspect-[3/4] transition-all duration-500 ease-out cursor-pointer group"
                >
                  {/* 强化全局与底部接触阴影：采用环境泛光 + 底部投射阴影，保证浅色与深色背景下均立体透出 */}
                  <div
                    className={`absolute inset-0 rounded-3xl pointer-events-none transition-all duration-500 ${
                      offset === 0
                        ? "shadow-[0_20px_45px_-8px_rgba(0,0,0,0.22),0_10px_20px_-6px_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_24px_50px_-10px_rgba(0,0,0,0.75),0_12px_24px_-6px_rgba(0,0,0,0.65)]"
                        : "shadow-[0_14px_30px_-8px_rgba(0,0,0,0.16),0_6px_14px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.6)]"
                    }`}
                  />

                  <Pure3DCard
                    ref={(el) => (cardRefs.current[card.id] = el)}
                    materialId={card.materialId}
                    aspectRatio={card.aspect}
                    autoSpin={offset === 0}
                    className="w-full h-full !shadow-none"
                    onClick={() => {
                      // 单击非当前卡片直接居中；单击居中卡片进入 FLIP 聚焦；拖拽不触发。
                      if (offset !== 0) {
                        setActiveIndex(i);
                        return;
                      }
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
                    }}
                  />
                </div>
              );
            })}
          </div>
        </ClientOnly>
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
          {m.hero_subtitle()}
        </p>

        <div className="flex items-center justify-center gap-3">
          <a
            href="#gallery"
            className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm font-sans"
          >
            {m.hero_explore()}
          </a>
          <a
            href="#features"
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors font-sans"
          >
            {m.hero_read_more()}
          </a>
        </div>
      </div>
    </div>
  );
}
