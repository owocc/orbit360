import React from "react";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

interface RingHudProps {
  angle: number;
  axis: "x" | "y";
  size?: number;
}

const TICKS = Array.from({ length: 72 }, (_, index) => {
  const major = index % 6 === 0;
  const rad = (index / 72) * Math.PI * 2;
  const r1 = 52;
  const r2 = major ? 45 : 48;
  return {
    x1: 66 + Math.sin(rad) * r1,
    y1: 66 - Math.cos(rad) * r1,
    x2: 66 + Math.sin(rad) * r2,
    y2: 66 - Math.cos(rad) * r2,
    width: major ? 1.4 : 0.8,
    opacity: major ? 0.35 : 0.15,
  };
});

export const RingHud: React.FC<RingHudProps> = ({ angle, axis, size = 76 }) => {
  const signed = ((((angle + 180) % 360) + 360) % 360) - 180;
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const strokeDash = `${((circumference * (signed + 180)) / 360).toFixed(2)} ${circumference.toFixed(2)}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 132 132">
      {/* Track */}
      <Circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

      {/* Ticks */}
      {TICKS.map((tick, index) => (
        <Line
          key={index}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke={`rgba(255,255,255,${tick.opacity})`}
          strokeWidth={tick.width}
        />
      ))}

      {/* Arc */}
      <Circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke="#6EE7B7"
        strokeWidth="2.5"
        strokeDasharray={strokeDash}
        strokeLinecap="round"
        transform="rotate(-90 66 66)"
      />

      {/* Needle */}
      <Line
        x1="66"
        y1="66"
        x2="66"
        y2="24"
        stroke="#6EE7B7"
        strokeWidth="2"
        strokeLinecap="round"
        transform={`rotate(${angle.toFixed(1)} 66 66)`}
      />

      {/* Center Pivot */}
      <Circle cx="66" cy="66" r="3.2" fill="#6EE7B7" />

      {/* Axis text */}
      <SvgText
        x="66"
        y="124"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        letterSpacing="1"
        fill="rgba(255,255,255,0.4)"
      >
        {axis === "y" ? "PITCH" : "BEARING"}
      </SvgText>
    </Svg>
  );
};
