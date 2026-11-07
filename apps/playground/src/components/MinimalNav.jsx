import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ThemeSelector } from "./ThemeSelector";
import { LanguageSelector } from "./LanguageSelector";
import * as m from "../paraglide/messages.js";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "./ui/Popover";
export function MinimalNav() {
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
        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium font-sans">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            activeProps={{
              className: "!text-neutral-950 dark:!text-white font-semibold",
            }}
          >
            {m.nav_home()}
          </Link>
          <Link
            to="/gallery"
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            activeProps={{
              className: "!text-neutral-950 dark:!text-white font-semibold",
            }}
          >
            {m.nav_gallery()}
          </Link>
          <Link
            to="/create"
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            activeProps={{
              className: "!text-neutral-950 dark:!text-white font-semibold",
            }}
          >
            {m.nav_create()}
          </Link>
          <Link
            to="/playground"
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            activeProps={{
              className: "!text-neutral-950 dark:!text-white font-semibold",
            }}
          >
            {m.nav_playground()}
          </Link>
          <a
            href="https://github.com/owocc/orbit360"
            target="_blank"
            rel="noreferrer"
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            {m.nav_source()}
          </a>
        </div>

        {/* 右侧：双语切换 + 主题切换 + 移动端菜单汉堡按钮 */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <LanguageSelector />
          <ThemeSelector />

          {/* 移动端菜单折叠展开按钮 */}
          {/* 移动端菜单 Popover 气泡弹层展示，绝对不挤压页面布局 */}
          <div className="md:hidden">
            <PopoverRoot open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <PopoverTrigger className="border-0 bg-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-1.5 py-1 text-xs font-mono font-medium shadow-none cursor-pointer">
                {mobileMenuOpen ? "CLOSE" : "MENU"}
              </PopoverTrigger>

              <PopoverContent
                side="bottom"
                align="end"
                sideOffset={8}
                className="w-48 p-2 rounded-2xl bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 shadow-2xl backdrop-blur-xl flex flex-col gap-1 font-sans text-xs"
              >
                <Link
                  to="/"
                  activeOptions={{ exact: true }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  activeProps={{
                    className:
                      "px-3 py-2 rounded-xl !text-neutral-950 dark:!text-white !font-bold bg-neutral-100 dark:bg-neutral-800 transition-colors",
                  }}
                >
                  {m.nav_home()}
                </Link>
                <Link
                  to="/gallery"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  activeProps={{
                    className:
                      "px-3 py-2 rounded-xl !text-neutral-950 dark:!text-white !font-bold bg-neutral-100 dark:bg-neutral-800 transition-colors",
                  }}
                >
                  {m.nav_gallery()}
                </Link>
                <Link
                  to="/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  activeProps={{
                    className:
                      "px-3 py-2 rounded-xl !text-neutral-950 dark:!text-white !font-bold bg-neutral-100 dark:bg-neutral-800 transition-colors",
                  }}
                >
                  {m.nav_create()}
                </Link>
                <Link
                  to="/playground"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  activeProps={{
                    className:
                      "px-3 py-2 rounded-xl !text-neutral-950 dark:!text-white !font-bold bg-neutral-100 dark:bg-neutral-800 transition-colors",
                  }}
                >
                  {m.nav_playground()}
                </Link>
                <a
                  href="https://github.com/owocc/orbit360"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {m.nav_source()}
                </a>
              </PopoverContent>
            </PopoverRoot>
          </div>
        </div>
      </div>
    </nav>
  );
}
