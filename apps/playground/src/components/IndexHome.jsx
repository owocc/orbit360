import React from "react";
import { HeroCardStack } from "./HeroCardStack";
import { ShowcaseSections } from "./ShowcaseSections";

export function IndexHome() {
  return (
    <div className="w-full">
      {/* Hero 部分：完全无外层容器 padding，实现真正纯净的全宽视口铺满 */}
      <HeroCardStack />

      {/* 后续板块部分：单独设置专属的自适应 max-w-7xl 与水平内边距 */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ShowcaseSections />
      </div>
    </div>
  );
}
