export const MAX_ORB_BYTES = 10 * 1024 * 1024;
export const ORB_HEADER_SIZE = 32;
export const ORB_ENTRY_SIZE = 16;
const ORB_MAGIC = "ORB3";
const SUPPORTED_VERSIONS = new Set([1, 0x00010001, 0x00010002]);

export const ORB_ERRORS = {
  empty_file: "文件内容为空 / File is empty",
  too_large: "文件不能超过 10 MB / File must be 10 MB or smaller",
  bad_name: "仅支持 .orb 文件 / Only .orb files are allowed",
  invalid_orb: "不是有效的 ORB3 文件 / Not a valid ORB3 file",
};

export function orbError(code) {
  return { ok: false, code, message: ORB_ERRORS[code] || ORB_ERRORS.invalid_orb };
}

export function validateOrbName(name) {
  const safe = String(name || "")
    .split(/[\\/]/)
    .pop()
    .trim()
    .slice(0, 200);
  if (!safe || !safe.toLowerCase().endsWith(".orb")) return null;
  return safe;
}

/**
 * 解析并校验 ORB3 头部；`totalSize` 用于确保前缀长度不超过实际文件大小。
 * 浏览器可只传入前 32 字节 + File.size。
 */
export function parseOrbHeader(buffer, totalSize) {
  if (!buffer || buffer.byteLength < ORB_HEADER_SIZE) return orbError("invalid_orb");

  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < ORB_MAGIC.length; i++) {
    if (bytes[i] !== ORB_MAGIC.charCodeAt(i)) return orbError("invalid_orb");
  }

  const dv = new DataView(buffer);
  const header = {
    version: dv.getUint32(4, true),
    prefixLen: dv.getUint32(8, true),
    metaLen: dv.getUint32(12, true),
    indexLen: dv.getUint32(16, true),
    frameCount: dv.getUint32(20, true),
    indexEntrySize: dv.getUint32(24, true),
    flags: dv.getUint32(28, true),
  };

  if (!SUPPORTED_VERSIONS.has(header.version)) return orbError("invalid_orb");
  if (header.indexEntrySize !== ORB_ENTRY_SIZE) return orbError("invalid_orb");
  if (header.frameCount <= 0) return orbError("invalid_orb");
  if (header.indexLen !== header.frameCount * ORB_ENTRY_SIZE) return orbError("invalid_orb");
  if (header.prefixLen !== ORB_HEADER_SIZE + header.metaLen + header.indexLen) {
    return orbError("invalid_orb");
  }
  if (header.prefixLen > totalSize) return orbError("invalid_orb");

  return { ok: true, header };
}

/**
 * 服务端完整校验：头部 + meta JSON。
 * 返回可直接写入 D1 的标题、画布尺寸与帧数。
 */
export function validateOrbBuffer(buffer) {
  if (!buffer || buffer.byteLength === 0) return orbError("empty_file");
  if (buffer.byteLength > MAX_ORB_BYTES) return orbError("too_large");

  const parsed = parseOrbHeader(buffer, buffer.byteLength);
  if (!parsed.ok) return parsed;

  const { header } = parsed;
  let meta;
  try {
    const metaBytes = new Uint8Array(buffer, ORB_HEADER_SIZE, header.metaLen);
    meta = JSON.parse(new TextDecoder().decode(metaBytes));
  } catch {
    return orbError("invalid_orb");
  }

  if (!meta || meta.totalFrames !== header.frameCount) return orbError("invalid_orb");

  const width = Number(meta.canvas?.width) || null;
  const height = Number(meta.canvas?.height) || null;
  const title = typeof meta.title === "string" ? meta.title.trim().slice(0, 200) : "";

  return {
    ok: true,
    header,
    meta,
    title,
    width,
    height,
  };
}

/**
 * 浏览器端上传前校验：扩展名、大小、ORB3 magic/header。
 */
export async function validateBrowserOrbFile(file) {
  if (!file) return orbError("empty_file");
  if (!validateOrbName(file.name)) return orbError("bad_name");
  if (file.size === 0) return orbError("empty_file");
  if (file.size > MAX_ORB_BYTES) return orbError("too_large");

  const head = await file.slice(0, ORB_HEADER_SIZE).arrayBuffer();
  return parseOrbHeader(head, file.size);
}
