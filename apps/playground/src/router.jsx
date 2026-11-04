import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import React from "react";
import { ModernCardApp } from "./components/ModernCardApp";

export const rootRoute = createRootRoute({
  component: function Root() {
    return <ModernCardApp />;
  },
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ModernCardApp,
});

export const routeTree = rootRoute.addChildren([indexRoute]);

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}
