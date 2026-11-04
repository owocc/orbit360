import React, { useRef, useState } from "react";
import { CardSwap } from "./CardSwap";
import { Pure3DCard } from "./Pure3DCard";
import { FoldingBill } from "./FoldingBill";
import { AspectRatio } from "./AspectRatio";
import { TicketStub } from "./TicketStub";
import { WakeSlider } from "./WakeSlider";

export function ShowcaseSections() {
  const section2CardRef = useRef(null);
  const [sliderAngle, setSliderAngle] = useState(50); // 0..100 映射到 -180..180 角度

  const handleSliderChange = (val) => {
    setSliderAngle(val);
    const targetDeg = (val / 100) * 360 - 180;
    const client = section2CardRef.current?.getClient?.();
    if (client) {
      client.setAngle?.(targetDeg);
    }
  };

  return (
    <div className="w-full space-y-28 pt-12 pb-24">
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
            基于三维景深排列与动力学手势阻尼。轻按顶部卡片即可甩动翻转至栈底，其余卡片同步步进前移。最前排卡片实时自转，交互瞬时无缝接管。
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

      {/* 模块 2: 左 3D 画板演示（支持拖拽旋转与 WakeSlider 联动） + 右文本（交叉进行） */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 flex flex-col items-center justify-center lg:items-start order-2 lg:order-1 space-y-4">
          <div className="w-full max-w-[420px] aspect-[4/5] relative">
            <Pure3DCard
              ref={section2CardRef}
              materialId="maid"
              aspectRatio="4/5"
              autoSpin={false}
              speed={0}
              className="w-full h-full"
            />
          </div>

          {/* 嵌入 WakeSlider 尾波滑块实时操控板块 2 的旋转视角 */}
          <div className="w-full max-w-[420px] flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
            <div className="text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">
              尾波角度操控
            </div>
            <WakeSlider bars={36} wake={70} value={sliderAngle} onChange={handleSliderChange} />
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
            原生绘制离散帧序列。您可以直接在左侧画板上手指拖拽旋转，也可以滑动下方的尾波滑块精确调节视角。
          </p>

          <div className="pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              单帧内存开销低于常规三维模型 85%
            </span>
          </div>
        </div>
      </section>

      {/* 模块 3: 左文本 + 右 FoldingBill 动态三维全彩折叠（再次交叉炫技） */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>PHYSICAL CLOTH & REALTIME 3D</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            动态布料折叠，
            <br />
            将素材化作触手可及的晶体实体。
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            将项目的真彩动态 3D 模型纹理直接映射至半透明三维玻璃晶体之上。基于 Verlet
            动力学弹簧网格。用手抓住一角即可折叠揉捏，同时拖拽自动联动内部 360° 全景旋转。
          </p>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              提示：用鼠标或手指直接拖拽右侧纸钞一角进行弯折捏揉与自旋
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center min-h-[320px] overflow-hidden">
            <FoldingBill materialId="maid" stiffness={38} settle={10} />
          </div>
        </div>
      </section>

      {/* 模块 4 (板块 5): 左 AspectRatio 自适应等面积变形演示 + 右文本（交错进行） */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 flex justify-center lg:justify-start order-2 lg:order-1">
          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center min-h-[360px]">
            <AspectRatio materialId="maid" interactive3D={true} morph={50} corner={24} />
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>EQUAL-AREA ADAPTIVE ENGINE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            等面积弹性形变，
            <br />
            强大的底层自适应渲染支撑！
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            真正的裁剪不是画面变大变小，而是保持画面面积恒定（4:3 宽屏、1:1 正方、3:4
            纵向各形态面积误差小于 0.02%）。 底层 Orbit360 核心自动监听 Resize 变形，内部 3D
            旋转模型在弹性形变过程中毫秒级实时重采样，无论比例如何变幻，始终保持无缝居中与像素级超清输出。
          </p>

          <div className="pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              提示：点击或通过方向键切换下方的 4:3 / 1:1 / 3:4 比例控制条
            </span>
          </div>
        </div>
      </section>

      {/* 模块 5 (板块 6): 左文本 + 右 TicketStub 3D 自由翻转全息视差票根（交错进行） */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>HOLOGRAPHIC TICKET & PARALLAX</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans leading-tight">
            全息视差票根，
            <br />
            实体凭证与实时 3D 的跨界融合。
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed max-w-lg">
            参考复古入场券与邮票齿孔版式设计。按住票根背景任意位置即可进行三维 360°
            自由翻转，翻转至背部时，内嵌 Canvas 模型与票根物理角度严格保持 1:1
            动态联动对齐！在邮票内部滑动亦可单独旋转模型视角。
          </p>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              提示：按住票根背景左右拖拽可直接翻转至背部；在邮票上滑动可单独旋转全景
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="p-4 sm:p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center w-full">
            <TicketStub materialId="orbit" ticketNo="02" title="TRICK OR TREAT" date="2026-11-04" />
          </div>
        </div>
      </section>
    </div>
  );
}
