import React from "react";
import { MinimalNav } from "./MinimalNav";
import { HeroCardStack } from "./HeroCardStack";
import { MinimalGallery } from "./MinimalGallery";
import { FlipFocusProvider } from "./FlipFocusModal";

export function ModernCardApp() {
  return (
    <FlipFocusProvider>
      <div className="min-h-screen bg-white dark:bg-[#0a0b0e] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between font-sans transition-colors duration-200">
        {/* 顶部极简导航 */}
        <MinimalNav />

        {/* 核心卡片堆叠与画廊区域 */}
        <main className="flex-1 flex flex-col justify-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <HeroCardStack />
          <MinimalGallery />
        </main>

        {/* 底部极简版权 */}
        <footer className="w-full py-8 max-w-7xl mx-auto px-6 sm:px-12 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 font-sans">
          <div>© 2026 Orbit360 Project</div>
          <div>Pure Canvas · Low Power Consumption</div>
        </footer>
      </div>
    </FlipFocusProvider>
  );
}
