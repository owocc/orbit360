import { env } from "cloudflare:workers";
import {
  MAX_COVER_BYTES,
  MAX_ORB_BYTES,
  coverExtension,
  extractOrbCover,
  sniffImageType,
  validateOrbBuffer,
} from "../lib/orb-file.js";

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS orbs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  size INTEGER NOT NULL,
  frame_count INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  r2_key TEXT NOT NULL UNIQUE,
  cover_key TEXT,
  cover_type TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL
)`;
const CREATE_INDEX = "CREATE INDEX IF NOT EXISTS idx_orbs_created_at ON orbs (created_at DESC)";
const EXTRA_COLUMNS = [
  ["description", "TEXT"],
  ["cover_key", "TEXT"],
  ["cover_type", "TEXT"],
  ["meta_json", "TEXT"],
];

let schemaReady;

export class OrbServiceError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function database() {
  if (!env.DB) throw new OrbServiceError("db_unavailable", "D1 binding DB 未配置");
  return env.DB;
}

function storage() {
  if (!env.ORBS) throw new OrbServiceError("r2_unavailable", "R2 binding ORBS 未配置");
  return env.ORBS;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** 首次访问时幂等建表，并补齐旧表缺失的列。 */
function ensureSchema() {
  if (!schemaReady) {
    const db = database();
    schemaReady = (async () => {
      await db.batch([db.prepare(CREATE_TABLE), db.prepare(CREATE_INDEX)]);
      const { results } = await db.prepare("PRAGMA table_info(orbs)").all();
      const columns = new Set(results.map((column) => column.name));
      for (const [name, type] of EXTRA_COLUMNS) {
        if (!columns.has(name)) {
          await db.prepare(`ALTER TABLE orbs ADD COLUMN ${name} ${type}`).run();
        }
      }
    })().catch((error) => {
      schemaReady = undefined;
      throw new OrbServiceError("db_error", `初始化 D1 失败: ${error.message}`);
    });
  }
  return schemaReady;
}

function toItem(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    description: row.description || "",
    size: row.size,
    frameCount: row.frame_count,
    width: row.width,
    height: row.height,
    aspectRatio: row.width > 0 && row.height > 0 ? row.width / row.height : null,
    createdAt: row.created_at,
    url: `/api/orbs/${row.id}`,
    cover: `/api/orbs/${row.id}?cover=1`,
  };
}

export const ORB_PAGE_SIZE = 20;

function encodeCursor(row) {
  return btoa(JSON.stringify([row.created_at, row.id]));
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(atob(cursor));
    if (Array.isArray(value) && typeof value[0] === "string" && typeof value[1] === "string") {
      return { createdAt: value[0], id: value[1] };
    }
  } catch {
    // 非法 cursor 按第一页处理。
  }
  return null;
}

/** 游标分页，单次最多 20 条，避免一次性扫描/返回全部数据。 */
export async function listOrbs({ cursor = null, limit = ORB_PAGE_SIZE } = {}) {
  await ensureSchema();
  const pageSize = Math.min(Math.max(Number(limit) || ORB_PAGE_SIZE, 1), ORB_PAGE_SIZE);
  const after = decodeCursor(cursor);
  const db = database();
  const select = `SELECT id, name, title, description, size, frame_count, width, height, created_at FROM orbs`;

  const statement = after
    ? db
        .prepare(
          `${select}
           WHERE (created_at < ? OR (created_at = ? AND id < ?))
           ORDER BY created_at DESC, id DESC LIMIT ?`,
        )
        .bind(after.createdAt, after.createdAt, after.id, pageSize + 1)
    : db.prepare(`${select} ORDER BY created_at DESC, id DESC LIMIT ?`).bind(pageSize + 1);

  const { results } = await statement.all();
  const hasMore = results.length > pageSize;
  const page = results.slice(0, pageSize);
  return {
    items: page.map(toItem),
    nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : null,
  };
}

function resolveCover(parsed, providedCover) {
  if (providedCover?.buffer) {
    if (providedCover.buffer.byteLength > MAX_COVER_BYTES) {
      throw new OrbServiceError("invalid_cover", "封面不能超过 5 MB", 400);
    }
    const type = sniffImageType(providedCover.buffer);
    if (!type) throw new OrbServiceError("invalid_cover", "封面不是有效图片", 400);
    return { bytes: new Uint8Array(providedCover.buffer), type };
  }
  return extractOrbCover(parsed.buffer, parsed.header, parsed.meta);
}

export async function createOrb({ buffer, name, title, description, cover }) {
  if (!buffer || buffer.byteLength > MAX_ORB_BYTES) {
    throw new OrbServiceError("too_large", "文件不能超过 10 MB", 413);
  }

  const parsed = validateOrbBuffer(buffer);
  if (!parsed.ok) {
    throw new OrbServiceError(parsed.code, parsed.message, parsed.code === "too_large" ? 413 : 400);
  }

  await ensureSchema();

  const id = crypto.randomUUID();
  const key = `orbs/${id}.orb`;
  const finalTitle =
    cleanText(title, 120) || parsed.title || name.replace(/\.orb$/i, "") || "Untitled";
  const finalDescription = cleanText(description, 500);
  const coverData = resolveCover({ buffer, ...parsed }, cover);
  const createdAt = new Date().toISOString();
  const bucket = storage();

  let coverKey = null;
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { name, title: finalTitle },
  });

  if (coverData) {
    const ext = coverExtension(coverData.type);
    coverKey = `covers/${id}.${ext}`;
    await bucket.put(coverKey, coverData.bytes, {
      httpMetadata: { contentType: coverData.type },
      customMetadata: { name, title: finalTitle },
    });
  }

  try {
    await database()
      .prepare(
        `INSERT INTO orbs
          (id, name, title, description, size, frame_count, width, height,
           r2_key, cover_key, cover_type, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        name,
        finalTitle,
        finalDescription,
        buffer.byteLength,
        parsed.header.frameCount,
        parsed.width,
        parsed.height,
        key,
        coverKey,
        coverData?.type || null,
        JSON.stringify(parsed.meta),
        createdAt,
      )
      .run();
  } catch (error) {
    await Promise.all([
      bucket.delete(key).catch(() => {}),
      coverKey ? bucket.delete(coverKey).catch(() => {}) : Promise.resolve(),
    ]);
    throw new OrbServiceError("db_error", `写入 D1 失败: ${error.message}`);
  }

  return {
    id,
    name,
    title: finalTitle,
    description: finalDescription,
    size: buffer.byteLength,
    frameCount: parsed.header.frameCount,
    width: parsed.width,
    height: parsed.height,
    aspectRatio: parsed.width > 0 && parsed.height > 0 ? parsed.width / parsed.height : null,
    createdAt,
    url: `/api/orbs/${id}`,
    cover: `/api/orbs/${id}?cover=1`,
  };
}

