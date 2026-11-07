import React from "react";
import { MaskedOrbitViewer } from "./MaskedOrbitViewer";

export function FeaturedRow() {
  const cards = [
    {
      id: "card-1",
      tag: "FEATURED",
      badgeColor: "#ff4e7e",
      title: "QuickLayers v1.2",
      desc: "支持高灵敏度指针拖拽与平滑阻尼，背后搭配动态星芒扩展层，极度契合透明主体渲染。",
      mask: "squircle",
      aspect: "1/1",
      src: "/assets/orbit/scene.orb",
      bgExpand: "stars",
      accent: "#ff4e7e",
      date: "NOV 04, 2026",
    },
    {
      id: "card-2",
      tag: "FEATURED",
      badgeColor: "#ffb703",
      title: "Daily Sketch - Item 1378",
      desc: "紧凑构图剪裁，背后带有点阵网格背景，营造杂志贴纸风格交互。",
      mask: "pill",
      aspect: "3/4",
      src: "/assets/maid/scene.orb",
      bgExpand: "grid",
      accent: "#ffb703",
      date: "NOV 03, 2026",
    },
    {
      id: "card-3",
      tag: "FEATURED",
      badgeColor: "#0077b6",
      title: "Noise Field Lab",
      desc: "支持单帧硬切微调，背后扩大彩色漫反射光晕，支持高精度微调。",
      mask: "stamp",
      aspect: "1/1",
      src: "/assets/orbit/scene.orb",
      bgExpand: "glow",
      accent: "#0077b6",
      date: "NOV 01, 2026",
    },
  ];

  return (
    <section id="featured" className="py-16 border-b-2 border-neutral-900 bg-[#fbf9f4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 顶部标题与左右翻页模拟 */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <div className="font-mono text-xs font-black uppercase tracking-widest text-neutral-500 mb-1">
              FEATURED SPECIMENS
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 font-sans">
              精选视窗剪裁与背后扩大装饰
            </h2>
            <p className="text-neutral-600 text-xs font-mono mt-1">
              不同遮罩形态（Squircle / Pill / Stamp）与背面扩展材质的组合示例。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center font-mono text-xs font-bold border-2 border-black bg-white shadow-[2px_2px_0px_#000000] hover:bg-neutral-100 transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center font-mono text-xs font-bold border-2 border-black bg-white shadow-[2px_2px_0px_#000000] hover:bg-neutral-100 transition-colors"
            >
              →
            </button>
          </div>
        </div>

        {/* 三列特色大卡片排版 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {cards.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-white border-2 border-neutral-900 rounded-xl shadow-[5px_5px_0px_#000000] hover:-translate-y-1 hover:shadow-[7px_7px_0px_#000000] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-full mb-5">
                  <MaskedOrbitViewer
                    src={item.src}
                    title={item.title}
                    showBadge={false}
                    maskShape={item.mask}
                    aspectRatio={item.aspect}
                    accentColor={item.accent}
                    bgExpand={item.bgExpand}
                    speed={10}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                    <span className="font-bold text-neutral-800">INTERACTIVE 3D</span>
                    <span>{item.date}</span>
                  </div>
                  <h3 className="font-bold text-base text-neutral-900 tracking-tight font-sans">
                    {item.title}
                  </h3>
                  <p className="text-xs text-neutral-600 leading-relaxed font-mono">{item.desc}</p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-neutral-200 flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-neutral-900">360° INTERACTIVE</span>
                <span className="font-bold text-neutral-900 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
