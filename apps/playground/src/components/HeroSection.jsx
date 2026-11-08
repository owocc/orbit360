import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { OrbitViewer } from "./OrbitViewer";

export function HeroSection() {
  const containerRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const metricsRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(titleRef.current, {
        y: 28,
        opacity: 0,
        duration: 0.8,
        delay: 0.1,
      })
        .from(
          subtitleRef.current,
          {
            y: 20,
            opacity: 0,
            duration: 0.7,
          },
          "-=0.5",
        )
        .from(
          metricsRef.current?.children || [],
          {
            y: 16,
            opacity: 0,
            duration: 0.6,
            stagger: 0.12,
          },
          "-=0.4",
        )
        .from(
          previewRef.current,
          {
            scale: 0.96,
            opacity: 0,
            duration: 0.9,
          },
          "-=0.6",
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      {/* 极简网格背景 */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* 左侧叙述 */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-neutral-800 bg-neutral-900/60 font-mono text-[11px] text-neutral-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>纯 Canvas 单帧硬切 · 无视频播放器开销</span>
            </div>

            <h1
              ref={titleRef}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
            >
              将 360° 环绕视频重塑为
              <br />
              <span className="text-neutral-400 font-normal">可操控的超轻量 3D 实体</span>
            </h1>

            <p
              ref={subtitleRef}
              className="text-neutral-400 text-sm sm:text-base leading-relaxed max-w-xl"
            >
              手机陀螺仪感知视角，左右手势惯性转动，画面按离散角度精准切帧。无需 3D 建模，无需 WebGL
              显存重负，单个二进制 .orb 容器呈现真实光影。
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#showcase"
                className="px-5 py-2.5 text-xs font-mono font-medium rounded bg-white text-neutral-950 hover:bg-neutral-200 transition-colors shadow-sm"
              >
                多视窗并发测试
              </a>
              <a
                href="#integration"
                className="px-5 py-2.5 text-xs font-mono rounded border border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
              >
                集成指南
              </a>
            </div>

            {/* 核心指标矩阵 */}
            <div
              ref={metricsRef}
              className="grid grid-cols-3 gap-4 pt-6 border-t border-neutral-900 font-mono"
            >
              <div>
                <div className="text-neutral-500 text-[10px] uppercase">体积压缩率</div>
                <div className="text-xl font-bold text-white mt-1">&gt; 90%</div>
                <div className="text-neutral-500 text-[11px]">对比原生 4K</div>
              </div>
              <div>
                <div className="text-neutral-500 text-[10px] uppercase">交互延迟</div>
                <div className="text-xl font-bold text-white mt-1">&lt; 1ms</div>
                <div className="text-neutral-500 text-[11px]">内存单帧硬切</div>
              </div>
              <div>
                <div className="text-neutral-500 text-[10px] uppercase">依赖体积</div>
                <div className="text-xl font-bold text-white mt-1">&lt; 18KB</div>
                <div className="text-neutral-500 text-[11px]">Gzip 零外部包</div>
              </div>
            </div>
          </div>

          {/* 右侧主交互模型预览台 */}
          <div ref={previewRef} className="lg:col-span-6">
            <div className="relative rounded-xl p-2 bg-gradient-to-b from-neutral-800/40 via-neutral-900/20 to-transparent border border-neutral-800/80 shadow-2xl">
              <OrbitViewer
                src="/assets/maid/scene.orb"
                title="首屏实时模型: 沙发少女"
                aspectRatio="16/10"
                autoSpin={true}
                className="w-full min-h-[340px] sm:min-h-[420px]"
              />
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-neutral-500 px-2">
                <span>提示: 支持在画面上按住左右拖拽交互</span>
                <span>.orb 容器驱动</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
