import React, { useState } from "react";
import { OrbitViewer } from "./OrbitViewer";

export function ShowcaseSection() {
  const [selectedScene, setSelectedScene] = useState("maid");

  const scenes = {
    maid: {
      id: "maid",
      title: "沙发少女 (高精度 3840x2160 源)",
      path: "/assets/maid/scene.orb",
      aspect: "16/9",
      desc: "高分辨率人像模型展示，验证微小光影细节与连续角度下的流畅质感。",
    },
    orbit: {
      id: "orbit",
      title: "环绕视角 (标准 1280x720 源)",
      path: "/assets/orbit/scene.orb",
      aspect: "16/9",
      desc: "全景环绕闭环测试模型，首尾闭环率 0.952，支持全角度无缝无限自旋与拖拽。",
    },
  };

  const current = scenes[selectedScene];

  return (
    <section id="showcase" className="py-20 border-t border-neutral-800/80 bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-neutral-500 font-mono text-xs uppercase tracking-widest mb-2">
              Multi-Instance & Responsive Render
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              单页面多尺寸并发渲染实测
            </h2>
            <p className="text-neutral-400 text-sm max-w-2xl">
              一个页面可以同时挂载多个独立的 OrbitViewer
              实例。下方展示主宽屏视窗、垂直手机比例视窗、以及方形网格视窗并存工作的能力，支持同时交互、独立陀螺仪与平滑切帧。
            </p>
          </div>

          <div className="flex items-center gap-2 p-1 bg-neutral-900 border border-neutral-800 rounded-md">
            <button
              type="button"
              onClick={() => setSelectedScene("maid")}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                selectedScene === "maid"
                  ? "bg-neutral-800 text-white font-medium shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              素材 A: 沙发少女
            </button>
            <button
              type="button"
              onClick={() => setSelectedScene("orbit")}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                selectedScene === "orbit"
                  ? "bg-neutral-800 text-white font-medium shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              素材 B: 环绕视角
            </button>
          </div>
        </div>

        {/* 多尺寸网格排布 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* 左侧：主视窗 (宽屏 16:9 响应式) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400 px-1">
              <span>主宽屏视窗 (16:9 · 默认自旋 · 支持水平拖拽)</span>
              <span className="text-neutral-500">实例 #01</span>
            </div>
            <div className="flex-1 w-full min-h-[360px] sm:min-h-[460px]">
              <OrbitViewer
                src={current.path}
                title={current.title}
                aspectRatio="16/9"
                autoSpin={true}
                className="w-full h-full shadow-2xl"
              />
            </div>
            <div className="text-[12px] font-mono text-neutral-400 px-1 leading-relaxed">
              {current.desc}
            </div>
          </div>

          {/* 右侧：纵向与多维度微视窗群 */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* 视窗 #02: 垂直构图视窗 (4:5 比例) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 px-1">
                <span>垂直卡片 (4:5 · 慢速自旋)</span>
                <span className="text-neutral-500">实例 #02</span>
              </div>
              <div className="w-full h-[260px]">
                <OrbitViewer
                  src={
                    selectedScene === "maid" ? "/assets/orbit/scene.orb" : "/assets/maid/scene.orb"
                  }
                  title={selectedScene === "maid" ? "次级对比: 环绕视角" : "次级对比: 沙发少女"}
                  aspectRatio="4/5"
                  autoSpin={true}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* 视窗 #03: 1:1 正方形缩略视窗 (快速手势微调) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 px-1">
                <span>正方徽标 (1:1 · 手动拖拽归零)</span>
                <span className="text-neutral-500">实例 #03</span>
              </div>
              <div className="w-full h-[220px]">
                <OrbitViewer
                  src={current.path}
                  title="紧凑缩略图"
                  aspectRatio="1/1"
                  autoSpin={false}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 响应式多列排布测试行 (4 列相同或不同尺寸并行) */}
        <div className="mt-12 pt-8 border-t border-neutral-900">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400 mb-4 px-1">
            <span>响应式阵列 (4 实例并发同步运转 · 极端负载测试)</span>
            <span className="text-neutral-500">实例 #04 - #07</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-48 sm:h-56">
              <OrbitViewer
                src="/assets/maid/scene.orb"
                title="视角 A"
                aspectRatio="1/1"
                autoSpin={true}
                showControls={false}
                className="w-full h-full"
              />
            </div>
            <div className="h-48 sm:h-56">
              <OrbitViewer
                src="/assets/orbit/scene.orb"
                title="视角 B"
                aspectRatio="1/1"
                autoSpin={true}
                showControls={false}
                className="w-full h-full"
              />
            </div>
            <div className="h-48 sm:h-56">
              <OrbitViewer
                src="/assets/maid/scene.orb"
                title="视角 C"
                aspectRatio="1/1"
                autoSpin={true}
                showControls={false}
                className="w-full h-full"
              />
            </div>
            <div className="h-48 sm:h-56">
              <OrbitViewer
                src="/assets/orbit/scene.orb"
                title="视角 D"
                aspectRatio="1/1"
                autoSpin={true}
                showControls={false}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
