import React from "react";
import { SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/Select";
import { getLocale, setLocale } from "../paraglide/runtime.js";

const items = [
  { value: "zh", label: "中文" },
  { value: "en", label: "EN" },
];

export function LanguageSelector() {
  return (
    <SelectRoot
      value={getLocale()}
      onValueChange={(val) => {
        if (val === "zh" || val === "en") void setLocale(val);
      }}
      items={items}
    >
      <SelectTrigger className="border-0 bg-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-1.5 py-1 text-xs font-mono font-medium shadow-none cursor-pointer">
        <SelectValue placeholder="Lang" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="zh">中文</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}
