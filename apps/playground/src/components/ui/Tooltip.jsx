import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react";

export function Tooltip({ content, children, side = "top" }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger className="inline-flex items-center cursor-default">
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6}>
          <BaseTooltip.Popup className="z-50 overflow-hidden rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] font-mono text-neutral-200 shadow-md animate-in fade-in-0">
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
