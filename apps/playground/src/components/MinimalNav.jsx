import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ThemeSelector } from "./ThemeSelector";
import { LanguageSelector } from "./LanguageSelector";
import { useI18n } from "../lib/I18nContext";

export function MinimalNav() {
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="w-full pt-6 sm:pt-8 pb-4 px-4 sm:px-8 md:px-12 flex flex-col relative z-40">
      <div className="w-full flex items-center justify-between">
        {/* 品牌标识 */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white font-sans">
              Orbit360
            </span>
          </Link>
        </div>

        {/* 桌面端中间极简链接 */}
        <div className="hidden md:flex items-center gap-8 text-[13px] text-neutral-600 dark:text-neutral-400 font-medium font-sans">
          <Link to="/" className="text-neutral-900 dark:text-white transition-colors">
            {t.nav.home}
          </Link>
          <Link
            to="/gallery"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors font-medium"
          >
            {t.nav.gallery}
          </Link>
          <Link
            to="/playground"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            {t.nav.playground}
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            {t.nav.source}
          </a>
        </div>

        {/* 右侧：双语切换 + 主题切换 + 移动端菜单汉堡按钮 */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <LanguageSelector />
          <ThemeSelector />

          {/* 移动端菜单折叠展开按钮 */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            className="md:hidden px-2.5 py-1 text-xs font-mono font-medium rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 cursor-pointer"
          >
            {mobileMenuOpen ? "CLOSE" : "MENU"}
          </button>
        </div>
      </div>

      {/* 移动端展开抽屉菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 p-4 rounded-2xl bg-neutral-50/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 shadow-xl flex flex-col gap-3 font-sans text-sm animate-fade-in">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="py-1 text-neutral-900 dark:text-white font-medium"
          >
            {t.nav.home}
          </Link>
          <Link
            to="/gallery"
            onClick={() => setMobileMenuOpen(false)}
            className="py-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            {t.nav.gallery}
          </Link>
          <Link
            to="/playground"
            onClick={() => setMobileMenuOpen(false)}
            className="py-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            {t.nav.playground}
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="py-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            {t.nav.source}
          </a>
        </div>
      )}
    </nav>
  );
}
