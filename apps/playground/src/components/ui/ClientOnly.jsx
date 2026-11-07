/**
 * 直接复用 TanStack Router 官方标准导出的 ClientOnly 和 useHydrated。
 * 底层基于 React 的 useSyncExternalStore 实现无闪烁安全水合隔离：
 * - 服务端渲染（SSR）时 snapshot 固定为 false，返回 fallback 占位
 * - 客户端初次水合挂载后切换为 true 渲染真正包含浏览器交互/Canvas/WebGL 的 children
 */
export { ClientOnly, useHydrated } from "@tanstack/react-router";
