import React, { useEffect, useState } from "react";
import { SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/Select";

const THEME_STORAGE_KEY = "orbit360-theme";

const themeItems = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "auto", label: "Auto" },
];

export function ThemeSelector() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "auto";
    return localStorage.getItem(THEME_STORAGE_KEY) || "auto";
  });

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (val) => {
      let isDark = false;
      if (val === "dark") {
        isDark = true;
      } else if (val === "light") {
        isDark = false;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("auto");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  return (
    <SelectRoot
      value={theme}
      onValueChange={(val) => {
        if (val) setTheme(val);
      }}
      items={themeItems}
    >
      <SelectTrigger className="border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs px-2.5 py-1 text-xs">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="light">浅色</SelectItem>
        <SelectItem value="dark">深色</SelectItem>
        <SelectItem value="auto">Auto</SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}
