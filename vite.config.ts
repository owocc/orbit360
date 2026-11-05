import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "dist/**",
      "sdk/js/dist/**",
      "sdk/expo/dist/**",
      "sdk/wechat-miniprogram/dist/**",
      "sdk/douyin-miniprogram/dist/**",
      "examples/wechat-miniprogram/miniprogram/sdk/**",
      "examples/douyin-miniprogram/miniprogram/sdk/**",
      "examples/wechat-miniprogram/miniprogram/assets/**",
    ],
  },
  lint: {
    ignorePatterns: [
      "dist/**",
      "sdk/js/dist/**",
      "sdk/expo/dist/**",
      "sdk/wechat-miniprogram/dist/**",
      "sdk/douyin-miniprogram/dist/**",
      "examples/wechat-miniprogram/miniprogram/sdk/**",
      "examples/douyin-miniprogram/miniprogram/sdk/**",
      "examples/wechat-miniprogram/miniprogram/assets/**",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
