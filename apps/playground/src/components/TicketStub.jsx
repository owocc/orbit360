import React, { useRef, useState, useCallback } from "react";
import { Pure3DCard } from "./Pure3DCard";

export function TicketStub({
  materialId = "orbit",
  ticketNo = "02",
  date = "2026-11-04",
  title = "TRICK OR TREAT",
} = {}) {
  const containerRef = useRef(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [shine, setShine] = useState({ x: 50, y: 50, opacity: 0 });

  const handlePointerMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const px = (x / rect.width) * 2 - 1;
    const py = (y / rect.height) * 2 - 1;

    setRotate({
      x: -py * 12,
      y: px * 16,
    });

    setShine({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.65,
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    setRotate({ x: 0, y: 0 });
    setShine((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  return (
    <div
      className="perspective-1000 select-none py-6 px-2 flex items-center justify-center w-full"
      style={{ perspective: "1000px" }}
    >
      {/* 隐藏的 SVG 剪裁路径：直角票根 + 上下精确切除的凹圆齿孔 */}

      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: "preserve-3d",
          /* 直角票根 + SVG 镂空上下半圆缺口（彻底去除白色残留） */
          clipPath:
            "polygon(0% 0%, calc(72% - 10px) 0%, calc(72% - 10px) 0%, calc(72% - 9px) 1.5px, calc(72% - 7px) 3.5px, calc(72% - 4px) 6px, 72% 7px, calc(72% + 4px) 6px, calc(72% + 7px) 3.5px, calc(72% + 9px) 1.5px, calc(72% + 10px) 0%, 100% 0%, 100% 100%, calc(72% + 10px) 100%, calc(72% + 9px) calc(100% - 1.5px), calc(72% + 7px) calc(100% - 3.5px), calc(72% + 4px) calc(100% - 6px), 72% calc(100% - 7px), calc(72% - 4px) calc(100% - 6px), calc(72% - 7px) calc(100% - 3.5px), calc(72% - 9px) calc(100% - 1.5px), calc(72% - 10px) 100%, 0% 100%)",
        }}
        className="relative w-full max-w-[540px] h-[250px] sm:h-[270px] rounded-none bg-[#f5f3ec] text-neutral-900 shadow-[0_25px_60px_rgba(0,0,0,0.32)] transition-transform duration-150 ease-out cursor-grab active:cursor-grabbing flex"
      >
        {/* 全息珠光流光视差层 */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 mix-blend-color-dodge"
          style={{
            opacity: shine.opacity,
            background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.85) 0%, rgba(186,230,253,0.6) 30%, rgba(254,215,170,0.5) 55%, transparent 75%)`,
          }}
        />

        {/* 左侧大联：视频画布直接紧贴虚线分割线（边距清零） */}
        <div className="flex-1 h-full pt-3.5 pb-3.5 pl-4 pr-0 flex flex-col justify-between relative border-r-2 border-dashed border-neutral-400/80">
          {/* 顶部微型元信息 */}
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-500 tracking-wider pr-3">
            <span>{date}</span>
            <span className="text-[#ea580c] font-black text-sm">{ticketNo}</span>
            <div className="flex items-center gap-1.5">
              <span>TRICK OR TREAT</span>
              <span>+</span>
            </div>
          </div>

          {/* 核心视频画板：右边距彻底清零，与中轴虚线完全贴合 */}
          <div className="my-1.5 w-full flex-1 relative flex items-center justify-end">
            <div className="w-full h-full max-h-[168px] relative flex items-center justify-end overflow-hidden pr-0">
              {/* 四角星芒小装饰 */}
              <span className="absolute top-1 left-2 text-[10px] font-mono text-neutral-400 select-none z-20">
                ✦
              </span>

              {/* 核心 360° Canvas 实时模型视窗：紧贴虚线，直角对齐 */}
              <div className="w-full h-full rounded-l-xl rounded-r-none overflow-hidden relative shadow-sm border-y border-l border-neutral-300 dark:border-neutral-700 bg-black">
                <Pure3DCard
                  materialId={materialId}
                  aspectRatio="16/10"
                  autoSpin={true}
                  speed={15}
                  className="w-full h-full rounded-none"
                />
              </div>
            </div>
          </div>

          {/* 底部艺术大字题与 Halloween 标识 */}
          <div className="flex items-center justify-between text-[11px] font-mono pr-3">
            <span className="font-black tracking-widest uppercase text-neutral-800">{title}</span>
            <span className="text-[10px] font-semibold text-neutral-600 tracking-tight">
              Halloween · 360 SPECIMEN
            </span>
          </div>
        </div>

        {/* 右侧副券：条形码 + 存根信息 */}
        <div className="w-[28%] h-full p-3 sm:p-4 bg-[#ede8dc] flex flex-col justify-between text-neutral-800 font-mono select-none">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
              <span>PASS</span>
              <span>+</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-[#ea580c] leading-none tracking-tight">
              {ticketNo}
            </div>
            <div className="text-[9px] font-bold tracking-tight text-neutral-600 uppercase">
              ORBIT ADMIT
            </div>
          </div>

          {/* 虚线与信息 */}
          <div className="text-[8px] font-mono text-neutral-500 leading-tight border-t border-dashed border-neutral-400/80 pt-1.5">
            <div>2026-11-04</div>
            <div className="flex justify-between mt-0.5">
              <span>HALL</span>
              <span>SEAT</span>
              <span>PRICE</span>
            </div>
            <div className="flex justify-between font-bold text-neutral-700">
              <span>08</span>
              <span>15A</span>
              <span>$0.0</span>
            </div>
          </div>

          {/* 仿真条形码 */}
          <div className="space-y-1">
            <div className="w-full h-7 flex items-stretch gap-[1.5px] opacity-80">
              <span className="w-1 bg-black h-full" />
              <span className="w-0.5 bg-black h-full" />
              <span className="w-1.5 bg-black h-full" />
              <span className="w-0.5 bg-transparent h-full" />
              <span className="w-2 bg-black h-full" />
              <span className="w-0.5 bg-black h-full" />
              <span className="w-1 bg-transparent h-full" />
              <span className="w-1.5 bg-black h-full" />
              <span className="w-0.5 bg-black h-full" />
              <span className="w-2 bg-black h-full" />
              <span className="w-1 bg-black h-full" />
              <span className="w-0.5 bg-transparent h-full" />
              <span className="w-1.5 bg-black h-full" />
            </div>
            <div className="text-[8px] text-center tracking-widest text-neutral-600">
              4 952345 123459
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
