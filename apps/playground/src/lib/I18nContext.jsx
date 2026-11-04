import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

const LANG_STORAGE_KEY = "orbit360_lang_pref";

export const DICTIONARY = {
  zh: {
    nav: {
      home: "首页",
      gallery: "画廊",
      playground: "游乐场",
      source: "源码",
      language: "语言",
      theme: "外观",
    },
    hero: {
      tag: "ORBIT360 伪 3D 渲染引擎",
      title_1: "A place to display your",
      title_2: "masterpiece.",
      subtitle:
        "将 360° 环绕视频重塑为超轻量伪 3D 实体模型。无需复杂 WebGL 网格解包，Canvas 单帧硬切，低功耗丝滑呈现。",
      explore: "立即体验 360°",
      read_more: "了解底层特性",
    },
    sections: {
      s1_tag: "DEPTH STACK MOTION",
      s1_title_1: "物理惯性层叠，",
      s1_title_2: "重塑 3D 交互手感。",
      s1_desc:
        "基于三维景深排列与动力学手势阻尼。轻按顶部卡片即可甩动翻转至栈底，其余卡片同步步进前移。最前排卡片实时自转，交互瞬时无缝接管。",
      s1_tip: "提示：可直接拖拽甩动右侧卡片体验翻转",

      s2_tag: "RAW PIXEL FIDELITY",
      s2_title_1: "高保真离散切帧，",
      s2_title_2: "还原极致光影质感。",
      s2_desc:
        "无需重度着色器计算或网格材质解包。orbit360 采用自研二进制容器标准，通过 Canvas 原生绘制离散帧序列。您可以直接在左侧画板上手指拖拽旋转，下方的极简尾波滑块会自动双向跟随，亦可拖动滑块精确控制视角。",
      s2_tip: "单帧内存开销低于常规三维模型 85%",

      s3_tag: "PHYSICAL CLOTH & REALTIME 3D",
      s3_title_1: "动态布料折叠，",
      s3_title_2: "将素材化作触手可及的晶体实体。",
      s3_desc:
        "将项目的真彩动态 3D 模型纹理直接映射至半透明三维玻璃晶体之上。基于 Verlet 动力学弹簧网格。用手抓住一角即可折叠揉捏，同时拖拽自动联动内部 360° 全景旋转。",
      s3_tip: "提示：用鼠标或手指直接拖拽右侧纸钞一角进行弯折捏揉与自旋",

      s4_tag: "EQUAL-AREA ADAPTIVE ENGINE",
      s4_title_1: "等面积弹性形变，",
      s4_title_2: "强大的底层自适应渲染支撑！",
      s4_desc:
        "真正的裁剪不是画面变大变小，而是保持画面面积恒定（4:3 宽屏、1:1 正方、3:4 纵向各形态面积误差小于 0.02%）。 底层 Orbit360 核心自动监听 Resize 变形，内部 3D 旋转模型在弹性形变过程中毫秒级实时重采样，无论比例如何变幻，始终保持无缝居中与像素级超清输出。",
      s4_tip: "提示：点击或通过方向键切换下方的 4:3 / 1:1 / 3:4 比例控制条",

      s5_tag: "HOLOGRAPHIC TICKET & PARALLAX",
      s5_title_1: "全息视差票根，",
      s5_title_2: "实体凭证与实时 3D 的跨界融合。",
      s5_desc:
        "参考复古入场券与邮票齿孔版式设计。按住票根背景任意位置即可进行三维 360° 自由翻转，翻转至背部时，内嵌 Canvas 模型与票根物理角度严格保持 1:1 动态联动对齐！您也可以直接拖动下方的极简尾波滑块旋转票根。",
      s5_tip: "提示：可直接拖动票根翻转，或使用下方滑块精准旋转票根与全景",
    },
    playground: {
      tag: "LABORATORY & SANDBOX",
      title: "Orbit360 Playground",
      desc: "实时调试渲染核心所有参数：全息罗盘、陀螺仪体感、鼠标跟随、自动环绕与二进制 .orb 文件解析。",
      upload_btn: "上传",
      reset_btn: "重置 0°",
      fullscreen_enter: "全屏",
      fullscreen_exit: "退出全屏",
      bearing_title: "BEARING 方位角",
      single_frame: "单帧硬切渲染",
      presets_title: "场景预设",
      motion_title: "INTERACTION & MOTION",
      auto_spin: "自动旋转",
      auto_off: "关闭",
      auto_cw: "顺时针 CW",
      auto_ccw: "逆时针 CCW",
      drag_invert: "拖拽反向",
      invert_on: "已反向",
      invert_off: "常规",
      mouse_follow: "鼠标跟随",
      follow_on: "开启",
      follow_off: "关闭",
      inertia: "松手惯性",
      inertia_on: "平滑阻尼",
      inertia_off: "立即停住",
      auto_speed: "自动旋转角速度",
      fit_mode: "画布裁剪模式",
      aspect_ratio: "画面画幅比例",
      fit_cover: "铺满 (Cover)",
      fit_contain: "完整 (Contain)",
      gyro_title: "GYROSCOPE / SENSORS",
      gyro_switch: "陀螺仪开关",
      gyro_calibrate: "重新校准",
      gyro_smooth: "抖动滤波平滑",
      gyro_gain: "体感灵敏度增益",
      upload_modal_title: "上传场景 (.ORB / .ZIP)",
    },
    footer: {
      copy: "© 2026 Orbit360 Project",
      sub: "Pure Canvas · Low Power Consumption · Universal SSR",
    },
  },
  en: {
    nav: {
      home: "Home",
      gallery: "Gallery",
      playground: "Playground",
      source: "Source",
      language: "Language",
      theme: "Theme",
    },
    hero: {
      tag: "ORBIT360 PSEUDO-3D ENGINE",
      title_1: "A place to display your",
      title_2: "masterpiece.",
      subtitle:
        "Transform 360° rotating video into lightweight interactive 3D specimens. Zero WebGL overhead, Canvas single-frame switching, ultra-low power consumption.",
      explore: "Explore 360°",
      read_more: "Read capabilities",
    },
    sections: {
      s1_tag: "DEPTH STACK MOTION",
      s1_title_1: "Inertial Depth Stacking,",
      s1_title_2: "Tactile 3D Feedback.",
      s1_desc:
        "Constructed with 3D Z-depth ordering and spring damping. Flick the top card to tuck it to the bottom while back cards step forward smoothly. The front card spins in real time with seamless drag takeover.",
      s1_tip: "Tip: Drag and flick the cards on the right to flip through the stack",

      s2_tag: "RAW PIXEL FIDELITY",
      s2_title_1: "Discrete Frame Shifting,",
      s2_title_2: "Pure Photorealistic Details.",
      s2_desc:
        "Free from shader compile stutter and polygon texture unpacking. Orbit360 uses proprietary binary containers, rendering discrete frames directly onto 2D Canvas. Drag horizontally on the canvas to rotate or control precision angles with the wake slider below.",
      s2_tip: "Single frame memory footprint is 85% lower than traditional 3D models",

      s3_tag: "PHYSICAL CLOTH & REALTIME 3D",
      s3_title_1: "Dynamic Cloth Crumple,",
      s3_title_2: "Tangible Crystalline Entity.",
      s3_desc:
        "Maps dynamic 3D model video textures straight onto a translucent refractive specimen. Powered by Verlet spring physics: pinch and bend any corner while dragging synchronously rotates the 360° perspective inside.",
      s3_tip: "Tip: Drag the corner of the ticket with your mouse or finger to crumple and spin",

      s4_tag: "EQUAL-AREA ADAPTIVE ENGINE",
      s4_title_1: "Equal-Area Morphing,",
      s4_title_2: "Uncompromising Responsive Core.",
      s4_desc:
        "True cropping keeps visual area constant rather than arbitrarily scaling dimensions (4:3, 1:1, 3:4 area difference is within 0.02%). The Orbit360 core listens to resize events and dynamically resamples pixels without distortion.",
      s4_tip: "Tip: Click or use arrow keys to switch 4:3 / 1:1 / 3:4 aspect bars",

      s5_tag: "HOLOGRAPHIC TICKET & PARALLAX",
      s5_title_1: "Holographic Ticket Stub,",
      s5_title_2: "Physical Artifact Meets 3D.",
      s5_desc:
        "Modeled after vintage perforated admission passes. Press and drag anywhere on the ticket background for full 3D tumbling: flipping to the 180° reverse side retains perfect coaxial rotation alignment with the specimen inside.",
      s5_tip: "Tip: Drag ticket background to flip to backside; drag stamp to rotate specimen",
    },
    playground: {
      tag: "LABORATORY & SANDBOX",
      title: "Orbit360 Playground",
      desc: "Live runtime experimentation: compass HUD, gyro spatial tracking, mouse follow, auto-spin, and binary .orb file inspection.",
      upload_btn: "Upload",
      reset_btn: "Reset 0°",
      fullscreen_enter: "Fullscreen",
      fullscreen_exit: "Exit Fullscreen",
      bearing_title: "BEARING ANGLE",
      single_frame: "Canvas Frame Cut",
      presets_title: "SCENE PRESETS",
      motion_title: "INTERACTION & MOTION",
      auto_spin: "Auto Rotation",
      auto_off: "Off",
      auto_cw: "Clockwise CW",
      auto_ccw: "Counter-CW",
      drag_invert: "Drag Invert",
      invert_on: "Inverted",
      invert_off: "Normal",
      mouse_follow: "Mouse Follow",
      follow_on: "On",
      follow_off: "Off",
      inertia: "Release Inertia",
      inertia_on: "Smooth Damping",
      inertia_off: "Instant Stop",
      auto_speed: "Angular Speed",
      fit_mode: "Canvas Fit Mode",
      aspect_ratio: "Aspect Ratio",
      fit_cover: "Cover",
      fit_contain: "Contain",
      gyro_title: "GYROSCOPE / SENSORS",
      gyro_switch: "Gyroscope",
      gyro_calibrate: "Calibrate",
      gyro_smooth: "Jitter Filter",
      gyro_gain: "Sensor Gain",
      upload_modal_title: "UPLOAD SCENE (.ORB / .ZIP)",
    },
    footer: {
      copy: "© 2026 Orbit360 Project",
      sub: "Pure Canvas · Low Power Consumption · Universal SSR",
    },
  },
};

const LanguageContext = createContext({
  lang: "zh",
  setLang: () => {},
  t: DICTIONARY.zh,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === "undefined") return "zh";
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
    const nav = navigator.language?.toLowerCase() || "";
    return nav.startsWith("zh") ? "zh" : "en";
  });

  const setLang = (next) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANG_STORAGE_KEY, next);
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: DICTIONARY[lang] || DICTIONARY.zh,
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  return useContext(LanguageContext);
}
