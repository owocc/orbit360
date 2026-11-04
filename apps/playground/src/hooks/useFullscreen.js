import { useCallback, useEffect, useRef, useState } from "react";

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

/** 全屏开关 + 状态同步。 */
export function useFullscreen(targetOrOptions, options = {}) {
  const isTargetRef = targetOrOptions && "current" in targetOrOptions;
  const targetRef = isTargetRef ? targetOrOptions : null;
  const opts = isTargetRef ? options : targetOrOptions || {};
  const { onChange, onError } = opts;

  const defaultRoot = typeof document !== "undefined" ? document.documentElement : null;
  const getTarget = () => targetRef?.current || defaultRoot;
  const supported =
    typeof document !== "undefined" &&
    !!(
      document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen
    );
  const [active, setActive] = useState(!!fullscreenElement());
  const callbacks = useRef({ onChange, onError });
  callbacks.current = { onChange, onError };

  useEffect(() => {
    const sync = () => {
      const next = !!fullscreenElement();
      setActive(next);
      callbacks.current.onChange?.();
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    const target = getTarget();
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        await exit?.call(document);
      } else if (target) {
        const request = target.requestFullscreen || target.webkitRequestFullscreen;
        await request?.call(target);
      }
    } catch {
      callbacks.current.onError?.("全屏被浏览器拒绝");
    }
  }, [targetRef]);

  return { supported, active, toggle };
}
