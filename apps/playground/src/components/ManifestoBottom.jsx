import React from "react";

export function ManifestoBottom() {
  return (
    <section className="py-16 border-b-2 border-neutral-900 bg-[#fbf9f4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* 左侧便签贴纸风格小部件 (Sticky note) */}
          <div className="md:col-span-4 flex justify-center">
            <div className="w-full max-w-[280px] p-5 bg-[#f4ebd0] border-2 border-neutral-900 shadow-[4px_4px_0px_#000000] rotate-[-2deg] rounded font-mono text-xs text-neutral-800 space-y-3 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-neutral-300/80 border border-neutral-400 rotate-1 rounded-xs" />
              <div className="font-bold text-black border-b border-neutral-400 pb-1 flex items-center justify-between">
                <span>LAB CHECKLIST</span>
                <span className="text-[10px]">2026.11</span>
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-neutral-800 inline-block bg-black" />
                  <span>TRANSPARENT BG READY</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-neutral-800 inline-block bg-black" />
                  <span>SHAPE CLIPPING PIPELINE</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-neutral-800 inline-block bg-black" />
                  <span>RESPONSIVE MULTI-CANVAS</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-neutral-800 inline-block bg-white" />
                  <span className="text-neutral-500">NEW MESH-FREE CODEC</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 右侧宣言文字 */}
          <div className="md:col-span-8 space-y-4">
            <div className="text-pink-600 font-mono text-xl font-bold select-none">✦</div>
            <p className="font-mono text-sm sm:text-base text-neutral-800 leading-relaxed max-w-2xl">
              这里是正在进化中的公开实验场。不是冷冰冰的商业宣传，而是记录从环绕视频到超轻量 3D
              实体交互的思考过程。无论素材背景是全景还是透明，都能通过极简的遮罩与切帧技术完美呈现。
            </p>
            <div className="pt-2">
              <a
                href="#featured"
                className="inline-flex items-center gap-2 font-mono text-xs font-bold text-black uppercase underline decoration-2 underline-offset-4 hover:text-[#ff4e7e] transition-colors"
              >
                <span>EXPLORE ALL EXPERIMENTS</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
