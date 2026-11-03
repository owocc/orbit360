import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const common: PackUserConfig = {
  format: ["esm", "cjs"],
  dts: true,
  target: "es2015",
  platform: "neutral",
  outputOptions: { exports: "named" },
};

const packs: PackUserConfig[] = [
  {
    ...common,
    entry: { index: "src/index.ts" },
    clean: true,
  },
  {
    ...common,
    entry: { "web-client": "src/web-client.ts" },
    clean: false,
  },
  {
    entry: { "orbit360-client": "src/web-client.ts" },
    format: ["iife"],
    globalName: "Orbit360",
    dts: false,
    clean: false,
    target: "es2015",
    platform: "neutral",
    outputOptions: { exports: "named", entryFileNames: "orbit360-client.js" },
  },
];

export default defineConfig({
  pack: packs as unknown as PackUserConfig,
});
