import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react";

export function TabsRoot({ defaultValue, value, onValueChange, className = "", children }) {
  return (
    <BaseTabs.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      {children}
    </BaseTabs.Root>
  );
}

export function TabsList({ className = "", children }) {
  return (
    <BaseTabs.List
      className={`inline-flex items-center gap-1 border border-neutral-800 bg-neutral-900/80 p-1 rounded-md backdrop-blur-sm ${className}`}
    >
      {children}
    </BaseTabs.List>
  );
}

export function TabsTrigger({ value, className = "", children }) {
  return (
    <BaseTabs.Tab
      value={value}
      className={`px-3 py-1.5 text-xs font-mono tracking-wider transition-colors select-none rounded text-neutral-400 hover:text-neutral-100 data-[selected]:bg-neutral-800 data-[selected]:text-white data-[selected]:font-medium data-[selected]:shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 ${className}`}
    >
      {children}
    </BaseTabs.Tab>
  );
}

export function TabsContent({ value, className = "", children }) {
  return (
    <BaseTabs.Panel
      value={value}
      className={`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500 rounded-md ${className}`}
    >
      {children}
    </BaseTabs.Panel>
  );
}
