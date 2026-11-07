import { useCallback, useEffect, useRef, useState } from "react";

function fullscreenElement() {
  if (typeof document === "undefined") return null;
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    null
  );
}

function hasNativeFullscreen(el) {
  if (!el) return false;
  return !!(
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen ||
    document.documentElement.webkitRequestFullScreen
  );
}

/**
 * 全屏开关 + 状态同步：
 * 1. 优先使用标准 Fullscreen API (requestFullscreen) 与 WebKit 前缀 API (webkitRequestFullscreen)。
 * 2. 针对 iOS Safari（尤其是 iPhone），非 <video> 的常规 DOM/Canvas 元素不开放系统底层原生全屏通道。
 *    因此在 iOS 设备上自动提供平滑健壮的“视口全屏（CSS Viewport Fullscreen）”伪全屏兜底，
 *    确保 iOS 用户也能享受无遮挡的沉浸式全屏交互体验。
 */
export function useFullscreen(targetOrOptions, options = {}) {
  const isTargetRef = targetOrOptions && "current" in targetOrOptions;
  const targetRef = isTargetRef ? targetOrOptions : null;
  const opts = isTargetRef ? options : targetOrOptions || {};
  const { onChange, onError } = opts;

  const defaultRoot = typeof document !== "undefined" ? document.documentElement : null;
  const getTarget = () => targetRef?.current || defaultRoot;

  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  // 是否处于非原生 DOM 级别的视口全屏降级状态（如 iOS iPhone）
  const [isPseudo, setIsPseudo] = useState(false);

  const callbacks = useRef({ onChange, onError });
  callbacks.current = { onChange, onError };

  useEffect(() => {
    // 在现代浏览器中全屏始终可用（支持原生 Fullscreen API 或视口沉浸式兜底）
    const target = getTarget();
    const canNative = hasNativeFullscreen(target);
    const isIOS =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    // 只要有原生 API 或处于 iOS 等移动设备下，均支持全屏模式
    setSupported(canNative || isIOS);
    setActive(!!fullscreenElement());
  }, []);

  // 监听原生全屏状态变化
  useEffect(() => {
    const sync = () => {
      const isNativeActive = !!fullscreenElement();
      if (!isNativeActive && !isPseudo) {
        setActive(false);
      } else if (isNativeActive) {
        setActive(true);
        setIsPseudo(false);
      }
      callbacks.current.onChange?.();
    };

    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [isPseudo]);

  // 处理 Escape 键退出视口全屏
  useEffect(() => {
    if (!isPseudo) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActive(false);
        setIsPseudo(false);
        callbacks.current.onChange?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPseudo]);

  const toggle = useCallback(async () => {
    const target = getTarget();
    try {
      // 1. 如果当前处于全屏状态，则退出
      if (active) {
        if (fullscreenElement()) {
          const exit =
            document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.webkitCancelFullScreen;
          await exit?.call(document);
        }
        setActive(false);
        setIsPseudo(false);
        callbacks.current.onChange?.();
        return;
      }

      // 2. 尝试请求原生全屏（标准 / WebKit）
      const request =
        target?.requestFullscreen ||
        target?.webkitRequestFullscreen ||
        target?.webkitRequestFullScreen ||
        document.documentElement.requestFullscreen ||
        document.documentElement.webkitRequestFullscreen ||
        document.documentElement.webkitRequestFullScreen;

      if (request) {
        try {
          await request.call(target || document.documentElement);
          setActive(true);
          setIsPseudo(false);
          callbacks.current.onChange?.();
          return;
        } catch (err) {
          // 在 iOS iPhone 上，webkitRequestFullscreen 会因为权限/不支持元素抛错，平滑进入下方视口全屏降级
        }
      }

      // 3. 视口沉浸式伪全屏降级方案（完美契合 iOS iPhone Safari / 微信 / 抖音内置 Webview）
      setActive(true);
      setIsPseudo(true);
      callbacks.current.onChange?.();
    } catch {
      callbacks.current.onError?.("全屏被浏览器拒绝");
    }
  }, [targetRef, active]);

  return { supported, active, toggle, isPseudo };
}
