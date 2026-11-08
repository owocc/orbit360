import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const pack: PackUserConfig = {
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  target: "es2015",
  platform: "neutral",
  outputOptions: { exports: "named" },
  clean: true,
};

export default defineConfig({ pack });
