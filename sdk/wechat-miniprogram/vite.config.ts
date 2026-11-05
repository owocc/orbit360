import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const common: PackUserConfig = {
  dts: true,
  target: "es2017",
  platform: "neutral",
  outputOptions: { exports: "named" },
};

const packs: PackUserConfig[] = [
  {
    ...common,
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    clean: true,
  },
  {
    // 微信小程序示例直接 require 的单文件构建产物。
    entry: { "orbit360-miniprogram": "src/index.ts" },
    format: ["cjs"],
    dts: false,
    clean: false,
    target: "es2017",
    platform: "neutral",
    outputOptions: { exports: "named", entryFileNames: "orbit360-miniprogram.js" },
  },
];

export default defineConfig({
  pack: packs as unknown as PackUserConfig,
});
