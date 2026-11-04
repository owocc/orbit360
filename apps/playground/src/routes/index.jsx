import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "../components/HeroSection";
import { ShowcaseSection } from "../components/ShowcaseSection";
import { CapabilitiesSection } from "../components/CapabilitiesSection";
import { IntegrationSection } from "../components/IntegrationSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbit360 官方主页 - 360° 交互式模型视窗与 Web SDK" },
      {
        name: "description",
        content:
          "体验 Orbit360 在不同尺寸、比例及并发实例下的响应式表现，探究 .orb 二进制标准与多模态控制算法。",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="w-full">
      <HeroSection />
      <ShowcaseSection />
      <CapabilitiesSection />
      <IntegrationSection />
    </div>
  );
}
