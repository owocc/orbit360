import React, { useState } from "react";
import { getLocale } from "../paraglide/runtime.js";

// 预置的多语言提示词数据集（支持多语言切换、自带兜底、支持一键复制）
const PROMPT_TEMPLATES = [
  {
    id: "360-turntable-character",
    name: {
      zh: "360° 环绕角色手办模型 (LoRA / H3 标准)",
      en: "360° Rotating Character / Figurine (LoRA / H3 Standard)",
      ja: "360° 回転キャラクターフィギュア (LoRA / H3)",
    },
    category: {
      zh: "角色 / 二次元 / 3D 手办",
      en: "Character / Anime / 3D Figurine",
      ja: "キャラクター / アニメ / フィギュア",
    },
    description: {
      zh: "适用于 MiniMax Hailuo H3、Runway Gen-3 或 Kling AI，生成平稳完整的单周 360 度圆周旋转视频，首尾自然闭环。",
      en: "Optimized for MiniMax Hailuo H3, Runway Gen-3, or Kling AI. Generates a smooth, seamless 360-degree turntable orbit around a static character.",
      ja: "MiniMax Hailuo H3、Runway Gen-3、Kling AI 向け。静止したキャラクターの周囲を一周（360度）滑らかに旋回するループ動画を生成します。",
    },
    prompts: {
      zh: "高画质3D手办模型，一名日系二次元少女静止站立在简约圆形展示台上，全身视角，精细材质与真实光影。摄像机以平稳匀速环绕拍摄主体360度完整一周（turntable orbit camera, seamless 360 loop），无镜头抖动，主体姿势保持完全静止，中性纯色影棚背景，软光漫反射，电影级画质，4k分辨率。",
      en: "High-end 3D figurine model of an anime girl standing stationary on a minimalist round turntable pedestal, full body view, intricate textures and cinematic lighting. Camera performs a continuous smooth 360-degree turntable orbit around the subject, seamless 360 loop, zero camera shake, character remains completely motionless, neutral solid studio background, soft ambient studio lighting, 8k resolution, photorealistic rendering.",
      ja: "高品質な3Dアニメフィギュア、円形ターンテーブルの上に静止して立つアニメ美少女、全身ショット、精緻なディテールと陰影。カメラは被写体の周りを一定速度で360度完全に一周する（turntable orbit camera, seamless 360 loop）、手ブレなし、ポーズは完全静止、無地のスタジオ背景、柔らかいライティング、超高画質。",
    },
    negative: {
      zh: "变形，多余肢体，镜头缩放变焦，大幅度自身动作，快速跳帧，模糊，画面闪烁",
      en: "subject moving, camera zooming, erratic motion, morphing, extra limbs, jump cuts, flicker, blur, low quality",
      ja: "被写体の自発的な動き、ズームイン・アウト、不自然な変形、ブレ、ちらつき、低画質",
    },
    recommendedParams: {
      ratio: "16:9 / 1:1",
      duration: "5s - 10s",
      cameraMotion: "Orbit / Turntable 360°",
      fps: "24fps",
    },
  },
  {
    id: "360-product-showcase",
    name: {
      zh: "高端工业数码产品 360° 全景展示",
      en: "Luxury Tech & Industrial Product 360° Turntable",
      ja: "高級電子製品・インダストリアル 360° 展示",
    },
    category: {
      zh: "电商 / 工业设计 / 商业产品",
      en: "E-Commerce / Industrial Design / Commercial",
      ja: "EC / 工業デザイン / コマーシャル",
    },
    description: {
      zh: "专为工业设计品（如耳机、机械腕表、智能硬件）打造的商业级 360° 环拍提示词，高光质感强烈。",
      en: "Tailored for consumer electronics, luxury watches, and industrial objects with high-contrast metallic highlights and clean studio reflections.",
      ja: "オーディオ機器や高級時計、ガジェット向けの360度製品プロモーション用プロンプト。美しい金属反射とスタジオ照明を強調。",
    },
    prompts: {
      zh: "商业产品静物摄影，极简磨砂金属材质的未来概念无线耳机，悬浮在空中。镜头以水平轴心进行360度匀速全景圆周环绕拍摄，保持镜头距离恒定（smooth turntable orbit 360 deg），主体完全静止，高光在阳极氧化铝表面丝滑流转，深色极简哑光背景，柔光箱轮廓光，8k极清。",
      en: "Commercial product still-life photography, futuristic matte metallic wireless headphones floating in air. Camera performs a steady 360-degree horizontal orbit around the product with constant distance (smooth turntable orbit 360 deg), subject completely still, specular highlights gliding smoothly across anodized aluminum surfaces, dark minimalist matte background, rim light, softbox illumination, 8k ultra sharp.",
      ja: "商業用プロダクト静物撮影、未来的なマットメタルのワイヤレスヘッドホンが空中に浮遊。カメラが水平を保ちながら360度等速で周囲を周回撮影（smooth turntable orbit 360 deg）、被写体は静止、アルマイト処理の表面を滑らかに流れるハイライト、ダークなスタジオ背景、リムライト、8K解像度。",
    },
    negative: {
      zh: "产品形变，抖动，杂乱反光，镜头上下倾斜，背景杂物，模糊",
      en: "product deformation, shaking, messy reflections, camera tilt, artifacts, motion blur",
      ja: "形状の歪み、カメラの揺れ、過剰な反射ノイズ、ぼやけ",
    },
    recommendedParams: {
      ratio: "1:1 / 4:3",
      duration: "5s - 10s",
      cameraMotion: "Horizontal Orbit 360°",
      fps: "24fps",
    },
  },
  {
    id: "360-sculpture-diorama",
    name: {
      zh: "微缩微景 & 艺术雕塑 (Diorama / Statue)",
      en: "Miniature Diorama & Fine Art Sculpture",
      ja: "ミニチュアジオラマ & 彫刻アート",
    },
    category: {
      zh: "艺术 / 雕像 / 场景微缩模型",
      en: "Art / Statue / Miniature Scene",
      ja: "アート / 彫刻 / ミニチュア",
    },
    description: {
      zh: "适合复杂景深模型、微缩庭院、奇幻生物雕塑的 360 度观察，透视变化丰富，极具 3D 沉浸感。",
      en: "Great for complex depth scenes, miniature courtyards, and fantasy creature statues with rich parallax and dynamic lighting shifts.",
      ja: "立体感や奥行きが豊かなミニチュアジオラマやファンタジー彫像用。視差効果と陰影の推移が際立ちます。",
    },
    prompts: {
      zh: "精细复杂的微缩浮空岛屿微景（diorama），包含微型瀑布、青苔岩石与发光古树。摄影机进行平滑 360 度圆周环绕观察，保持主体中心对齐（turntable camera, 360 seamless rotation around the center），无镜头漂移，景深浅柔，焦点锐利锁定在中心雕塑，体积光穿透，电影级微距质感。",
      en: "Intricate miniature floating island diorama, featuring micro waterfall, mossy rocks, and an ancient glowing tree. Camera executes a smooth 360-degree orbit rotation keeping the center point perfectly locked (turntable camera, 360 seamless rotation around center), no drift, subtle shallow depth of field, sharp focus on center model, volumetric light rays, macro cinematic masterpiece.",
      ja: "精緻な空中庭園のミニチュアジオラマ、小さな滝、苔むした岩、光る巨木。カメラが中央を焦点に固定したまま滑らかに360度周囲を周回（turntable camera, 360 seamless rotation around center）、視点のブレなし、浅い被写界深度、中央の造形にシャープなピント、チンダル現象の光線、映画のようなマクロ質感。",
    },
    negative: {
      zh: "水流大幅涌动改变地形，镜头偏心，忽近忽远，树木变形，杂色",
      en: "terrain morphing, unstable focal length, camera drift, jitter, blurry foreground",
      ja: "地形の崩れ、ピントの迷い、カメラの位置ズレ、ノイズ",
    },
    recommendedParams: {
      ratio: "16:9 / 4:3",
      duration: "8s - 10s",
      cameraMotion: "Center-Locked Turntable",
      fps: "24fps",
    },
  },
];

