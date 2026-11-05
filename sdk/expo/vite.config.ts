import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "es2020",
    platform: "neutral",
    deps: { neverBundle: ["react", "react-native"] },
    outputOptions: { exports: "named" },
  } as PackUserConfig,
});
