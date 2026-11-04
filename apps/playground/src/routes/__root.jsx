import React from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

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
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-[#07090e] text-neutral-200 selection:bg-neutral-800 selection:text-white flex flex-col font-sans">
      <HeadContent />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <Scripts />
    </div>
  );
}
