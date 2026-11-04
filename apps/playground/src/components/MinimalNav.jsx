import React from "react";
import { Link } from "@tanstack/react-router";
import { ThemeSelector } from "./ThemeSelector";

export function MinimalNav() {
  return (
    <nav className="w-full pt-8 pb-4 px-6 sm:px-12 flex items-center justify-between">
      {/* 品牌标识 */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center">
          <span className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white font-sans">
            Orbit360
          </span>
        </Link>
      </div>

      {/* 中间极简链接 */}
      <div className="hidden md:flex items-center gap-8 text-[13px] text-neutral-600 dark:text-neutral-400 font-medium font-sans">
        <Link to="/" className="text-neutral-900 dark:text-white transition-colors">
          Home
        </Link>
        <Link
          to="/gallery"
          className="hover:text-neutral-900 dark:hover:text-white transition-colors font-medium"
        >
          Gallery
        </Link>
        <Link
          to="/playground"
          className="hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          Playground
        </Link>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          Source
        </a>
      </div>

      {/* 右侧主题切换 Base UI Select 与弹窗 */}
      <div className="flex items-center gap-3">
        <ThemeSelector />
      </div>
    </nav>
  );
}
