import React from "react";
import { HeroEditorial } from "./HeroEditorial";
import { FeaturedRow } from "./FeaturedRow";
import { TaperBentoSection } from "./TaperBentoSection";
import { ManifestoBottom } from "./ManifestoBottom";
import { CapabilitiesSection } from "./CapabilitiesSection";
import { IntegrationSection } from "./IntegrationSection";

export function HomePage() {
  return (
    <div className="w-full bg-[#fbf9f4]">
      {/* 1. 复古海报 Hero 区域 (拱形遮罩 + 背后轮廓扩展) */}
      <HeroEditorial />

      {/* 2. 精选 3 列卡片 (Squircle / Pill / Stamp 遮罩 + 星芒/点阵/光晕背后扩大层) */}
      <FeaturedRow />

      {/* 3. T-A-P-E-R 5 色块矩阵 (粉/黄/橙/蓝/黑 5 个独立尺寸裁切视窗) */}
      <TaperBentoSection />

      {/* 4. 实验室便签清单与宣言 */}
      <ManifestoBottom />

      {/* 5. 架构能力与规格对比 (Base UI 选项卡与折叠面板，适配编辑风格) */}
      <CapabilitiesSection />

      {/* 6. 开发者代码快速集成 */}
      <IntegrationSection />
    </div>
  );
}
