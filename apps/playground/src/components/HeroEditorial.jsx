import React from "react";
import { MaskedOrbitViewer } from "./MaskedOrbitViewer";

export function HeroEditorial() {
  return (
    <section className="py-12 md:py-16 border-b-2 border-neutral-900 bg-[#fbf9f4] relative overflow-hidden">
      {/* 极简网点与图形几何装饰 (纯 CSS/SVG，无 Emoji) */}
      <div className="absolute top-8 right-12 text-amber-500 font-mono text-2xl font-bold select-none opacity-80 pointer-events-none">
        *
      </div>
      <div className="absolute top-28 right-32 text-sky-500 font-mono text-xl font-bold select-none opacity-70 pointer-events-none">
        ◇
      </div>
      <div className="absolute bottom-10 left-10 text-neutral-400 font-mono text-xs select-none opacity-50 pointer-events-none">
        + + +<br />+ + +
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* 左侧大标题与技术清单 */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffb703] border-2 border-neutral-900 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_#000000]">
              ORBIT360 LABS DATABASE
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-neutral-950 uppercase leading-none font-sans">
              TOOLS, SKETCHES,
              <br />
              EXPERIMENTS, NOTES,
              <br />
              <span className="underline decoration-4 decoration-[#ff4e7e] underline-offset-4">
                STRANGE USEFUL
              </span>{" "}
              THINGS,
              <br />
              AND <span className="italic font-serif normal-case">360° frames.</span>
            </h1>

            <div className="pt-2 flex items-center gap-4 text-xs font-mono font-bold text-neutral-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ff4e7e]" />
                COLLECTING
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ffb703]" />
                ROTATING
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2a9d8f]" />
                BUILDING
              </span>
            </div>

            <p className="text-neutral-700 text-sm leading-relaxed max-w-xl font-mono">
              把一段 360° 环绕拍摄的视频打磨成「随手即转的轻量 3D 实体」：
              支持手机陀螺仪感知、手势惯性转动与丰富多变的遮罩形状裁剪。不仅省去全量建模流程，更可在单页面高效渲染数十个响应式并存视窗。
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <a
                href="#featured"
                className="px-5 py-2.5 bg-black text-white font-mono text-xs font-bold border-2 border-black shadow-[3px_3px_0px_#ff4e7e] hover:shadow-[1px_1px_0px_#ff4e7e] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                BROWSE SPECIMENS →
              </a>
              <a
                href="#color-blocks"
                className="px-5 py-2.5 bg-white text-black font-mono text-xs font-bold border-2 border-black shadow-[3px_3px_0px_#000000] hover:shadow-[1px_1px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                CATEGORIES MATRIX
              </a>
            </div>
          </div>

          {/* 右侧：特色大视窗（拱形遮罩 + 扩大光环背景装饰） */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[340px] sm:max-w-[380px]">
              <MaskedOrbitViewer
                src="/assets/maid/scene.orb"
                title="HERO SPECIMEN · 360°"
                showBadge={false}
                maskShape="arch"
                aspectRatio="4/5"
                accentColor="#ffb703"
                bgExpand="rings"
                className="w-full"
              />
              <div className="mt-4 p-3 bg-white border-2 border-neutral-900 rounded-lg shadow-[3px_3px_0px_#000000] text-[11px] font-mono text-neutral-600 flex items-center justify-between">
                <span>[DEMO] 几何轮廓剪裁 · 背后扩展环绕</span>
                <span className="font-bold text-black">DRAG TO SPIN</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
