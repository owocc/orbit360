export const QUALITY_ORDER = ["std", "hd", "uhd"];
export const QUALITY_LABEL = { uhd: "超清", hd: "高清", std: "标准" };

export function isMobileViewport() {
  return Math.min(window.innerWidth, window.screen?.width ?? 9999) <= 1100;
}

export function availableQualities(entry) {
  if (!entry || !entry.packs) return [];
  return QUALITY_ORDER.filter((quality) => entry.packs[quality]);
}

export function pickEntry(catalog, wantedId) {
  if (!catalog || !Array.isArray(catalog.items) || !catalog.items.length) return null;
  return (
    catalog.items.find((item) => item.id === wantedId) ||
    catalog.items.find((item) => item.id === catalog.default) ||
    catalog.items[0]
  );
}

export function pickQuality(entry, { urlQuality, prefQuality, mobile = isMobileViewport() }) {
  const available = availableQualities(entry);
  if (!available.length) return null;
  const dflt = entry.defaults?.quality;

  if (urlQuality && available.includes(urlQuality)) return urlQuality;
  if (prefQuality && available.includes(prefQuality)) return prefQuality;
  if (dflt && available.includes(dflt)) {
    if (mobile && dflt === "uhd") return available.includes("hd") ? "hd" : dflt;
    return dflt;
  }
  return mobile
    ? available.includes("std")
      ? "std"
      : available[0]
    : available.includes("uhd")
      ? "uhd"
      : available[0];
}

/**
 * 把 catalog + URL 参数解析成一次 load 请求。
 * 返回 { url, quality, useOrb, entry, exampleId } 或直接抛错。
 */
export function resolveCatalogSource(catalog, params, prefQuality) {
  const entry = pickEntry(catalog, params.get("e"));
  if (!entry) throw new Error("找不到可用的示例包（catalog.json）");
  const forceZip = params.get("fmt") === "zip" || params.has("q");
  const quality = pickQuality(entry, { urlQuality: params.get("q"), prefQuality });
  const useOrb = !forceZip && !!entry.orb;
  const url = useOrb ? entry.orb : quality ? entry.packs[quality] : null;
  if (!url) throw new Error("找不到可用的示例包（catalog.json）");
  return {
    url,
    quality: useOrb ? null : quality,
    useOrb,
    entry,
    exampleId: entry.id,
  };
}
