import React, { useRef } from "react";
import { Pure3DCard } from "./Pure3DCard";
import { useFlipFocus } from "./FlipFocusModal";

export function HeroCardStack() {
  const cardRefs = useRef({});
  const { focusCard } = useFlipFocus();

  const cards = [
    {
      id: "c1",
      src: "assets/maid/scene.orb",
      aspect: "3/4",
      speed: 10,
      rotate: "-12deg",
      translateY: "15px",
      zIndex: 10,
    },
    {
      id: "c2",
      src: "assets/orbit/scene.orb",
      aspect: "3/4",
      speed: 14,
      rotate: "-6deg",
      translateY: "5px",
      zIndex: 15,
    },
    {
      id: "c3",
      src: "assets/maid/scene.orb",
      aspect: "3/4",
      speed: -8,
      rotate: "0deg",
      translateY: "0px",
      zIndex: 20,
    },
    {
      id: "c4",
      src: "assets/orbit/scene.orb",
      aspect: "3/4",
      speed: 12,
      rotate: "6deg",
      translateY: "5px",
      zIndex: 15,
    },
    {
      id: "c5",
      src: "assets/maid/scene.orb",
      aspect: "3/4",
      speed: -15,
      rotate: "12deg",
      translateY: "15px",
      zIndex: 10,
    },
  ];

  return (
    <div className="w-full flex flex-col items-center pt-8 pb-16 px-4">
      {/* 核心标题区 */}
      <div className="relative text-center max-w-2xl mx-auto mb-14">
        {/* 左侧用户浮动气泡 */}
        <div className="absolute -top-4 -left-6 sm:-left-16 bg-[#2563eb] text-white text-[12px] font-medium font-sans px-3.5 py-1 rounded-full shadow-md select-none transform -rotate-6">
          @coplin
        </div>

        {/* 右侧用户浮动气泡 */}
        <div className="absolute top-10 -right-4 sm:-right-16 bg-[#22c55e] text-white text-[12px] font-medium font-sans px-3.5 py-1 rounded-full shadow-md select-none transform rotate-6">
          @andrea
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight font-sans">
          A place to display your
          <br />
          masterpiece.
        </h1>
      </div>

      {/* 中心扇形重叠卡片展台 */}
      <div
        id="showcase"
        className="relative w-full max-w-4xl h-[320px] sm:h-[360px] flex items-center justify-center mb-14 select-none"
      >
        <div className="flex items-center justify-center -space-x-8 sm:-space-x-12">
          {cards.map((card) => (
            <div
              key={card.id}
              style={{
                transform: `rotate(${card.rotate}) translateY(${card.translateY})`,
                zIndex: card.zIndex,
              }}
              className="w-36 sm:w-44 lg:w-48 aspect-[3/4] transition-transform duration-300 hover:!-translate-y-6 hover:!rotate-0 cursor-pointer"
            >
              <Pure3DCard
                ref={(el) => (cardRefs.current[card.id] = el)}
                src={card.src}
                aspectRatio={card.aspect}
                speed={card.speed}
                className="w-full h-full"
                onClick={() => {
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
          ))}
        </div>
      </div>

      {/* 底部极简小副标题与双按钮 */}
      <div className="text-center max-w-md mx-auto space-y-6">
        <p className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
          Artists can display their masterpieces, and buyers can discover and purchase works that
          resonate with them.
        </p>

        <div className="flex items-center justify-center gap-3">
          <a
            href="#gallery"
            className="px-6 py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm font-sans"
          >
            Explore 360°
          </a>
          <a
            href="#features"
            className="px-5 py-2.5 rounded-full text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors font-sans"
          >
            Read more
          </a>
        </div>
      </div>
    </div>
  );
}
