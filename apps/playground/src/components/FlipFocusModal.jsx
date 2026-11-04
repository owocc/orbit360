import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import gsap from "gsap";

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
  const activeCardElRef = useRef(null);
  const placeholderElRef = useRef(null);
  const savedStylesRef = useRef({});
  const isAnimatingRef = useRef(false);

  const focusCard = (item, cardElement) => {
    // 已经处于放大状态或正在动画中，绝不重复触发
    if (isAnimatingRef.current || activeCardElRef.current || !cardElement) return;
    isAnimatingRef.current = true;
    activeCardElRef.current = cardElement;

    // 1. 获取卡片当前在视口中的绝对几何信息
    const rect = cardElement.getBoundingClientRect();
    const parent = cardElement.parentElement;

    // 2. 在原位置插入不可见占位符，保持父容器 flex/grid 布局绝对稳定
    const placeholder = document.createElement("div");
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.visibility = "hidden";
    placeholder.style.pointerEvents = "none";
    placeholder.style.flexShrink = "0";
    parent.insertBefore(placeholder, cardElement);
    placeholderElRef.current = placeholder;

    // 3. 记录卡片原内联样式以便归位完全恢复
    savedStylesRef.current = {
      position: cardElement.style.position,
      top: cardElement.style.top,
      left: cardElement.style.left,
      width: cardElement.style.width,
      height: cardElement.style.height,
      transform: cardElement.style.transform,
      zIndex: cardElement.style.zIndex,
      transition: cardElement.style.transition,
    };

    // 4. 将卡片临时挂载到 document.body，定位到它当前精确视口位置
    cardElement.style.transition = "none";
    cardElement.style.position = "fixed";
    cardElement.style.top = `${rect.top}px`;
    cardElement.style.left = `${rect.left}px`;
    cardElement.style.width = `${rect.width}px`;
    cardElement.style.height = `${rect.height}px`;
    cardElement.style.zIndex = "9999";
    cardElement.style.margin = "0";
    document.body.appendChild(cardElement);

    // 5. 激活背景暗化层
    setActiveItem(item);

    // 6. 计算屏幕正中央大视口目标尺寸与位置
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const targetW = Math.min(viewportW * 0.88, 440);
    const targetH = Math.min(targetW * (4 / 3), viewportH * 0.82);
    const finalW = targetH * (3 / 4);
    const targetTop = (viewportH - targetH) / 2;
    const targetLeft = (viewportW - finalW) / 2;

    // 7. 使用 GSAP 平滑补间位移与尺寸
    gsap.to(cardElement, {
      top: targetTop,
      left: targetLeft,
      width: finalW,
      height: targetH,
      rotation: 0,
      duration: 0.55,
      ease: "power3.inOut",
      onUpdate: () => {
        item.clientRef?.current?.resize?.();
      },
      onComplete: () => {
        item.clientRef?.current?.resize?.();
        isAnimatingRef.current = false;
      },
    });
  };

  const closeFocus = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const cardEl = activeCardElRef.current;
    const placeholder = placeholderElRef.current;

    // 防止连击或无有效节点
    if (isAnimatingRef.current || !cardEl || !placeholder) return;
    isAnimatingRef.current = true;

    // 1. 获取占位符当前在视口中的最新位置
    const origRect = placeholder.getBoundingClientRect();

    // 2. 从中央平滑补间回原始占位符坐标
    gsap.to(cardEl, {
      top: origRect.top,
      left: origRect.left,
      width: origRect.width,
      height: origRect.height,
      rotation: 0,
      duration: 0.45,
      ease: "power3.inOut",
      onUpdate: () => {
        activeItem?.clientRef?.current?.resize?.();
      },
      onComplete: () => {
        // 3. 放回原父节点占位符之前，恢复原样式
        const parent = placeholder.parentElement;
        if (parent) {
          parent.insertBefore(cardEl, placeholder);
          parent.removeChild(placeholder);
        }

        const saved = savedStylesRef.current;
        cardEl.style.position = saved.position || "";
        cardEl.style.top = saved.top || "";
        cardEl.style.left = saved.left || "";
        cardEl.style.width = saved.width || "";
        cardEl.style.height = saved.height || "";
        cardEl.style.transform = saved.transform || "";
        cardEl.style.zIndex = saved.zIndex || "";
        cardEl.style.transition = saved.transition || "";
        cardEl.style.margin = "";

        activeItem?.clientRef?.current?.resize?.();

        placeholderElRef.current = null;
        activeCardElRef.current = null;
        setActiveItem(null);
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
    <FlipFocusContext.Provider
      value={{ focusCard, closeFocus, activeItem, isFocused: !!activeItem }}
    >
      {children}

      {/* 背景暗化遮罩与快捷关闭按钮 */}
      {activeItem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9990] pointer-events-auto">
          {/* 背景模糊与变暗：同时支持 onPointerDown 与 onClick，阻止冒泡 */}
          <div
            onPointerDown={(e) => closeFocus(e)}
            className="fixed inset-0 bg-black/45 dark:bg-black/75 backdrop-blur-md transition-opacity duration-300 cursor-zoom-out"
          />

          {/* 右上角关闭按钮 */}
          <button
            type="button"
            onPointerDown={(e) => closeFocus(e)}
            className="fixed top-6 right-6 z-[10000] w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer"
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
      )}
    </FlipFocusContext.Provider>
  );
}
