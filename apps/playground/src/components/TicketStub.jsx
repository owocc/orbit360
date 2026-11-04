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
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: "preserve-3d",
          /* 直角票根外廓 + 上下切入镂空的凹圆打孔 */
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

        {/* 左侧大联：与中轴虚线留出通透空隙 */}
        <div className="flex-1 h-full p-3.5 sm:p-4 flex flex-col justify-between relative border-r-2 border-dashed border-neutral-400/80">
          {/* 顶部微型元信息 */}
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-500 tracking-wider">
            <span>{date}</span>
            <span className="text-[#ea580c] font-black text-sm">{ticketNo}</span>
            <div className="flex items-center gap-1.5">
              <span>TRICK OR TREAT</span>
              <span>+</span>
            </div>
          </div>

          {/* 核心视频画板：留出空隙 + 不规则邮票齿孔锯齿裁切 (Stamp Edge Clipping) */}
          <div className="my-1.5 w-full flex-1 relative flex items-center justify-center px-1">
            <div className="w-full h-full max-h-[160px] relative flex items-center justify-center">
              {/* 四角星芒小装饰 */}
              <span className="absolute -top-1 left-1 text-[10px] font-mono text-neutral-400 select-none z-20">
                ✦
              </span>

              {/* 核心 360° Canvas 实时模型视窗：采用不规则邮票锯齿边缘裁剪 (Stamp Edge Mask) */}
              <div
                style={{
                  clipPath:
                    "polygon(0% 0%, 5% 0%, 7% 3%, 9% 0%, 14% 0%, 16% 3%, 18% 0%, 23% 0%, 25% 3%, 27% 0%, 32% 0%, 34% 3%, 36% 0%, 41% 0%, 43% 3%, 45% 0%, 50% 0%, 52% 3%, 54% 0%, 59% 0%, 61% 3%, 63% 0%, 68% 0%, 70% 3%, 72% 0%, 77% 0%, 79% 3%, 81% 0%, 86% 0%, 88% 3%, 90% 0%, 95% 0%, 97% 3%, 100% 0%, 100% 7%, 97% 9%, 100% 11%, 100% 18%, 97% 20%, 100% 22%, 100% 29%, 97% 31%, 100% 33%, 100% 40%, 97% 42%, 100% 44%, 100% 51%, 97% 53%, 100% 55%, 100% 62%, 97% 64%, 100% 66%, 100% 73%, 97% 75%, 100% 77%, 100% 84%, 97% 86%, 100% 88%, 100% 95%, 97% 97%, 100% 100%, 95% 100%, 93% 97%, 91% 100%, 86% 100%, 84% 97%, 82% 100%, 77% 100%, 75% 97%, 73% 100%, 68% 100%, 66% 97%, 64% 100%, 59% 100%, 57% 97%, 55% 100%, 50% 100%, 48% 97%, 46% 100%, 41% 100%, 39% 97%, 37% 100%, 32% 100%, 30% 97%, 28% 100%, 23% 100%, 21% 97%, 19% 100%, 14% 100%, 12% 97%, 10% 100%, 5% 100%, 3% 97%, 0% 100%, 0% 95%, 3% 93%, 0% 91%, 0% 84%, 3% 82%, 0% 80%, 0% 73%, 3% 71%, 0% 69%, 0% 62%, 3% 60%, 0% 58%, 0% 51%, 3% 49%, 0% 47%, 0% 40%, 3% 38%, 0% 36%, 0% 29%, 3% 27%, 0% 25%, 0% 18%, 3% 16%, 0% 14%, 0% 7%, 3% 5%, 0% 0%)",
                }}
                className="w-full h-full relative overflow-hidden shadow-md bg-neutral-900"
              >
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
          <div className="flex items-center justify-between text-[11px] font-mono">
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
