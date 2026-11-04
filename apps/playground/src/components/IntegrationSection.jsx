import React, { useState } from "react";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "./ui/Tabs";

export function IntegrationSection() {
  const [copied, setCopied] = useState(false);

  const copyCode = (text) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeHtml = `<!-- 1. 引入构建完成的 SDK -->
<script src="dist/web/orbit360-client.js"></script>

<!-- 2. 准备 Canvas 载体 -->
<div id="container" style="width: 100%; aspect-ratio: 16/9; position: relative;">
  <canvas id="orbit-canvas" style="width: 100%; height: 100%;"></canvas>
</div>

<!-- 3. 初始化并挂载二进制场景 -->
<script>
  const canvas = document.getElementById('orbit-canvas');
  const container = document.getElementById('container');

  const client = new Orbit360.Client(canvas, {
    container,
    input: container,
    config: {
      auto: { enabled: true, degPerSec: 14 },
      drag: { degPerPx: 0.42 }
    }
  });

  client.load('assets/maid/scene.orb').then(() => {
    console.log('场景加载就绪');
  });
</script>`;

  const codeReact = `import { useEffect, useRef } from "react";
import { Client } from "@orbit360/javascript/web-client";

export function Model360({ src }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const client = new Client(canvasRef.current, {
      container: containerRef.current,
      input: containerRef.current,
      config: {
        auto: { enabled: true, degPerSec: 15 },
        drag: { degPerPx: 0.45 },
      },
    });

    client.load(src);

    return () => client.destroy();
  }, [src]);

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-neutral-950">
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab" />
    </div>
  );
}`;

  const codeBundle = `# 使用 bundle.py 将任意常规视频转换为 .orb 二进制容器
python3 scripts/bundle.py build assets/my-scene/scene.orb input.mp4 \\
  --fps 12 \\
  --long-edge 1280 \\
  --codec webp \\
  --quality 80 \\
  --title "我的 360 模型"

# 提取场景帧（可选调试）
python3 scripts/bundle.py extract assets/my-scene/scene.orb --out /tmp/frames`;

  return (
    <section id="integration" className="py-20 border-t border-neutral-800/80 bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="text-neutral-500 font-mono text-xs uppercase tracking-widest mb-2">
            Developer Guide & Quick Start
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
            轻量集成，开箱即用
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            核心渲染器保持零框架强依赖设计。无论是原生 JavaScript 项目、现代 React
            框架应用还是静态营销页面，只需三行代码即可完成模型嵌入。
          </p>
        </div>

        <TabsRoot defaultValue="react" className="w-full">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <TabsList>
              <TabsTrigger value="react">React / TanStack</TabsTrigger>
              <TabsTrigger value="html">原生 HTML / JS</TabsTrigger>
              <TabsTrigger value="cli">Python 转换打包</TabsTrigger>
            </TabsList>

            <span className="text-[11px] font-mono text-neutral-500">
              {copied ? "已复制到剪贴板" : "纯文本工程代码"}
            </span>
          </div>

          <TabsContent value="react" className="relative group">
            <button
              type="button"
              onClick={() => copyCode(codeReact)}
              className="absolute top-4 right-4 z-10 px-2 py-1 text-[11px] font-mono bg-neutral-800 border border-neutral-700 text-neutral-300 rounded hover:bg-neutral-700 hover:text-white transition-colors"
            >
              复制代码
            </button>
            <pre className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/60 font-mono text-xs text-neutral-300 overflow-x-auto leading-relaxed">
              <code>{codeReact}</code>
            </pre>
          </TabsContent>

          <TabsContent value="html" className="relative group">
            <button
              type="button"
              onClick={() => copyCode(codeHtml)}
              className="absolute top-4 right-4 z-10 px-2 py-1 text-[11px] font-mono bg-neutral-800 border border-neutral-700 text-neutral-300 rounded hover:bg-neutral-700 hover:text-white transition-colors"
            >
              复制代码
            </button>
            <pre className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/60 font-mono text-xs text-neutral-300 overflow-x-auto leading-relaxed">
              <code>{codeHtml}</code>
            </pre>
          </TabsContent>

          <TabsContent value="cli" className="relative group">
            <button
              type="button"
              onClick={() => copyCode(codeBundle)}
              className="absolute top-4 right-4 z-10 px-2 py-1 text-[11px] font-mono bg-neutral-800 border border-neutral-700 text-neutral-300 rounded hover:bg-neutral-700 hover:text-white transition-colors"
            >
              复制代码
            </button>
            <pre className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/60 font-mono text-xs text-neutral-300 overflow-x-auto leading-relaxed">
              <code>{codeBundle}</code>
            </pre>
          </TabsContent>
        </TabsRoot>
      </div>
    </section>
  );
}
