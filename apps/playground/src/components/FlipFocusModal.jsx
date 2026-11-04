import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

const FlipFocusContext = createContext(null);

export function useFlipFocus() {
  const ctx = useContext(FlipFocusContext);
  if (!ctx) {
    throw new Error("useFlipFocus must be used within a FlipFocusProvider");
  }
  return ctx;
}

export function FlipFocusProvider({ children }) {
  const [activeItem, setActiveItem] = useState(null);
  const originWrapperRef = useRef(null);
  const targetSlotRef = useRef(null);
  const movingCardRef = useRef(null);
  const backdropRef = useRef(null);
  const isAnimatingRef = useRef(false);

  const focusCard = (item, cardElement) => {
    if (isAnimatingRef.current || !cardElement) return;
    isAnimatingRef.current = true;

    movingCardRef.current = cardElement;
    originWrapperRef.current = cardElement.parentElement;

    // 1. 记录被点击卡片（包含其 canvas 背景与圆角）的原始位置尺寸与旋转
    const state = Flip.getState(cardElement);

    // 2. 挂载弹窗外层（注意：targetSlotRef 此时是完全透明的，无任何白色背景或白框）
    setActiveItem(item);

    requestAnimationFrame(() => {
      if (!targetSlotRef.current || !movingCardRef.current) {
        isAnimatingRef.current = false;
        return;
      }

      // 3. 将原卡片（带着自己的背景和已渲染的 Canvas）直接迁移进目标容器
      targetSlotRef.current.appendChild(movingCardRef.current);

      // 设置为填满目标容器尺寸，由卡片自己展示背景与阴影
      movingCardRef.current.style.width = "100%";
      movingCardRef.current.style.height = "100%";
      movingCardRef.current.style.transform = "none";

      // 4. 背景暗化与模糊同步平滑淡入，不再有预先出现的白底
      if (backdropRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: "power2.out" },
        );
      }

      // 5. 让卡片自己（包含 Canvas 与其背景）作为动画主体，直接平滑过渡并居中展开
      Flip.from(state, {
        targets: movingCardRef.current,
        duration: 0.55,
        ease: "power3.inOut",
        scale: true,
        onUpdate: () => {
          item.clientRef?.current?.resize?.();
        },
        onComplete: () => {
          item.clientRef?.current?.resize?.();
          isAnimatingRef.current = false;
        },
      });
    });
  };

  const closeFocus = () => {
    if (isAnimatingRef.current || !movingCardRef.current || !originWrapperRef.current) {
      setActiveItem(null);
      return;
    }

    isAnimatingRef.current = true;

    // 1. 记录居中放大卡片的状态
    const state = Flip.getState(movingCardRef.current);

    // 2. 将同一个卡片放回原列表父容器中
    originWrapperRef.current.appendChild(movingCardRef.current);

    movingCardRef.current.style.width = "";
    movingCardRef.current.style.height = "";
    movingCardRef.current.style.transform = "";

    // 背景同步淡出
    if (backdropRef.current) {
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
      });
    }

    // 3. 卡片带着自己的背景与 Canvas 从中央平滑收缩归位
    Flip.from(state, {
      targets: movingCardRef.current,
      duration: 0.5,
      ease: "power3.inOut",
      scale: true,
      onUpdate: () => {
        activeItem?.clientRef?.current?.resize?.();
      },
      onComplete: () => {
        activeItem?.clientRef?.current?.resize?.();
        setActiveItem(null);
        movingCardRef.current = null;
        originWrapperRef.current = null;
        isAnimatingRef.current = false;
      },
    });
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeFocus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeItem]);

  return (
    <FlipFocusContext.Provider value={{ focusCard, closeFocus, activeItem }}>
      {children}

      {/* 居中浮层（外层彻底透明，无任何白底或弹窗盒模型） */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        >
          {/* 背景高斯模糊与暗化遮罩 */}
          <div
            ref={backdropRef}
            onClick={closeFocus}
            className="fixed inset-0 bg-black/45 dark:bg-black/75 backdrop-blur-md transition-opacity duration-300 pointer-events-auto"
          />

          {/* 纯透明几何尺寸占位框：不带背景、不带阴影、不带边框，完全由过渡过去的卡片自己承载 */}
          <div className="relative z-10 w-full max-w-[400px] sm:max-w-[440px] max-h-[82vh] aspect-[3/4] bg-transparent pointer-events-none">
            {/* 目标插槽：点击时将同一个卡片 DOM 节点真实 append 到这里 */}
            <div ref={targetSlotRef} className="w-full h-full relative pointer-events-auto" />

            {/* 右上角关闭按钮 */}
            <button
              type="button"
              onClick={closeFocus}
              className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-colors pointer-events-auto shadow-sm"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </FlipFocusContext.Provider>
  );
}
