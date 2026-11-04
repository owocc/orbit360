import * as React from "react";
import { Slider as BaseSlider } from "@base-ui/react";

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className = "" }) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      className={`relative flex w-full touch-none select-none items-center ${className}`}
    >
      <BaseSlider.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-neutral-800">
        <BaseSlider.Indicator className="absolute h-full bg-neutral-200" />
      </BaseSlider.Track>
      <BaseSlider.Thumb className="block h-3.5 w-3.5 rounded-full border border-neutral-300 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" />
    </BaseSlider.Root>
  );
}
