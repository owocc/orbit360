import React from "react";
import { SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/Select";
import { useI18n } from "../lib/I18nContext";

const items = [
  { value: "zh", label: "中文" },
  { value: "en", label: "EN" },
];

export function LanguageSelector() {
  const { lang, setLang } = useI18n();

  return (
    <SelectRoot
      value={lang}
      onValueChange={(val) => {
        if (val === "zh" || val === "en") setLang(val);
      }}
      items={items}
    >
      <SelectTrigger className="border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs px-2.5 py-1 text-xs font-mono">
        <SelectValue placeholder="Lang" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="zh">中文</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}
