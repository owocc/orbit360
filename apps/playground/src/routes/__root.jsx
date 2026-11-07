import React from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { MinimalNav } from "../components/MinimalNav";
import { FlipFocusProvider } from "../components/FlipFocusModal";
import { LanguageProvider, useI18n } from "../lib/I18nContext";

function RootDocument({ children }) {
  const { t } = useI18n();

  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        <LanguageProvider>
          <FlipFocusProvider>
            <div className="min-h-screen bg-white dark:bg-[#0a0b0e] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between font-sans transition-colors duration-200 overflow-x-hidden w-full max-w-full">
              <MinimalNav />
              <main className="flex-1 flex flex-col justify-center w-full max-w-full overflow-x-hidden">
                {children}
              </main>
              <footer className="w-full py-8 max-w-7xl mx-auto px-6 sm:px-12 border-t border-neutral-100 dark:border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400 dark:text-neutral-500 font-sans">
                <div>{t.footer.copy}</div>
                <div>{t.footer.sub}</div>
              </footer>
            </div>
          </FlipFocusProvider>
        </LanguageProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Orbit360 - 极轻量 360° 环绕视频重塑为可交互 3D 实体 Web 引擎" },
      {
        name: "description",
        content:
          "Orbit360 是一款专注于将 360° 环绕拍摄视频转化为超轻量伪 3D 可交互实体的 Web 渲染引擎。单文件 .orb 二进制标准、纯 Canvas 单帧硬切、手机陀螺仪体感支持与单页多实例响应式并发渲染。",
      },
      {
        name: "keywords",
        content:
          "orbit360, 360度旋转, 环绕视频, 伪3D模型, Canvas切帧, 陀螺仪交互, WebSDK, TanStack, BaseUI",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Orbit360 - 极轻量 360° 环绕视频重塑引擎" },
      {
        property: "og:description",
        content: "零 WebGL 显存负担，单个 .orb 二进制容器，手机陀螺仪与多实例响应式并发渲染。",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' stroke='%23ffffff' stroke-width='8' fill='none'/><circle cx='50' cy='20' r='8' fill='%23ffffff'/></svg>",
      },
    ],
  }),
  component: () => <Outlet />,
  shellComponent: RootDocument,
});
