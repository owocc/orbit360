/**
 * 站内静态资源路径归一化。
 *
 * 多语言路由会把页面挂到 /zh、/en 等路径下，相对路径 `assets/...` 会被浏览器
 * 解析成 `/zh/assets/...`。站内资源统一使用根路径，避免 locale 前缀影响。
 */
export function assetPath(path) {
  if (!path || path.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(path)) return path;
  return `/${path}`;
}
