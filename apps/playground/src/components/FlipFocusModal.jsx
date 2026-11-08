import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useFullscreen } from "../hooks/useFullscreen";
import * as m from "../paraglide/messages.js";

const FlipFocusContext = createContext(null);
const FOCUS_RADIUS = "24px";

function readAspectRatio(element, item) {
  const fromItem = Number(item?.aspectRatio);
  if (fromItem > 0) return fromItem;
  const raw = element?.style?.aspectRatio;
  if (raw) {
    const [width, height] = raw.split("/").map(Number);
    if (width > 0 && height > 0) return width / height;
    const numeric = Number.parseFloat(raw);
    if (numeric > 0) return numeric;
  }
  return 3 / 4;
}

export function useFlipFocus() {
  const ctx = useContext(FlipFocusContext);
  if (!ctx) {
    throw new Error("useFlipFocus must be used within a FlipFocusProvider");
  }
  return ctx;
}

function toolbarIconButtonClass(active = false) {
  return `pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer ${
    active
      ? "border-white/30 bg-white/90 text-neutral-900 hover:bg-white"
      : "border-white/20 bg-black/55 text-white/90 hover:bg-black/75"
  }`;
}

export function FlipFocusProvider({ children }) {
  const [activeItem, setActiveItem] = useState(null);
  const [gyroState, setGyroState] = useState(null);
  const [autoState, setAutoState] = useState(null);
  const activeCardElRef = useRef(null);
  const stageElRef = useRef(null);
  const placeholderElRef = useRef(null);
  const savedStylesRef = useRef({});
  const savedRadiiRef = useRef([]);
  const focusedRectRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const isClosingRef = useRef(false);
  const wasFullscreenRef = useRef(false);

  const resizeActive = useCallback(() => {
    activeItem?.clientRef?.current?.resize?.();
  }, [activeItem]);

  // 全屏铺满时去掉卡片内部所有圆角（含 SDK 画布容器），退出时逐个还原。
  const stripRadius = (root) => {
    const saved = [];
    root.querySelectorAll("*").forEach((el) => {
      const style = getComputedStyle(el);
      const hasRadius =
        parseFloat(style.borderTopLeftRadius) > 0 ||
        parseFloat(style.borderTopRightRadius) > 0 ||
        parseFloat(style.borderBottomLeftRadius) > 0 ||
        parseFloat(style.borderBottomRightRadius) > 0;
      if (!hasRadius) return;
      saved.push([el, el.style.borderRadius]);
      el.style.borderRadius = "0";
    });
    savedRadiiRef.current = saved;
  };

  const restoreRadius = () => {
    savedRadiiRef.current.forEach(([el, value]) => {
      el.style.borderRadius = value;
    });
    savedRadiiRef.current = [];
  };

  // 与 playground 路由共用同一套全屏逻辑（原生 Fullscreen API + iOS 视口全屏兜底）。
  const fullscreen = useFullscreen(stageElRef, { onChange: resizeActive });

  useEffect(() => {
    setGyroState(null);
    setAutoState(null);
    const client = activeItem?.clientRef?.current;
    if (!client) return undefined;

    const sync = (next) => {
      const state = next?.gyro ? next : client.getState();
      setGyroState(state.gyro);
      setAutoState(state.auto?.state ?? "off");
    };
    sync();

    const offs = [
      client.on("state", (next) => {
        setGyroState(next?.gyro || null);
        setAutoState(next?.auto?.state ?? "off");
      }),
      client.on("gyrochange", (event) => sync(event.state)),
    ];
    return () => offs.forEach((off) => off());
  }, [activeItem]);

  const focusCard = (item, cardElement) => {
    // 已经处于放大状态或正在动画中，绝不重复触发
    if (isAnimatingRef.current || activeCardElRef.current || !cardElement) return;
    isAnimatingRef.current = true;
    isClosingRef.current = false;
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

    // 3. 用 stage 包裹卡片：stage 负责位移缩放，也作为全屏元素，因此控件可以随之进入原生全屏
    const stage = document.createElement("div");
    stage.style.position = "fixed";
    stage.style.top = `${rect.top}px`;
    stage.style.left = `${rect.left}px`;
    stage.style.width = `${rect.width}px`;
    stage.style.height = `${rect.height}px`;
    stage.style.zIndex = "9999";
    stage.style.margin = "0";
    stage.style.overflow = "hidden";
    stage.style.borderRadius = FOCUS_RADIUS;
    document.body.appendChild(stage);
    stageElRef.current = stage;

    // 4. 记录卡片原内联样式以便归位完全恢复
    savedStylesRef.current = {
      position: cardElement.style.position,
      top: cardElement.style.top,
      left: cardElement.style.left,
      width: cardElement.style.width,
      height: cardElement.style.height,
      transform: cardElement.style.transform,
      zIndex: cardElement.style.zIndex,
      transition: cardElement.style.transition,
      margin: cardElement.style.margin,
      borderRadius: cardElement.style.borderRadius,
    };

    // 5. 卡片填满 stage；stage 临时挂载到 document.body 并定位到原始视口位置
    cardElement.style.position = "relative";
    cardElement.style.top = "";
    cardElement.style.left = "";
    cardElement.style.width = "100%";
    cardElement.style.height = "100%";
    cardElement.style.transform = "";
    cardElement.style.zIndex = "";
    cardElement.style.transition = "none";
    cardElement.style.margin = "0";
    stage.appendChild(cardElement);

    // 6. 激活背景暗化层
    setActiveItem(item);

    // 7. 计算屏幕正中央大视口目标尺寸与位置
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const ratio = readAspectRatio(cardElement, item);

    // 按卡片自身比例自动匹配弹窗尺寸：宽高都受视口约束，再居中。
    const maxW = Math.min(viewportW * 0.9, 1100);
    const maxH = viewportH * 0.82;
    const finalW = Math.min(maxW, maxH * ratio);
    const targetH = finalW / ratio;
    const targetTop = (viewportH - targetH) / 2;
    const targetLeft = (viewportW - finalW) / 2;
    focusedRectRef.current = {
      top: targetTop,
      left: targetLeft,
      width: finalW,
      height: targetH,
    };

    // 8. 使用 GSAP 平滑补间位移与尺寸
    gsap.to(stage, {
      top: targetTop,
      left: targetLeft,
      width: finalW,
      height: targetH,
      duration: 0.55,
      ease: "power3.inOut",
      onUpdate: resizeActive,
      onComplete: () => {
        resizeActive();
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
    const stage = stageElRef.current;
    const placeholder = placeholderElRef.current;

    // 防止连击或无有效节点
    if (isAnimatingRef.current || !cardEl || !stage || !placeholder) return;
    isAnimatingRef.current = true;
    isClosingRef.current = true;

    // 若正处于全屏，先退出全屏再播放归位动画
    if (fullscreen.active) fullscreen.toggle();

    // 1. 获取占位符当前在视口中的最新位置
    const origRect = placeholder.getBoundingClientRect();

    // 2. 从中央平滑补间回原始占位符坐标
    gsap.killTweensOf(stage);
    gsap.to(stage, {
      top: origRect.top,
      left: origRect.left,
      width: origRect.width,
      height: origRect.height,
      borderRadius: FOCUS_RADIUS,
      duration: 0.45,
      ease: "power3.inOut",
      onUpdate: resizeActive,
      onComplete: () => {
        // 3. 卡片放回原父节点占位符之前，恢复原样式
        const host = placeholder.parentElement;
        if (host) {
          host.insertBefore(cardEl, placeholder);
          host.removeChild(placeholder);
        }

        const saved = savedStylesRef.current;
        restoreRadius();
        cardEl.style.position = saved.position || "";
        cardEl.style.top = saved.top || "";
        cardEl.style.left = saved.left || "";
        cardEl.style.width = saved.width || "";
        cardEl.style.height = saved.height || "";
        cardEl.style.transform = saved.transform || "";
        cardEl.style.zIndex = saved.zIndex || "";
        cardEl.style.transition = saved.transition || "";
        cardEl.style.margin = saved.margin || "";
        cardEl.style.borderRadius = saved.borderRadius || "";

        resizeActive();

        placeholderElRef.current = null;
        activeCardElRef.current = null;
        stageElRef.current = null;
        focusedRectRef.current = null;
        setActiveItem(null);
        setGyroState(null);
        isAnimatingRef.current = false;
        isClosingRef.current = false;

        // 等 React 卸载 portal 后再移除 stage
        requestAnimationFrame(() => stage.remove());
      },
    });
  };

  // 全屏切换时把 stage 铺满物理视口；退出时回到居中的放大尺寸。
  useEffect(() => {
    const stage = stageElRef.current;
    const cardEl = activeCardElRef.current;
    if (!stage || !cardEl) return;

    if (fullscreen.active) {
      wasFullscreenRef.current = true;
      cardEl.style.borderRadius = "0";
      stripRadius(cardEl);
      gsap.killTweensOf(stage);
      gsap.to(stage, {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        borderRadius: 0,
        duration: 0.25,
        ease: "power2.out",
        onUpdate: resizeActive,
        onComplete: resizeActive,
      });
      return;
    }

    if (!wasFullscreenRef.current || isClosingRef.current) return;
    wasFullscreenRef.current = false;
    restoreRadius();
    const saved = savedStylesRef.current;
    cardEl.style.borderRadius = saved.borderRadius || "";
    const target = focusedRectRef.current;
    if (!target) return;
    gsap.killTweensOf(stage);
    gsap.to(stage, {
      top: target.top,
      left: target.left,
      width: target.width,
      height: target.height,
      borderRadius: FOCUS_RADIUS,
      duration: 0.3,
      ease: "power2.out",
      onUpdate: resizeActive,
      onComplete: resizeActive,
    });
  }, [fullscreen.active, resizeActive]);

  // 视口尺寸变化时保持全屏 stage 覆盖屏幕
  useEffect(() => {
    if (!fullscreen.active) return undefined;
    const onResize = () => {
      const stage = stageElRef.current;
      if (!stage) return;
      gsap.set(stage, { width: window.innerWidth, height: window.innerHeight });
      resizeActive();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [fullscreen.active, resizeActive]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // 全屏状态下第一次 Escape 只退出全屏（与 playground 行为一致）
      if (fullscreen.active) return;
      closeFocus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleToggleAuto = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const client = activeItem?.clientRef?.current;
    if (!client) return;
    const next = client.getState().auto?.state === "off" ? "cw" : "off";
    client.setAutoRotate(next);
    setAutoState(client.getState().auto.state);
  };

  const handleToggleGyro = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const client = activeItem?.clientRef?.current;
    if (!client) return;
    if (client.getState().gyro.enabled) {
      client.disableGyro();
    } else {
      await client.enableGyro();
    }
    setGyroState(client.getState().gyro);
  };

  const handleToggleFullscreen = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    void fullscreen.toggle();
  };

  const stage = stageElRef.current;
  const gyroOn = !!gyroState?.enabled;
  const autoOn = autoState !== null && autoState !== "off";

  return (
    <FlipFocusContext.Provider
      value={{ focusCard, closeFocus, activeItem, isFocused: !!activeItem }}
    >
      {children}

      {/* 背景暗化遮罩 */}
      {activeItem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9990] pointer-events-auto">
          <div
            onPointerDown={(e) => closeFocus(e)}
            className="fixed inset-0 bg-black/45 dark:bg-black/75 backdrop-blur-md transition-opacity duration-300 cursor-zoom-out"
          />
        </div>
      )}

      {/* 卡片与控件处于同一全屏容器内，原生全屏时按钮仍然可见 */}
      {activeItem && stage
        ? createPortal(
            <div className="absolute inset-0 z-50 pointer-events-none">
              <div
                className="absolute flex items-center gap-2"
                style={{
                  top: "max(1.5rem, env(safe-area-inset-top, 1.5rem))",
                  right: "max(1.5rem, env(safe-area-inset-right, 1.5rem))",
                }}
              >
                <button
                  type="button"
                  onClick={handleToggleAuto}
                  aria-pressed={autoOn}
                  aria-label={m.playground_auto_spin()}
                  title={m.playground_auto_spin()}
                  className={toolbarIconButtonClass(autoOn)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    <path d="M21 3v6h-6" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleToggleGyro}
                  aria-pressed={gyroOn}
                  aria-label={m.playground_gyro_switch()}
                  title={m.playground_gyro_switch()}
                  className={toolbarIconButtonClass(gyroOn)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                    <path d="M11 18.5h2" strokeLinecap="round" />
                    <path d="M3.5 12a8.5 8.5 0 0 0 4 7.2M20.5 12a8.5 8.5 0 0 1-4 7.2" />
                  </svg>
                </button>

                {fullscreen.supported && (
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    aria-pressed={fullscreen.active}
                    aria-label={
                      fullscreen.active
                        ? m.playground_fullscreen_exit()
                        : m.playground_fullscreen_enter()
                    }
                    title={
                      fullscreen.active
                        ? m.playground_fullscreen_exit()
                        : m.playground_fullscreen_enter()
                    }
                    className={toolbarIconButtonClass(fullscreen.active)}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      {fullscreen.active ? (
                        <>
                          <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
                        </>
                      ) : (
                        <>
                          <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                        </>
                      )}
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => closeFocus(e)}
                  aria-label={m.gallery_close()}
                  title={m.gallery_close()}
                  className={toolbarIconButtonClass(false)}
                >
                  <svg
                    className="h-4 w-4"
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
            </div>,
            stage,
          )
        : null}
    </FlipFocusContext.Provider>
  );
}
