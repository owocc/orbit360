import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react";

export function PopoverRoot({ open, onOpenChange, children }) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BasePopover.Root>
  );
}

export function PopoverTrigger({ className = "", children }) {
  return <BasePopover.Trigger className={className}>{children}</BasePopover.Trigger>;
}

export function PopoverContent({
  className = "",
  side = "bottom",
  align = "end",
  sideOffset = 8,
  children,
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-50 outline-none"
      >
        <BasePopover.Popup
          className={`rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.25)] text-neutral-900 dark:text-neutral-100 outline-none transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 ${className}`}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
