import React from "react";
import { Outlet } from "@tanstack/react-router";
import { MinimalNav } from "./MinimalNav";
import { FlipFocusProvider } from "./FlipFocusModal";

export function SiteShell() {
  return (
    <FlipFocusProvider>
      <div className="min-h-screen bg-white dark:bg-[#0a0b0e] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between font-sans transition-colors duration-200 overflow-x-hidden w-full max-w-full">
        {/* 顶部极简导航 */}
        <MinimalNav />

        {/* 动态路由页面入口 */}
        <main className="flex-1 flex flex-col justify-center w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>

        {/* 底部极简版权 */}
        <footer className="w-full py-8 max-w-7xl mx-auto px-6 sm:px-12 border-t border-neutral-100 dark:border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400 dark:text-neutral-500 font-sans">
          <div>© 2026 Orbit360 Project</div>
          <div>Pure Canvas · Low Power Consumption</div>
        </footer>
      </div>
    </FlipFocusProvider>
  );
}
