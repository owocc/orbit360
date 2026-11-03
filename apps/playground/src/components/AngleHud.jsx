import { displayAngle, ringGeometry, ringLabelForAxis } from "../lib/format.js";

const TICKS = Array.from({ length: 72 }, (_, index) => {
  const major = index % 6 === 0;
  const angle = (index / 72) * Math.PI * 2;
  const r1 = 52;
  const r2 = major ? 45 : 48;
  return {
    x1: (66 + Math.sin(angle) * r1).toFixed(2),
    y1: (66 - Math.cos(angle) * r1).toFixed(2),
    x2: (66 + Math.sin(angle) * r2).toFixed(2),
    y2: (66 - Math.cos(angle) * r2).toFixed(2),
    width: major ? 1.4 : 0.8,
  };
});

export function AngleHud({ angle, axis }) {
  const ring = ringGeometry(angle);
  return (
    <>
      <div className="p-deg">
        <span>{displayAngle(angle)}</span>
        <small>°</small>
      </div>

      <svg id="ring" viewBox="0 0 132 132" aria-hidden="true">
        <circle className="track" cx="66" cy="66" r="52" fill="none" strokeWidth="1.5" />
        <g>
          {TICKS.map((tick, index) => (
            <line
              key={index}
              className="tick"
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              strokeWidth={tick.width}
            />
          ))}
        </g>
        <circle
          className="arc"
          cx="66"
          cy="66"
          r="52"
          fill="none"
          strokeWidth="2.5"
          strokeDasharray={ring.dash}
          transform="rotate(-90 66 66)"
        />
        <line
          className="needle"
          x1="66"
          y1="66"
          x2="66"
          y2="24"
          strokeWidth="2"
          transform={`rotate(${ring.needle.toFixed(1)} 66 66)`}
        />
        <circle cx="66" cy="66" r="3.2" fill="currentColor" style={{ color: "var(--accent)" }} />
        <text x="66" y="124" textAnchor="middle">
          {ringLabelForAxis(axis)}
        </text>
      </svg>
    </>
  );
}
