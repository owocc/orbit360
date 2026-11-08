import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Pure3DCard } from "./Pure3DCard";

export const TicketStub = forwardRef(function TicketStub(
  {
    materialId = "orbit",
    ticketNo = "02",
    date = "2026-11-04",
    title = "TRICK OR TREAT",
    angle = 0,
    onAngleChange,
  } = {},
  ref,
) {
  const containerRef = useRef(null);
  const cardFrontRef = useRef(null);
  const cardBackRef = useRef(null);
  const [rotate, setRotate] = useState({ x: 0, y: angle });
  const [shine, setShine] = useState({ x: 50, y: 50, opacity: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, rotX: 0, rotY: 0 });

  // 暴露给父级（如 WakeSlider）直接设定旋转角
  useImperativeHandle(ref, () => ({
    setAngle: (newAngle) => {
      setRotate((prev) => ({ ...prev, y: newAngle }));
      // 联动内部 360° 模型
      cardFrontRef.current?.getClient?.()?.setAngle?.(newAngle);
      cardBackRef.current?.getClient?.()?.setAngle?.(newAngle);
    },
    getAngle: () => rotate.y,
  }));

  // 同步受控 angle 变化
  const currentY = typeof angle === "number" ? angle : rotate.y;

  // 1. 指针悬停微视差
  const handlePointerMoveHover = useCallback((e) => {
    if (isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const py = (y / rect.height) * 2 - 1;

    setRotate((prev) => ({
      ...prev,
      x: -py * 12,
    }));

    setShine({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.65,
    });
  }, []);

  // 2. 拖拽全景旋转票根（支持直接翻转到票根背部，前后 Canvas 角度实时同步联动）
  const handlePointerDown = (e) => {
    if (e.target.closest(".ticket-canvas-wrap")) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX: rotate.x,
      rotY: currentY,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const nextY = Math.max(-180, Math.min(180, dragStartRef.current.rotY + dx * 0.7));
      const nextX = Math.max(-65, Math.min(65, dragStartRef.current.rotX - dy * 0.5));
      setRotate({ x: nextX, y: nextY });
      onAngleChange?.(nextY);

      // 同步驱动正面与背面的 360° Canvas 模型
      const clientFront = cardFrontRef.current?.getClient?.();
      if (clientFront) clientFront.setAngle?.(nextY);

      const clientBack = cardBackRef.current?.getClient?.();
      if (clientBack) clientBack.setAngle?.(nextY);
    } else {
      handlePointerMoveHover(e);
    }
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerLeave = useCallback(() => {
    if (!isDraggingRef.current) {
      setRotate((prev) => ({ ...prev, x: 0 }));
      setShine((prev) => ({ ...prev, opacity: 0 }));
    }
  }, []);

  return (
    <div
      className="perspective-1000 select-none py-2 px-1 flex items-center justify-center w-full"
      style={{ perspective: "1200px" }}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${currentY}deg)`,
          transformStyle: "preserve-3d",
        }}
        className="relative w-full max-w-[540px] aspect-[16/9.6] sm:aspect-[16/8.2] cursor-grab active:cursor-grabbing transition-transform duration-75 ease-out"
      >
        {/* 正面（Front Ticket）：直角票根 + 上下切入镂空的凹圆打孔 */}
        <div
          style={{
            backfaceVisibility: "hidden",
            clipPath:
              "polygon(0% 0%, calc(72% - 10px) 0%, calc(72% - 10px) 0%, calc(72% - 9px) 1.5px, calc(72% - 7px) 3.5px, calc(72% - 4px) 6px, 72% 7px, calc(72% + 4px) 6px, calc(72% + 7px) 3.5px, calc(72% + 9px) 1.5px, calc(72% + 10px) 0%, 100% 0%, 100% 100%, calc(72% + 10px) 100%, calc(72% + 9px) calc(100% - 1.5px), calc(72% + 7px) calc(100% - 3.5px), calc(72% + 4px) calc(100% - 6px), 72% calc(100% - 7px), calc(72% - 4px) calc(100% - 6px), calc(72% - 7px) calc(100% - 3.5px), calc(72% - 9px) calc(100% - 1.5px), calc(72% - 10px) 100%, 0% 100%)",
          }}
          className="absolute inset-0 w-full h-full rounded-none bg-[#f5f3ec] text-neutral-900 shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex overflow-hidden"
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
          <div className="flex-1 h-full p-2 xs:p-2.5 sm:p-4 flex flex-col justify-between relative border-r-2 border-dashed border-neutral-400/80 overflow-hidden">
            <div className="flex items-center justify-between text-[9px] xs:text-[10px] font-mono font-bold text-neutral-500 tracking-wider">
              <span>{date}</span>
              <span className="text-[#ea580c] font-black text-xs xs:text-sm">{ticketNo}</span>
              <div className="flex items-center gap-1">
                <span className="truncate max-w-[80px] xs:max-w-none">TRICK OR TREAT</span>
                <span>+</span>
              </div>
            </div>

            {/* 核心视频画板：不规则邮票齿孔锯齿裁切 (Stamp Edge Clipping) */}
            <div className="my-1 w-full flex-1 relative flex items-center justify-center px-0.5 ticket-canvas-wrap min-h-0">
              <div className="w-full h-full relative flex items-center justify-center min-h-0">
                <span className="absolute -top-1 left-1 text-[10px] font-mono text-neutral-400 select-none z-20">
                  ✦
                </span>

                <div
                  style={{
                    clipPath:
                      "polygon(0% 0%, 5% 0%, 7% 3%, 9% 0%, 14% 0%, 16% 3%, 18% 0%, 23% 0%, 25% 3%, 27% 0%, 32% 0%, 34% 3%, 36% 0%, 41% 0%, 43% 3%, 45% 0%, 50% 0%, 52% 3%, 54% 0%, 59% 0%, 61% 3%, 63% 0%, 68% 0%, 70% 3%, 72% 0%, 77% 0%, 79% 3%, 81% 0%, 86% 0%, 88% 3%, 90% 0%, 95% 0%, 97% 3%, 100% 0%, 100% 7%, 97% 9%, 100% 11%, 100% 18%, 97% 20%, 100% 22%, 100% 29%, 97% 31%, 100% 33%, 100% 40%, 97% 42%, 100% 44%, 100% 51%, 97% 53%, 100% 55%, 100% 62%, 97% 64%, 100% 66%, 100% 73%, 97% 75%, 100% 77%, 100% 84%, 97% 86%, 100% 88%, 100% 95%, 97% 97%, 100% 100%, 95% 100%, 93% 97%, 91% 100%, 86% 100%, 84% 97%, 82% 100%, 77% 100%, 75% 97%, 73% 100%, 68% 100%, 66% 97%, 64% 100%, 59% 100%, 57% 97%, 55% 100%, 50% 100%, 48% 97%, 46% 100%, 41% 100%, 39% 97%, 37% 100%, 32% 100%, 30% 97%, 28% 100%, 23% 100%, 21% 97%, 19% 100%, 14% 100%, 12% 97%, 10% 100%, 5% 100%, 3% 97%, 0% 100%, 0% 93%, 3% 91%, 0% 89%, 0% 82%, 3% 80%, 0% 78%, 0% 71%, 3% 69%, 0% 67%, 0% 60%, 3% 58%, 0% 56%, 0% 49%, 3% 47%, 0% 45%, 0% 38%, 3% 36%, 0% 34%, 0% 27%, 3% 25%, 0% 23%, 0% 16%, 3% 14%, 0% 12%, 0% 5%, 3% 3%, 0% 0%)",
                  }}
                  className="w-full h-full relative overflow-hidden shadow-md bg-neutral-900"
                >
                  <Pure3DCard
                    ref={cardFrontRef}
                    materialId={materialId}
                    aspectRatio="16/9.5"
                    autoSpin={true}
                    className="w-full h-full rounded-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] xs:text-[11px] font-mono">
              <span className="font-black tracking-wider uppercase text-neutral-800 truncate">
                {title}
              </span>
              <span className="text-[8px] xs:text-[10px] font-semibold text-neutral-600 tracking-tight whitespace-nowrap ml-1">
                360 SPECIMEN
              </span>
            </div>
          </div>

          {/* 右侧副券 */}
          <div className="w-[28%] h-full p-1.5 xs:p-2 sm:p-4 bg-[#ede8dc] flex flex-col justify-between text-neutral-800 font-mono select-none overflow-hidden">
            <div className="space-y-0.5 xs:space-y-1">
              <div className="flex justify-between items-center text-[8px] xs:text-[10px] font-bold text-neutral-500">
                <span>PASS</span>
                <span>+</span>
              </div>
              <div className="text-2xl xs:text-3xl sm:text-4xl font-black text-[#ea580c] leading-none tracking-tight">
                {ticketNo}
              </div>
              <div className="text-[8px] xs:text-[9px] font-bold tracking-tight text-neutral-600 uppercase">
                ORBIT ADMIT
              </div>
            </div>

            <div className="text-[7px] xs:text-[8px] font-mono text-neutral-500 leading-tight border-t border-dashed border-neutral-400/80 pt-1">
              <div>{date}</div>
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

            <div className="space-y-0.5">
              <div className="w-full h-5 xs:h-6 sm:h-7 flex items-stretch gap-[1px] xs:gap-[1.5px] opacity-80">
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
              <div className="text-[7px] xs:text-[8px] text-center tracking-widest text-neutral-600">
                4 952345 123459
              </div>
            </div>
          </div>
        </div>

        {/* 背面（Backside Ticket）：翻转至 180°，背面同样内嵌邮票锯齿 360° Canvas，令人眼前一亮！ */}
        <div
          style={{
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            clipPath:
              "polygon(0% 0%, calc(28% - 10px) 0%, calc(28% - 10px) 0%, calc(28% - 9px) 1.5px, calc(28% - 7px) 3.5px, calc(28% - 4px) 6px, 28% 7px, calc(28% + 4px) 6px, calc(28% + 7px) 3.5px, calc(28% + 9px) 1.5px, calc(28% + 10px) 0%, 100% 0%, 100% 100%, calc(28% + 10px) 100%, calc(28% + 9px) calc(100% - 1.5px), calc(28% + 7px) calc(100% - 3.5px), calc(28% + 4px) calc(100% - 6px), 28% calc(100% - 7px), calc(28% - 4px) calc(100% - 6px), calc(28% - 7px) calc(100% - 3.5px), calc(28% - 9px) calc(100% - 1.5px), calc(28% - 10px) 100%, 0% 100%)",
          }}
          className="absolute inset-0 w-full h-full rounded-none bg-[#ece8dc] text-neutral-800 flex shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)] border border-neutral-300 select-none overflow-hidden"
        >
          {/* 背面左联（对应正面的副券背面） */}
          <div className="w-[28%] h-full p-2 xs:p-2.5 sm:p-4 bg-[#e5e0d2] flex flex-col justify-between border-r-2 border-dashed border-neutral-400/80 font-mono text-[8px] xs:text-[9px] text-neutral-600 overflow-hidden">
            <div>
              <div className="font-bold text-neutral-900 text-[10px] xs:text-xs">SPECIMEN</div>
              <div className="text-[#ea580c] font-black text-xs xs:text-sm mt-0.5">
                180° REVERSE
              </div>
            </div>
            <div className="space-y-0.5 my-auto">
              <div className="font-bold text-neutral-800 text-[8px] xs:text-[9px]">PERMITTED</div>
              <p className="leading-tight text-[7px] xs:text-[8px] text-neutral-500">
                双面实体透视凭证。前后邮票同轴联动。
              </p>
            </div>
            <div className="pt-1 border-t border-dashed border-neutral-400/80 font-bold text-neutral-700 text-[8px] xs:text-[9px]">
              OK · PASS
            </div>
          </div>

          {/* 背面大联：同样拥有锯齿邮票 Canvas 视窗！ */}
          <div className="flex-1 h-full p-2 xs:p-2.5 sm:p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center font-mono text-[8px] xs:text-[10px] text-neutral-600 font-bold border-b border-dashed border-neutral-400 pb-0.5">
              <span>BACKSIDE 360° PERSPECTIVE</span>
              <span className="text-[#ea580c] font-black">CANVAS INSIDE</span>
            </div>
            {/* 背面核心 3D 邮票锯齿画板 */}
            <div className="my-1 w-full flex-1 relative flex items-center justify-center px-0.5 ticket-canvas-wrap min-h-0">
              <div className="w-full h-full relative flex items-center justify-center min-h-0">
                <div
                  style={{
                    clipPath:
                      "polygon(0% 0%, 5% 0%, 7% 3%, 9% 0%, 14% 0%, 16% 3%, 18% 0%, 23% 0%, 25% 3%, 27% 0%, 32% 0%, 34% 3%, 36% 0%, 41% 0%, 43% 3%, 45% 0%, 50% 0%, 52% 3%, 54% 0%, 59% 0%, 61% 3%, 63% 0%, 68% 0%, 70% 3%, 72% 0%, 77% 0%, 79% 3%, 81% 0%, 86% 0%, 88% 3%, 90% 0%, 95% 0%, 97% 3%, 100% 0%, 100% 7%, 97% 9%, 100% 11%, 100% 18%, 97% 20%, 100% 22%, 100% 29%, 97% 31%, 100% 33%, 100% 40%, 97% 42%, 100% 44%, 100% 51%, 97% 53%, 100% 55%, 100% 62%, 97% 64%, 100% 66%, 100% 73%, 97% 75%, 100% 77%, 100% 84%, 97% 86%, 100% 88%, 100% 95%, 97% 97%, 100% 100%, 95% 100%, 93% 97%, 91% 100%, 86% 100%, 84% 97%, 82% 100%, 77% 100%, 75% 97%, 73% 100%, 68% 100%, 66% 97%, 64% 100%, 59% 100%, 57% 97%, 55% 100%, 50% 100%, 48% 97%, 46% 100%, 41% 100%, 39% 97%, 37% 100%, 32% 100%, 30% 97%, 28% 100%, 23% 100%, 21% 97%, 19% 100%, 14% 100%, 12% 97%, 10% 100%, 5% 100%, 3% 97%, 0% 100%, 0% 93%, 3% 91%, 0% 89%, 0% 82%, 3% 80%, 0% 78%, 0% 71%, 3% 69%, 0% 67%, 0% 60%, 3% 58%, 0% 56%, 0% 49%, 3% 47%, 0% 45%, 0% 38%, 3% 36%, 0% 34%, 0% 27%, 3% 25%, 0% 23%, 0% 16%, 3% 14%, 0% 12%, 0% 5%, 3% 3%, 0% 0%)",
                  }}
                  className="w-full h-full relative overflow-hidden shadow-md bg-neutral-900"
                >
                  <Pure3DCard
                    ref={cardBackRef}
                    materialId={materialId}
                    aspectRatio="16/9.5"
                    autoSpin={true}
                    className="w-full h-full rounded-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center font-mono text-[8px] xs:text-[10px] text-neutral-500 pt-0.5 border-t border-dashed border-neutral-400">
              <span className="truncate">ORBIT360 DUAL-FACED PERSPECTIVE</span>
              <span className="font-bold text-neutral-700 whitespace-nowrap ml-1">
                60FPS CANVAS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
