import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IndexHome } from "../components/IndexHome";
import { MATERIAL_REGISTRY } from "../lib/materials";

export const Route = createFileRoute("/")({
  component: IndexHome,
  head: () => ({
    // 首屏卡片在 hydration 后才挂载；提前预加载封面，避免 .orb 下载期间出现空白。
    links: Object.values(MATERIAL_REGISTRY).map((material) => ({
      rel: "preload",
      as: "image",
      href: material.cover,
    })),
  }),
});
