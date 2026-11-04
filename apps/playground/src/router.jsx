import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import React from "react";
import { SiteShell } from "./components/SiteShell";
import { IndexHome } from "./components/IndexHome";
import PlaygroundPage from "./components/PlaygroundPage";
export const rootRoute = createRootRoute({
  component: SiteShell,
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexHome,
});

// 单独 Gallery 页面，使用 lazyRouteComponent 进行异步懒加载分割
export const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery",
  component: lazyRouteComponent(() => import("./components/GalleryPage")),
});

// 单独 Playground 页面，支持文件导入与交互控制
export const playgroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/playground",
  component: PlaygroundPage,
});

export const routeTree = rootRoute.addChildren([indexRoute, galleryRoute, playgroundRoute]);

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}
