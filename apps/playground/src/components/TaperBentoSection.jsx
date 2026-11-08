import React, { useState } from "react";
import { MaskedOrbitViewer } from "./MaskedOrbitViewer";

export function TaperBentoSection() {
  const [activeCol, setActiveCol] = useState(null);

  const columns = [
    {
      letter: "T",
      title: "TOOLS",
      sub: "渲染引擎与算法",
      desc: "零视频解码开销，毫秒级 Canvas 离散帧精确硬切，低功耗极致性能。",
      bg: "#ff4e7e", // 亮粉色
      mask: "squircle",
      src: "/assets/maid/scene.orb",
    },
    {
      letter: "A",
      title: "ARCHIVE",
      sub: "场景包标准",
      desc: "单文件 .orb 二进制容器，HTTP Range Header 按需获取视角切片。",
      bg: "#ffb703", // 亮金黄色
      mask: "arch",
      src: "/assets/orbit/scene.orb",
    },
    {
      letter: "P",
      title: "PROJECTS",
      sub: "生产业务集成",
      desc: "电商商品全景、虚拟展厅多机位、工业零部件 360° 联动交互。",
      bg: "#fb8500", // 橙色
      mask: "diamond",
      src: "/assets/maid/scene.orb",
    },
    {
      letter: "E",
      title: "EXPERIMENTS",
      sub: "多模态操控",
      desc: "手机陀螺仪方位角映射、桌面阻尼惯性衰减与弹性边界碰撞。",
      bg: "#0077b6", // 蓝色
      mask: "hex",
      src: "/assets/orbit/scene.orb",
    },
    {
      letter: "R",
      title: "RESOURCES",
      sub: "开源与生态",
      desc: "纯文本代码，无第三方依赖包绑定，与 TanStack 及 Base UI 完美协同。",
      bg: "#2b2d42", // 深炭色（白字）
      isDark: true,
      mask: "stamp",
      src: "/assets/maid/scene.orb",
    },
  ];

  return (
    <section id="color-blocks" className="py-16 border-b-2 border-neutral-900 bg-[#fbf9f4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="font-mono text-xs font-black uppercase tracking-widest text-neutral-500 mb-1">
            FIVE CORE PILLARS
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 font-sans">
            T-A-P-E-R 架构能力色彩矩阵
          </h2>
          <p className="text-neutral-600 text-xs font-mono mt-1">
            每个色块均内置一个独立的 360° 模型视窗，展示不同遮罩裁切和尺寸交互表现。
          </p>
        </div>

        {/* 5 竖列经典海报色块阵列 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-2 border-neutral-900 shadow-[6px_6px_0px_#000000] rounded-xl overflow-hidden divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-neutral-900">
          {columns.map((col) => {
            const textColor = col.isDark ? "text-white" : "text-neutral-950";
            const subTextColor = col.isDark ? "text-neutral-300" : "text-neutral-800";
            const borderAccent = col.isDark ? "border-neutral-700" : "border-neutral-900";

            return (
              <div
                key={col.letter}
                style={{ backgroundColor: col.bg }}
                className={`p-6 flex flex-col justify-between transition-all duration-300 ${
                  activeCol === col.letter ? "scale-[1.01] z-10" : ""
                }`}
                onMouseEnter={() => setActiveCol(col.letter)}
                onMouseLeave={() => setActiveCol(null)}
              >
                <div>
                  {/* 首字母与标题 */}
                  <div className="flex items-baseline gap-2 mb-4">
                    <span
                      className={`text-4xl sm:text-5xl font-black font-sans leading-none ${textColor}`}
                    >
                      {col.letter}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold uppercase tracking-wider ${textColor}`}
                    >
                      {col.title}
                    </span>
                  </div>

                  <div className={`font-mono text-xs font-bold mb-2 ${textColor}`}>{col.sub}</div>
                  <p className={`text-[11px] leading-relaxed font-mono mb-6 ${subTextColor}`}>
                    {col.desc}
                  </p>
                </div>

                {/* 内部嵌入具有对应遮罩形态的独立视窗 */}
                <div>
                  <div className="w-full my-4">
                    <MaskedOrbitViewer
                      src={col.src}
                      title={`${col.letter} · MODEL`}
                      showBadge={false}
                      maskShape={col.mask}
                      aspectRatio="1/1"
                      accentColor={col.isDark ? "#ffffff" : "#000000"}
                      bgExpand="none"
                      showControls={false}
                      className="w-full"
                    />
                  </div>

                  <div
                    className={`pt-3 border-t ${borderAccent} flex items-center justify-between font-mono text-xs ${textColor}`}
                  >
                    <span className="font-bold">INSPECT</span>
                    <span className="font-bold text-sm">→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
