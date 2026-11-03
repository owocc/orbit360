import { useCallback, useEffect, useRef, useState } from "react";

/** UI 自动隐藏、手动切换；拖动中不自动隐藏。 */
export function useUiVisibility() {
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);

  const clearTimer = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const scheduleHide = useCallback((isDragging = () => false, delay = 3200) => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!isDragging()) setVisible(false);
    }, delay);
  }, []);

  const toggle = useCallback(() => {
    clearTimer();
    setVisible((value) => !value);
  }, []);

  const reveal = useCallback(() => {
    clearTimer();
    setVisible(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("ui-hidden", !visible);
    return () => document.body.classList.remove("ui-hidden");
  }, [visible]);

  useEffect(() => clearTimer, []);

  return { visible, toggle, reveal, scheduleHide };
}
