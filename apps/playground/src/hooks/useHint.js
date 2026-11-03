import { useCallback, useEffect, useRef, useState } from 'react';

/** 顶部提示：默认文案随轴变化，flash 临时覆盖并自动淡出。 */
export function useHint(baseText) {
  const [text, setText] = useState(baseText);
  const [hidden, setHidden] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setText(baseText);
  }, [baseText]);

  const clearTimer = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const flash = useCallback((message, ms = 2200) => {
    clearTimer();
    setText(message);
    setHidden(false);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHidden(true);
    }, ms);
  }, []);

  useEffect(() => clearTimer, []);

  return { hint: text, hintHidden: hidden, flashHint: flash };
}
