import React from "react";
import { CardSwap } from "./CardSwap";
import { Pure3DCard } from "./Pure3DCard";

export function ShowcaseSections() {
  return (
    <div className="w-full space-y-24 pt-12 pb-24">
      {/* 模块 1: 左文本 + 右 CardSwap 炫技展示 */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>DEPTH STACK MOTION</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            物理惯性层叠，
            <br />
            重塑 3D 交互手感。
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            基于三维景深排列与动力学手势阻尼。轻按顶部卡片即可甩动翻转至栈底，其余卡片同步步进前移。支持自动定时轮播与触摸交互瞬时无缝接管。
          </p>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              提示：可直接拖拽甩动右侧卡片体验翻转
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="p-4 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
            <CardSwap auto={false} />
          </div>
        </div>
      </section>

      {/* 模块 2: 左 3D 画板演示 + 右文本（交叉进行） */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 flex justify-center lg:justify-start order-2 lg:order-1">
          <div className="w-full max-w-[420px] aspect-[4/5]">
            <Pure3DCard
              src="assets/maid/scene.orb"
              aspectRatio="4/5"
              autoSpin={true}
              speed={14}
              className="w-full h-full"
            />
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>RAW PIXEL FIDELITY</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            高保真离散切帧，
            <br />
            还原极致光影质感。
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            无需重度着色器计算或网格材质解包。orbit360 采用自研二进制容器标准，通过 Canvas
            原生绘制离散帧序列，在任意移动端设备上均能稳定输出全画质 60FPS 丝滑交互。
          </p>

          <div className="pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              单帧内存开销低于常规三维模型 85%
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
