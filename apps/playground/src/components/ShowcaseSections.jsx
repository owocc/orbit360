import React, { useRef, useState, useCallback } from "react";
import { CardSwap } from "./CardSwap";
import { Pure3DCard } from "./Pure3DCard";
import { FoldingBill } from "./FoldingBill";
import { AspectRatio } from "./AspectRatio";
import { TicketStub } from "./TicketStub";
import { WakeSlider } from "./WakeSlider";
import * as m from "../paraglide/messages.js";
import { ClientOnly } from "./ui/ClientOnly";
export function ShowcaseSections() {
  const section2CardRef = useRef(null);
  const ticketRef = useRef(null);

  // 板块2 3D画板角度（-180°..+180°）
  const [angleValue, setAngleValue] = useState(0);

  // 板块5 票根翻转旋转角度（-180°..+180°）
  const [ticketAngle, setTicketAngle] = useState(0);

  // 1. 板块2 滑块驱动 3D 画板
  const handleSliderChange = (deg) => {
    setAngleValue(deg);
    const client = section2CardRef.current?.getClient?.();
    if (client) {
      client.setAngle?.(deg);
    }
  };

  const handleCardAngleChange = useCallback((deg) => {
    setAngleValue(Math.round(deg));
  }, []);

  // 2. 票根滑块驱动票根翻转
  const handleTicketSliderChange = (deg) => {
    setTicketAngle(deg);
    ticketRef.current?.setAngle?.(deg);
  };

  const handleTicketAngleChange = useCallback((deg) => {
    setTicketAngle(Math.round(deg));
  }, []);

  return (
    <div className="w-full space-y-28 pt-12 pb-24">
      {/* 模块 1: 左文本 + 右 CardSwap 炫技展示 */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>{m.sections_s1_tag()}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            {m.sections_s1_title_1()}
            <br />
            {m.sections_s1_title_2()}
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            {m.sections_s1_desc()}
          </p>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              {m.sections_s1_tip()}
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <ClientOnly
            fallback={
              <div className="w-[280px] h-[373px] rounded-[24px] bg-neutral-100 dark:bg-neutral-800/60" />
            }
          >
            <CardSwap auto={false} />
          </ClientOnly>
        </div>
      </section>

      {/* 模块 2: 左 3D 画板演示 + 右文本 */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 flex flex-col items-center justify-center lg:items-start order-2 lg:order-1 space-y-3">
          <div className="w-full max-w-[420px] aspect-[4/5] relative">
            <Pure3DCard
              ref={section2CardRef}
              materialId="maid"
              aspectRatio="4/5"
              autoSpin={false}
              speed={0}
              onAngleChange={handleCardAngleChange}
              className="w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]"
            />
          </div>

          <div className="w-full max-w-[420px] flex items-center justify-center pt-2">
            <WakeSlider
              bars={36}
              wake={70}
              min={-180}
              max={180}
              value={angleValue}
              onChange={handleSliderChange}
            />
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>{m.sections_s2_tag()}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            {m.sections_s2_title_1()}
            <br />
            {m.sections_s2_title_2()}
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            {m.sections_s2_desc()}
          </p>

          <div className="pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              {m.sections_s2_tip()}
            </span>
          </div>
        </div>
      </section>

      {/* 模块 3: 左文本 + 右动态布料晶体折叠 */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>{m.sections_s3_tag()}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            {m.sections_s3_title_1()}
            <br />
            {m.sections_s3_title_2()}
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            {m.sections_s3_desc()}
          </p>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              {m.sections_s3_tip()}
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-[500px] flex items-center justify-center min-h-[300px] overflow-hidden">
            <ClientOnly
              fallback={
                <div className="w-full h-[300px] rounded-2xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
              }
            >
              <FoldingBill materialId="maid" stiffness={38} settle={10} />
            </ClientOnly>
          </div>
        </div>
      </section>

      {/* 模块 4: 左 AspectRatio 自适应等面积变形演示 + 右文本 */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 flex justify-center lg:justify-start order-2 lg:order-1">
          <div className="w-full max-w-[500px] flex items-center justify-center min-h-[340px]">
            <ClientOnly
              fallback={
                <div className="w-[276px] h-[368px] rounded-[24px] bg-neutral-100 dark:bg-neutral-800/60" />
              }
            >
              <AspectRatio materialId="maid" interactive3D={true} morph={50} corner={24} />
            </ClientOnly>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>{m.sections_s4_tag()}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            {m.sections_s4_title_1()}
            <br />
            {m.sections_s4_title_2()}
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            {m.sections_s4_desc()}
          </p>

          <div className="pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              {m.sections_s4_tip()}
            </span>
          </div>
        </div>
      </section>

      {/* 模块 5: 左文本 + 右 TicketStub 3D 自由翻转全息视差票根 + 尾波滑块联动 */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>{m.sections_s5_tag()}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            {m.sections_s5_title_1()}
            <br />
            {m.sections_s5_title_2()}
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            {m.sections_s5_desc()}
          </p>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              {m.sections_s5_tip()}
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col items-center justify-center lg:items-end w-full space-y-3">
          <div className="w-full max-w-[540px] flex items-center justify-center">
            <ClientOnly
              fallback={
                <div className="w-full max-w-[500px] h-[200px] rounded-2xl bg-neutral-100 dark:bg-neutral-800/60" />
              }
            >
              <TicketStub
                ref={ticketRef}
                materialId="orbit"
                ticketNo="02"
                title="TRICK OR TREAT"
                date="2026-11-04"
                angle={ticketAngle}
                onAngleChange={handleTicketAngleChange}
              />
            </ClientOnly>
          </div>
          <div className="w-full max-w-[540px] flex items-center justify-center pt-2">
            <WakeSlider
              bars={36}
              wake={70}
              min={-180}
              max={180}
              value={ticketAngle}
              onChange={handleTicketSliderChange}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
