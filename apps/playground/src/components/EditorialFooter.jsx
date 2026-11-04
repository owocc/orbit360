import React from "react";

export function EditorialFooter() {
  return (
    <footer className="bg-[#fbf9f4] text-neutral-900 border-t-2 border-neutral-900">
      {/* 底部醒目标语行 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b-2 border-neutral-900">
        <div className="md:col-span-4">
          <div className="font-mono text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">
            REMINDER
          </div>
          <div className="text-xl sm:text-2xl font-black font-sans text-black">
            想法廉价。
            <br />
            执行昂贵。
          </div>
        </div>

        <div className="md:col-span-5 bg-amber-400 p-6 border-2 border-neutral-900 shadow-[4px_4px_0px_#000000] rounded-lg">
          <div className="font-mono text-sm font-black text-black mb-1">ORBIT360.LABS</div>
          <p className="text-xs font-mono text-neutral-800 leading-relaxed">
            360° 视频重塑与切帧渲染引擎。
            <br />
            始终处于测试版，始终保持进化。
          </p>
        </div>

        <div className="md:col-span-3 flex flex-col gap-2 font-mono text-xs">
          <span className="font-bold text-black uppercase">QUICK LINKS</span>
          <a href="#featured" className="text-neutral-600 hover:text-black hover:underline">
            FEATURED LABS
          </a>
          <a href="#color-blocks" className="text-neutral-600 hover:text-black hover:underline">
            T-A-P-E-R MATRIX
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-neutral-600 hover:text-black hover:underline"
          >
            GITHUB SOURCE
          </a>
        </div>
      </div>

      {/* 版权底栏 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-neutral-600">
        <div>COLLECTING, ROTATING, CONNECTING, BUILDING.</div>
        <div>© 2026 ORBIT360 · BUILT WITH TANSTACK & BASE UI · NO EMOJI POLICY</div>
      </div>
    </footer>
  );
}
