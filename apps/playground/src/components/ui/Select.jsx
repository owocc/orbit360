import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react";

export function SelectRoot({ value, onValueChange, defaultValue = "auto", items, children }) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      items={items}
    >
      {children}
    </BaseSelect.Root>
  );
}

export function SelectTrigger({ className = "", children }) {
  return (
    <BaseSelect.Trigger
      className={`inline-flex items-center justify-between gap-2 px-2.5 py-1 text-xs font-sans rounded-full border transition-colors select-none outline-none focus-visible:ring-1 ${className}`}
    >
      {children}
    </BaseSelect.Trigger>
  );
}

export function SelectValue({ placeholder = "Select...", className = "" }) {
  return <BaseSelect.Value placeholder={placeholder} className={className} />;
}

export function SelectIcon({ className = "", children }) {
  return <BaseSelect.Icon className={className}>{children}</BaseSelect.Icon>;
}

export function SelectContent({ className = "", children }) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner className="z-50 select-none outline-none" sideOffset={6} align="end">
        <BaseSelect.Popup
          className={`min-w-[120px] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md p-1 shadow-lg text-neutral-900 dark:text-neutral-100 transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 ${className}`}
        >
          <BaseSelect.List className="py-0.5 space-y-0.5 outline-none">{children}</BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({ value, className = "", children }) {
  return (
    <BaseSelect.Item
      value={value}
      className={`flex items-center justify-between px-3 py-1.5 text-xs font-sans rounded-lg cursor-pointer outline-none select-none text-neutral-600 dark:text-neutral-400 data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800 data-[highlighted]:text-neutral-900 dark:data-[highlighted]:text-white data-[selected]:font-semibold data-[selected]:text-neutral-900 dark:data-[selected]:text-white ${className}`}
    >
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator className="ml-2 text-neutral-900 dark:text-white">
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
}