const PROMPT_LANGUAGES = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];

export default function CreatePage() {
  const lang = getLocale();

  // 当前用户选择的提示词语言（默认跟随应用语言，若非支持语言则兜底为 en）
  const initialPromptLang = ["zh", "en", "ja"].includes(lang) ? lang : "zh";
  const [selectedPromptLang, setSelectedPromptLang] = useState(initialPromptLang);

  // 复制反馈状态 (id -> boolean)
  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch {
      // 降级兜底方案
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    }
  };

  // 根据当前语言获取安全字符串（兜底优先级：当前语言 -> en -> zh）
  const getPromptString = (obj, targetLang = selectedPromptLang) => {
    if (!obj) return "";
    return obj[targetLang] || obj.en || obj.zh || Object.values(obj)[0] || "";
  };

  const isZh = lang === "zh";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 md:px-12 py-10 sm:py-16">
      {/* 顶部标题区 */}
      <div className="max-w-3xl mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {isZh ? "创作中心 · 360° 场景生产指南" : "CREATION HUB · 360° PIPELINE GUIDE"}
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-4 sm:mb-6 font-sans">
          {isZh ? "创建属于你的 360° 伪 3D 实体" : "Craft Your Own Orbit360 Experiences"}
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
          {isZh
            ? "只需一段平稳的 360° 环绕视频，即可通过打包脚本一键转化为超轻量、零显存负担的交互实体。我们为您准备了成熟的 AI 视频提示词模版与全套打包参数说明。"
            : "Transform any smooth 360° rotation video into lightweight, zero-GPU interactive 3D specimens. Discover fine-tuned AI prompts and exact bundling workflows below."}
        </p>
      </div>

      {/* 四步制作流水线指南 */}
      <div className="mb-20">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-6 sm:mb-8 font-sans flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-mono font-bold">
            01
          </span>
          {isZh ? "4 步制作流程" : "4-Step Production Pipeline"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 relative">
            <div className="text-xs font-mono text-neutral-600 dark:text-neutral-300 font-semibold mb-2">
              STEP 01
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
              {isZh ? "生成环绕视频" : "Generate 360° Video"}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {isZh
                ? "使用 AI 视频生成工具（如 MiniMax / Runway / Kling）或单反转盘拍摄一段 360° 水平匀速环绕主体的短片（建议 5-10s、首尾闭环）。"
                : "Use AI video generation tools (such as MiniMax, Runway, Kling) or turntable cameras to shoot a steady 360° horizontal video (5-10s recommended)."}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 relative">
            <div className="text-xs font-mono text-neutral-600 dark:text-neutral-300 font-semibold mb-2">
              STEP 02
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
              {isZh ? "剪辑并校准首尾" : "Trim & Loop Check"}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {isZh
                ? "确保视频正好旋转整整 360 度，首帧与尾帧的角度尽可能无缝重合，裁剪掉镜头未入轨或加速减速的无效多余帧。"
                : "Ensure the footage completes a full 360° turn with matching first and last frames. Trim off acceleration or irregular frames."}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 relative">
            <div className="text-xs font-mono text-neutral-600 dark:text-neutral-300 font-semibold mb-2">
              STEP 03
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
              {isZh ? "一键打包为 .orb" : "Bundle to .orb"}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {isZh
                ? "运行 scripts/bundle.py 将视频离散抽帧为二进制 .orb 包，内置 WebP / AVIF 极高压缩比，体积缩减 80% 以上。"
                : "Run scripts/bundle.py to extract and compress discrete frames into a single binary .orb container using high-efficiency WebP/AVIF."}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 relative">
            <div className="text-xs font-mono text-neutral-600 dark:text-neutral-300 font-semibold mb-2">
              STEP 04
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
              {isZh ? "跨端导入呈现" : "Render & Interact"}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {isZh
                ? "在 Playground 中直接上传预览；或引入 Web SDK / 微信 / 抖音小程序 / Flutter 插件，体验陀螺仪体感与单帧硬切。"
                : "Drag & drop into Playground, or embed via Web SDK, WeChat / Douyin Mini Programs, and Flutter with full gyroscope & swipe support."}
            </p>
          </div>
        </div>
      </div>

      {/* 核心功能区：AI 提示词库（调优中暂隐藏） */}
      <div className="mb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white font-sans flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-mono font-bold">
              02
            </span>
            {isZh ? "AI 视频生成提示词库" : "AI Video Generation Prompts"}
          </h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {isZh ? "调优测试中 · 暂未开放" : "Under Testing · Coming Soon"}
          </span>
        </div>

        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/80 flex items-center justify-center text-neutral-500 dark:text-neutral-400 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white font-sans mb-2">
            {isZh ? "提示词模版正在优化打磨中" : "Prompt Templates Are Being Fine-Tuned"}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md leading-relaxed font-sans">
            {isZh
              ? "为保证大家能稳定生成高质量、首尾平滑回环且无镜头抖动的 360° 环绕短片，我们正在针对主流 AI 视频模型进行深度测试与效果调优，待验证出最佳运镜提示词后将在此开放复制使用。"
              : "To ensure stable generation of clean, jitter-free 360° turntable loops, prompt templates are undergoing rigorous quality tests across multiple AI video models and will be unlocked once finalized."}
          </p>
        </div>
      </div>

      {/* 打包命令行与技术规格说明 */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-6 font-sans flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-mono font-bold">
            03
          </span>
          {isZh ? "打包命令与标准参数" : "Bundle Command & Standard Parameters"}
        </h2>

        <div className="p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed font-sans">
            {isZh
              ? "利用仓库自带的 scripts/bundle.py 脚本将生成的 MP4 视频快速转换为 .orb 场景文件。支持自动抽帧、长边分辨率缩放与多质量阶梯压制："
              : "Use the built-in scripts/bundle.py script to turn your raw MP4 into an optimized .orb scene container with frame extraction and resolution scaling:"}
          </p>

          <div className="relative group mb-6">
            <pre className="p-4 rounded-xl bg-neutral-950 text-neutral-200 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed">
              {`# 推荐标准打包命令（12fps / 1280长边 / WebP q80，兼顾极致丝滑与极小体积）
python3 scripts/bundle.py build assets/my-scene/scene.orb ./my-video.mp4 \\
    --fps 12 --long-edge 1280 --codec webp --quality 80 --title "我的3D实体"`}
            </pre>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  `python3 scripts/bundle.py build assets/my-scene/scene.orb ./my-video.mp4 --fps 12 --long-edge 1280 --codec webp --quality 80 --title "我的3D实体"`,
                  "cmd-bundle",
                )
              }
              className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono cursor-pointer transition-colors"
            >
              {copiedId === "cmd-bundle"
                ? isZh
                  ? "已复制！"
                  : "Copied!"
                : isZh
                  ? "复制命令"
                  : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-neutral-900 dark:text-white mb-1">--fps 12 ~ 24</div>
              <div className="text-neutral-500">
                {isZh
                  ? "离散旋转推荐 12fps，单周仅 120 帧，加载极快且体感平滑。"
                  : "12fps is ideal for discrete rotating models (120 frames/turn), balancing speed and loading."}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-neutral-900 dark:text-white mb-1">
                --codec webp / avif
              </div>
              <div className="text-neutral-500">
                {isZh
                  ? "首选 webp 跨端兼容最佳，AVIF 体积更小（需环境支持）。"
                  : "WebP provides the best universal cross-platform support; AVIF for maximum compression."}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-neutral-900 dark:text-white mb-1">--axis x / y</div>
              <div className="text-neutral-500">
                {isZh
                  ? "默认 X 轴水平环绕；若视频为俯仰上下环拍，可设为 Y 轴交互。"
                  : "Defaults to X-axis horizontal orbit. Set to Y-axis for vertical pitch interactions."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
