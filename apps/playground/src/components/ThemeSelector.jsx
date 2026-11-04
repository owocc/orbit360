import React, { useEffect, useState } from "react";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
} from "./ui/Select";

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
      <SelectTrigger className="border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs">
        <SelectIcon className="text-neutral-500 dark:text-neutral-400">
          {theme === "dark" ? (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : theme === "light" ? (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
        </SelectIcon>
        <SelectValue placeholder="Theme" />
        <SelectIcon className="text-neutral-400">
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </SelectIcon>
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="light">浅色</SelectItem>
        <SelectItem value="dark">深色</SelectItem>
        <SelectItem value="auto">Auto</SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}