export async function getOrbObject(id) {
  await ensureSchema();
  const row = await database()
    .prepare("SELECT id, name, title, r2_key FROM orbs WHERE id = ?")
    .bind(id)
    .first();
  if (!row) return null;

  const object = await storage().get(row.r2_key);
  if (!object) return null;

  return { row, object };
}

/** 读取封面；旧数据没有封面时从 R2 中的 ORB 首帧补生成并回写 D1。 */
export async function getOrbCover(id) {
  await ensureSchema();
  const db = database();
  const bucket = storage();
  const row = await db
    .prepare("SELECT id, name, r2_key, cover_key, cover_type FROM orbs WHERE id = ?")
    .bind(id)
    .first();
  if (!row) return null;

  if (row.cover_key) {
    const existing = await bucket.get(row.cover_key);
    if (existing) return { kind: "r2", object: existing, type: row.cover_type };
  }

  const orb = await bucket.get(row.r2_key);
  if (!orb) return null;
  const buffer = await orb.arrayBuffer();
  const parsed = validateOrbBuffer(buffer);
  if (!parsed.ok) return null;

  const coverData = extractOrbCover(buffer, parsed.header, parsed.meta);
  if (!coverData) return null;

  const ext = coverExtension(coverData.type);
  const coverKey = `covers/${id}.${ext}`;
  await bucket.put(coverKey, coverData.bytes, {
    httpMetadata: { contentType: coverData.type },
  });
  await db
    .prepare(
      `UPDATE orbs SET cover_key = ?, cover_type = ?,
         meta_json = COALESCE(meta_json, ?),
         width = COALESCE(width, ?), height = COALESCE(height, ?)
       WHERE id = ?`,
    )
    .bind(coverKey, coverData.type, JSON.stringify(parsed.meta), parsed.width, parsed.height, id)
    .run();

  return { kind: "bytes", bytes: coverData.bytes, type: coverData.type };
}
