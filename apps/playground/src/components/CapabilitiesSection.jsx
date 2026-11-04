import React, { useState } from "react";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "./ui/Tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "./ui/Accordion";
import { Slider } from "./ui/Slider";

export function CapabilitiesSection() {
  const [sliderVal, setSliderVal] = useState(42);

  return (
    <section id="matrix" className="py-20 border-t border-neutral-800/80 bg-neutral-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="text-neutral-500 font-mono text-xs uppercase tracking-widest mb-2">
            Architecture & Features
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
            面向生产环境的 360° 交互能力矩阵
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            告别动辄数百兆的 3D 模型网格与沉重的 WebGL 着色器管线。orbit360 采用自研二进制切帧算法与
            Canvas 精确硬切技术，赋予普通视频原生级 3D 环视交互体验。
          </p>
        </div>

        {/* 核心能力选项卡系统 */}
        <div className="mb-16">
          <TabsRoot defaultValue="format" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-800 pb-4">
              <div className="font-mono text-xs text-neutral-400">能力分类索引</div>
              <TabsList>
                <TabsTrigger value="format">.orb 场景包</TabsTrigger>
                <TabsTrigger value="control">多模态操控</TabsTrigger>
                <TabsTrigger value="performance">极端性能</TabsTrigger>
                <TabsTrigger value="multi">多实例并存</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="format"
              className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/40"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="font-mono text-sm font-semibold text-white">
                    单个二进制容器打包全部场景数据
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    传统三维展示方案通常依赖庞大的 GLTF/GLB 模型或零散的图片序列压缩包。.orb 格式将
                    1 到 N 个视频抽取的 WebP/AVIF/JPEG 帧、元数据以及偏移索引打包进单一二进制实体。
                  </p>
                  <ul className="space-y-2 text-xs font-mono text-neutral-300">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                      <span>通过 HTTP Range Header 单次加载头部索引</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                      <span>按角度 offset/length 即时拉取单帧</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                      <span>无需客户端在内存中解压冗长 Zip 文件</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 space-y-2">
                  <div className="text-neutral-500">// scripts/bundle.py 生成逻辑</div>
                  <div>$ python3 scripts/bundle.py build scene.orb sample.mp4 \</div>
                  <div className="pl-4">--fps 12 \</div>
                  <div className="pl-4">--long-edge 1280 \</div>
                  <div className="pl-4">--codec webp \</div>
                  <div className="pl-4">--quality 80</div>
                  <div className="text-neutral-500 mt-2">// 产物尺寸对比</div>
                  <div className="text-neutral-400">原始 4K 视频: ~180MB</div>
                  <div className="text-neutral-200">.orb 二进制包: ~14.8MB (节省 91.7%)</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="control"
              className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/40"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="font-mono text-sm font-semibold text-white">
                    陀螺仪、指针阻尼与惯性动量算法
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    内置工业级物理模拟模型。手机端无缝调用设备方向传感器（DeviceOrientation
                    API），身体旋转即可转动视角；桌面端提供顺滑的手势阻尼与弹性边界回弹。
                  </p>
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs font-mono mb-2 text-neutral-300">
                      <span>指针灵敏度实时采样</span>
                      <span className="text-neutral-500">{sliderVal}%</span>
                    </div>
                    <Slider value={sliderVal} onValueChange={setSliderVal} min={10} max={100} />
                  </div>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 border border-neutral-800 rounded bg-neutral-950">
                    <div className="text-white font-medium mb-1">移动端陀螺仪 (Gyroscope)</div>
                    <div className="text-neutral-400 text-[11px]">
                      支持水平方位角与倾角映射，动态零位校准，HTTPS
                      安全上下文自动嗅探与权限降级提示。
                    </div>
                  </div>
                  <div className="p-3 border border-neutral-800 rounded bg-neutral-950">
                    <div className="text-white font-medium mb-1">动量衰减与平滑过滤</div>
                    <div className="text-neutral-400 text-[11px]">
                      拖拽释放后触发时间衰减函数，消除切帧的生硬感，呈现丝滑转动反馈。
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="performance"
              className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/40"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="font-mono text-sm font-semibold text-white">
                    零视频轨解码负担，单帧硬切极致节能
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    传统 Web
                    视频播放器即使在暂停状态仍占用硬件视频解码单元，移动设备发热严重且无法精确按角度快速定位任意帧。orbit360
                    采用单帧提取与 Canvas 硬切机制，内存占用极小。
                  </p>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 border border-neutral-800 rounded bg-neutral-950">
                      <div className="text-neutral-500 font-mono text-[10px]">CPU 占用率</div>
                      <div className="text-lg font-mono font-bold text-white">&lt; 2%</div>
                      <div className="text-neutral-500 text-[10px]">静止状态近乎零消耗</div>
                    </div>
                    <div className="p-3 border border-neutral-800 rounded bg-neutral-950">
                      <div className="text-neutral-500 font-mono text-[10px]">首帧响应速度</div>
                      <div className="text-lg font-mono font-bold text-white">&lt; 35ms</div>
                      <div className="text-neutral-500 text-[10px]">按需 Range 快速直出</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 space-y-3">
                  <div className="text-neutral-400">// 渲染机制原理</div>
                  <div className="text-neutral-300">
                    1. 用户触发交互 (PointerMove / DeviceOrientation)
                    <br />
                    2. 计算目标朝向角度 θ = clamp(θ_raw, min, max)
                    <br />
                    3. 帧索引映射 index = round((θ / 360) * totalFrames)
                    <br />
                    4. 取缓存 ImageBitmap 直接 drawImage(ctx, frame)
                    <br />
                    5. 避免创建任何视频实例与冗余垃圾回收开销
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="multi"
              className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/40"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="font-mono text-sm font-semibold text-white">
                    单页面无限制多实例渲染与尺寸响应
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    每个 OrbitViewer
                    组件拥有独立隔离的事件总线、状态机与渲染上下文。您可以在同一个页面同时渲染数十个不同尺寸、不同比例、不同自旋速度的模型视窗，互不干扰且无显存泄漏。
                  </p>
                  <div className="p-3 border border-neutral-800 rounded bg-neutral-950 text-xs font-mono text-neutral-300">
                    适配场景：电商商品列表 360°
                    矩阵、虚拟展厅多机位展台、工业设备各部件同步联动视窗等。
                  </div>
                </div>
                <div className="space-y-2 font-mono text-xs text-neutral-300">
                  <div className="p-3 border border-neutral-800 rounded bg-neutral-950 flex items-center justify-between">
                    <span>1:1 紧凑正方形模型视窗</span>
                    <span className="text-neutral-500">Avatar / 徽章尺寸</span>
                  </div>
                  <div className="p-3 border border-neutral-800 rounded bg-neutral-950 flex items-center justify-between">
                    <span>16:9 标准宽屏展示台</span>
                    <span className="text-neutral-500">Hero 沉浸视窗</span>
                  </div>
                  <div className="p-3 border border-neutral-800 rounded bg-neutral-950 flex items-center justify-between">
                    <span>4:3 / 3:4 响应式网格群</span>
                    <span className="text-neutral-500">移动端优先视窗</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </TabsRoot>
        </div>

        {/* 深度技术规格折叠面板 (Accordion) */}
        <div id="comparison" className="max-w-4xl mx-auto pt-8">
          <div className="text-center mb-8">
            <h3 className="text-lg font-mono font-semibold text-white">方案对比与规格说明</h3>
            <p className="text-xs font-mono text-neutral-500 mt-1">
              常见 3D 方案与 Orbit360 的技术指标差异
            </p>
          </div>

          <Accordion defaultValue="q1">
            <AccordionItem value="q1">
              <AccordionTrigger>
                为什么选择 orbit360 而不是加载 glTF / OBJ 真实三维模型？
              </AccordionTrigger>
              <AccordionPanel>
                真实 3D
                模型需经历复杂的拓扑网格、贴图解包、顶点与片元着色器计算，不仅加载体积通常达到
                20MB~100MB，且对移动端低端芯片 GPU 负载极高。orbit360
                仅需通过单次环绕拍摄生成二进制包，无需 3D 建模，光影材质 100%
                还原真实拍摄质感，运行开销降低 80% 以上。
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem value="q2">
              <AccordionTrigger>与传统 HTML5 Video 逐帧播放方案相比有何优势？</AccordionTrigger>
              <AccordionPanel>
                HTML5 视频标签是为连续线性播放设计的，调用 currentTime 寻帧需要经历昂贵的 GOP
                关键帧解码（I/P/B 帧重建），快速拖动时会出现严重的卡顿甚至黑屏。orbit360
                将帧序列统一解耦为定长离散图像，Canvas 单帧切换耗时低于 1 毫秒。
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem value="q3">
              <AccordionTrigger>单页面渲染多个实例时，显存与内存是否会崩溃？</AccordionTrigger>
              <AccordionPanel>
                不会。SDK 内部构建了基于 LRU
                策略的轻量级帧缓存池，只保留当前视角附近的有效帧，离屏时自动休眠自旋时钟与监听器。经实测，单页面同时挂载
                12 个多尺寸视窗仅消耗不到 40MB 内存。
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem value="q4">
              <AccordionTrigger>生产环境部署如何保证网络带宽与 CDN 效率？</AccordionTrigger>
              <AccordionPanel>
                .orb 文件结构天然适配标准 HTTP 静态服务器与 CDN 节点。配合客户端的 Range: bytes=...
                请求头，只有当前观看视角附近的几十个数据包会被下载，未观看的帧序列永远不会消耗任何流量。
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
