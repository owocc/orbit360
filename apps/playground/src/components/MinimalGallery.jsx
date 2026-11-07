import React, { useRef } from "react";
import { Pure3DCard } from "./Pure3DCard";
import { useFlipFocus } from "./FlipFocusModal";

export function MinimalGallery() {
  const cardRefs = useRef({});
  const { focusCard } = useFlipFocus();

  const items = [
    {
      id: "g1",
      src: "/assets/maid/scene.orb",
      aspect: "1/1",
      speed: 12,
    },
    {
      id: "g2",
      src: "/assets/orbit/scene.orb",
      aspect: "4/5",
      speed: -10,
    },
    {
      id: "g3",
      src: "/assets/maid/scene.orb",
      aspect: "3/4",
      speed: 16,
    },
    {
      id: "g4",
      src: "/assets/orbit/scene.orb",
      aspect: "16/10",
      speed: 8,
    },
  ];

  return (
    <section
      id="gallery"
      className="w-full pt-16 pb-20 px-6 sm:px-12 border-t border-neutral-100 dark:border-neutral-900"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-sm mx-auto mb-12">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans">
            Pure Canvas Specimens
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 font-sans">
            Different aspect ratios with zero text pollution. Drag horizontally to interact.
          </p>
        </div>

        {/* 响应式多尺寸网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
          {items.map((item) => (
            <div key={item.id} className="w-full aspect-[3/4] cursor-pointer">
              <Pure3DCard
                ref={(el) => (cardRefs.current[item.id] = el)}
                src={item.src}
                aspectRatio={item.aspect}
                speed={item.speed}
                className="w-full h-full"
                onClick={() => {
                  const cardHandle = cardRefs.current[item.id];
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
    </section>
  );
}
