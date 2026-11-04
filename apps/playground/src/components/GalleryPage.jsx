import React, { useRef } from "react";
import { LazyCoverCard } from "./LazyCoverCard";
import { useFlipFocus } from "./FlipFocusModal";

export default function GalleryPage() {
  const cardRefs = useRef({});
  const { focusCard } = useFlipFocus();

  // 瀑布流画廊数据集：提供不同高宽比，模拟错落有致的瀑布流效果
  const galleryItems = [
    {
      id: "gal-1",
      materialId: "maid",
      aspect: "3/4",
      speed: 12,
    },
    {
      id: "gal-2",
      materialId: "orbit",
      aspect: "1/1",
      speed: -10,
    },
    {
      id: "gal-3",
      materialId: "maid",
      aspect: "4/5",
      speed: 14,
    },
    {
      id: "gal-4",
      materialId: "orbit",
      aspect: "9/16",
      speed: 8,
    },
    {
      id: "gal-5",
      materialId: "maid",
      aspect: "1/1",
      speed: -15,
    },
    {
      id: "gal-6",
      materialId: "orbit",
      aspect: "3/4",
      speed: 16,
    },
    {
      id: "gal-7",
      materialId: "maid",
      aspect: "16/10",
      speed: 10,
    },
    {
      id: "gal-8",
      materialId: "orbit",
      aspect: "4/5",
      speed: -12,
    },
    {
      id: "gal-9",
      materialId: "maid",
      aspect: "3/4",
      speed: 15,
    },
  ];

  return (
    <div className="w-full pt-10 pb-24 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* 头部标题区域 */}
      <div className="text-center max-w-xl mx-auto mb-14">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans">
          Specimen Waterfall
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2.5 font-sans leading-relaxed">
          On-demand loaded gallery in masonry layout. Cards load purely static cover preview first,
          and instantiate 360° Canvas on demand.
        </p>
      </div>

      {/* 瀑布流布局 (CSS 多列 Masonry Columns) */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
        {galleryItems.map((item) => (
          <div key={item.id} className="break-inside-avoid w-full">
            <LazyCoverCard
              ref={(el) => (cardRefs.current[item.id] = el)}
              materialId={item.materialId}
              aspectRatio={item.aspect}
              speed={item.speed}
              onFocusRequest={(cardHandle) => {
                const containerEl = cardHandle?.getContainer();
                if (containerEl) {
                  focusCard(
                    {
                      id: item.id,
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
  );
}
