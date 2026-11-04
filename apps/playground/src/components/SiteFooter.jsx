import React from "react";

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-800/80 bg-neutral-950 py-12 text-xs font-mono text-neutral-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-neutral-200" />
              <span>orbit360</span>
            </div>
            <p className="text-neutral-400 leading-relaxed text-[11px]">
              将 360° 环绕视频重塑为极低开销、可多端操控的伪 3D 交互实体的 Web 渲染引擎与 SDK 体系。
            </p>
          </div>

          <div>
            <div className="text-neutral-200 font-medium mb-3">产品架构</div>
            <ul className="space-y-2 text-[11px] text-neutral-400">
              <li>Web SDK 渲染核心 (@orbit360/javascript)</li>
              <li>场景打包工具链 (bundle.py)</li>
              <li>原生 GUI 控制面板 (Go / MyGo)</li>
              <li>二进制 .orb 容器标准</li>
            </ul>
          </div>

          <div>
            <div className="text-neutral-200 font-medium mb-3">技术底座</div>
            <ul className="space-y-2 text-[11px] text-neutral-400">
              <li>TanStack Start & Router</li>
              <li>Base UI Headless 架构</li>
              <li>Tailwind CSS 高性能样式库</li>
              <li>GSAP 时间轴动效系统</li>
            </ul>
          </div>

          <div>
            <div className="text-neutral-200 font-medium mb-3">协议与致敬</div>
            <ul className="space-y-2 text-[11px] text-neutral-400">
              <li>MIT License 开源许可</li>
              <li>灵感源自 monoradio 环绕切帧方案</li>
              <li>纯文本严谨工程设计</li>
              <li>零第三方分析追踪</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400">
          <div>© 2026 Orbit360 Project. 保留所有权利。</div>
          <div className="flex items-center gap-6">
            <span>克制 · 文本驱动 · 工业级精密设计</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
