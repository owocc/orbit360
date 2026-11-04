import React, { useEffect, useRef, useState } from "react";

/* ══ Wake slider ══════════════════════════════════════════
   A range with no thumb: a row of thin bars, solid up to the
   value and faint after it, with the reading beside them. Drag
   anywhere along it. Drag slowly and the bars simply fill; drag
   fast and every bar the value sweeps past springs up, taller the
   faster you went, and settles back — a wake left behind the hand.

   ── EACH BAR HOLDS A LITTLE ENERGY ──────────────────────
   When the value crosses a bar, that bar takes energy from the
   speed of the drag. Every frame all of it decays at the same
   rate, so the bars crossed longest ago have fallen furthest: the
   tallest ones are always at the hand and the run tails off
   behind it. That falloff IS the wake; nothing draws it.

   ── WRITTEN, NOT RENDERED ───────────────────────────────
   The heights change every frame, so they go straight onto each
   bar's transform from a ref. React renders when the value
   changes, which is what the reading and the colours need, and
   the loop runs only while some bar still has energy. */

const H = 20; // a bar at rest, px
const GAP = 4; // bar pitch minus its width
const BAR = 3;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function WakeSlider({
  /* how many bars make the track */
  bars = 36,
  /* how high the wake rises, 0..100 */
  wake = 60,
  min = -180,
  max = 180,
  value: externalValue,
  step = 1,
  formatValue,
  onChange,
  className = "",
} = {}) {
  const n = Math.round(clamp(bars, 12, 64));
  const defaultValue = 0;
  const [value, setValue] = useState(externalValue !== undefined ? externalValue : defaultValue);

  const track = useRef(null);
  const els = useRef([]);
  const st = useRef({
    energy: new Float32Array(n),
    down: false,
    lastX: 0,
    lastT: 0,
    speed: 0,
    raf: 0,
    at: clamp(
      ((externalValue !== undefined ? externalValue : defaultValue) - min) / (max - min),
      0,
      1,
    ),
    lastBar: -1,
  });
  const knob = useRef(wake);
  knob.current = wake;

  // 外部传入真实角度数值（如 -180..180），未处于手动按住状态时同步刻度
  useEffect(() => {
    if (externalValue !== undefined && !st.current.down) {
      setValue(externalValue);
      st.current.at = clamp((externalValue - min) / (max - min), 0, 1);
    }
  }, [externalValue, min, max]);

  /* a new bar count is a new row */
  useEffect(() => {
    st.current.energy = new Float32Array(n);
  }, [n]);

  const loop = () => {
    const s = st.current;
    if (s.raf) return;
    let prev = performance.now();
    const run = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      let live = false;
      const fall = Math.exp(-dt * 6.5);
      for (let i = 0; i < s.energy.length; i++) {
        s.energy[i] *= fall;
        if (s.energy[i] < 0.002) s.energy[i] = 0;
        else live = true;
        const b = els.current[i];
        /* up to 2.6 times as tall at the very top of the knob */
        if (b) b.style.transform = `scaleY(${(1 + s.energy[i] * 1.6).toFixed(3)})`;
      }
      s.raf = live || s.down ? requestAnimationFrame(run) : 0;
    };
    s.raf = requestAnimationFrame(run);
  };

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  /* move the value to a fraction, waking every bar it passes */
  const to = (f, speed) => {
    const s = st.current;
    f = clamp(f, 0, 1);
    const from = s.at;
    s.at = f;
    const a = Math.round(from * (n - 1)),
      b = Math.round(f * (n - 1));
    /* how hard: the drag's speed in bars per second, through a
       curve that saturates, scaled by the knob */
    const push = (1 - Math.exp(-speed / 900)) * (knob.current / 60);
    const lo = Math.min(a, b),
      hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) s.energy[i] = Math.max(s.energy[i], push);
    if (b !== s.lastBar) {
      s.lastBar = b;
    }

    // 将 0..1 真实换算为 min..max 范围的真实数值（支持 step 步长，如 0.1 或 1）
    const raw = min + f * (max - min);
    const stepped = Math.round(raw / step) * step;
    const realValue = clamp(Number(stepped.toFixed(2)), min, max);
    setValue(realValue);
    onChange?.(realValue);
    loop();
  };
  const frac = (clientX) => {
    const r = track.current.getBoundingClientRect();
    return (clientX - r.left) / r.width;
  };

  // 处于 min..max 范围时的点亮条数计算（从最左侧点亮至当前进度）
  const ratio = clamp((value - min) / (max - min), 0, 1);
  const lit = Math.round(ratio * (n - 1));

  // 格式化数值显示
  const displayVal = formatValue ? formatValue(value) : value > 0 ? `+${value}°` : `${value}°`;
  return (
    <div className={`wks ${className}`}>
      <div
        ref={track}
        className="wks-track"
        role="slider"
        tabIndex={0}
        aria-label="Value"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{ width: n * (BAR + GAP) - GAP, height: H * 2.6 }}
        onPointerDown={(e) => {
          const s = st.current;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          s.down = true;
          s.lastX = e.clientX;
          s.lastT = performance.now();
          s.speed = 0;
          to(frac(e.clientX), 0);
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (!s.down) return;
          const now = performance.now();
          const dt = Math.max(0.008, (now - s.lastT) / 1000);
          const v = Math.abs(e.clientX - s.lastX) / dt;
          s.speed = s.speed * 0.5 + v * 0.5;
          s.lastX = e.clientX;
          s.lastT = now;
          to(frac(e.clientX), s.speed);
        }}
        onPointerUp={(e) => {
          st.current.down = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
        }}
        onPointerCancel={() => {
          st.current.down = false;
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          let next = null;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step;
          if (e.key === "Home") next = min;
          if (e.key === "End") next = max;
          if (next === null) return;
          e.preventDefault();
          to((clamp(next, min, max) - min) / (max - min), 600);
        }}
      >
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            ref={(b) => {
              els.current[i] = b;
            }}
            className="wks-bar"
            data-on={i <= lit || undefined}
            style={{ height: H }}
          />
        ))}
      </div>
      <span className="wks-value font-mono">{displayVal}</span>
    </div>
  );
}
