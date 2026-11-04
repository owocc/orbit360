import { useCallback, useEffect, useRef, useState } from "react";

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

/** 全屏开关 + 状态同步。 */
export function useFullscreen({ onChange, onError } = {}) {
  const root = document.documentElement;
  const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
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
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        await exit?.call(document);
      } else {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        await request?.call(root);
      }
    } catch {
      callbacks.current.onError?.("全屏被浏览器拒绝");
    }
  }, [root]);

  return { supported, active, toggle };
}
