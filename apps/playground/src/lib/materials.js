/**
 * Orbit360 素材资源注册表与全局二进制 Blob 单例缓存池。
 * 保证相同 materialId 的 .orb 资源全站全局只发起一次 HTTP 请求。
 */

// 1. 结构化素材 ID 编排
export const MATERIAL_REGISTRY = {
  maid: {
    id: "maid",
    title: "Maid Horizon",
    category: "character",
    src: "assets/maid/scene.orb",
    cover: "assets/maid/cover.webp",
    aspectRatio: "3/4",
    frames: 239,
  },
  orbit: {
    id: "orbit",
    title: "Orbit Perspective",
    category: "environment",
    src: "assets/orbit/scene.orb",
    cover: "assets/orbit/cover.webp",
    aspectRatio: "16/9",
    frames: 240,
  },
};

export function resolveMaterial(idOrSrc) {
  if (MATERIAL_REGISTRY[idOrSrc]) {
    return MATERIAL_REGISTRY[idOrSrc];
  }
  // 查找匹配 src 的素材项
  const match = Object.values(MATERIAL_REGISTRY).find((item) => item.src === idOrSrc);
  if (match) return match;

  // 兜底返回虚拟素材
  return {
    id: idOrSrc || "default",
    title: "Specimen 360",
    category: "general",
    src: idOrSrc,
    cover: idOrSrc.replace(/\.orb$/, "/cover.webp"),
    aspectRatio: "1/1",
    frames: 240,
  };
}

// 2. 内存单例缓存池与在途 Promise 共享（Single-Flight Fetch）
const blobCache = new Map();
const inflightRequests = new Map();

/**
 * 获取素材的 Blob 对象。
 * 无论有多少个组件并发请求同一个 materialId，仅发起一次真实网络 fetch。
 */
export async function getMaterialBlob(idOrSrc) {
  const material = resolveMaterial(idOrSrc);
  const cacheKey = material.id;

  // 已命中内存缓存，直接返回已下载的 Blob
  if (blobCache.has(cacheKey)) {
    return blobCache.get(cacheKey);
  }

  // 正在下载中，复用该请求的 Promise，避免并发重复请求
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const res = await fetch(material.src, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      blobCache.set(cacheKey, blob);
      return blob;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * 预热加载素材 Blob
 */
export function preloadMaterial(idOrSrc) {
  return getMaterialBlob(idOrSrc).catch(() => {});
}
