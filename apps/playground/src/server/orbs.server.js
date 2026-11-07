import { env } from "cloudflare:workers";
import { validateOrbBuffer, MAX_ORB_BYTES } from "../lib/orb-file.js";

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS orbs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  size INTEGER NOT NULL,
  frame_count INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
)`;
const CREATE_INDEX = "CREATE INDEX IF NOT EXISTS idx_orbs_created_at ON orbs (created_at DESC)";

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

/** 首次访问时幂等建表，保证新环境无需手动迁移即可运行。 */
function ensureSchema() {
  if (!schemaReady) {
    const db = database();
    schemaReady = db.batch([db.prepare(CREATE_TABLE), db.prepare(CREATE_INDEX)]).catch((error) => {
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
    size: row.size,
    frameCount: row.frame_count,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    url: `/api/orbs/${row.id}`,
  };
}

export async function listOrbs() {
  await ensureSchema();
  const { results } = await database()
    .prepare(
      `SELECT id, name, title, size, frame_count, width, height, created_at
       FROM orbs ORDER BY created_at DESC LIMIT 100`,
    )
    .all();
  return results.map(toItem);
}

export async function createOrb({ buffer, name }) {
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
  const title = parsed.title || name.replace(/\.orb$/i, "");
  const createdAt = new Date().toISOString();
  const bucket = storage();

  await bucket.put(key, buffer, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { name, title },
  });

  try {
    await database()
      .prepare(
        `INSERT INTO orbs
          (id, name, title, size, frame_count, width, height, r2_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        name,
        title,
        buffer.byteLength,
        parsed.header.frameCount,
        parsed.width,
        parsed.height,
        key,
        createdAt,
      )
      .run();
  } catch (error) {
    await bucket.delete(key).catch(() => {});
    throw new OrbServiceError("db_error", `写入 D1 失败: ${error.message}`);
  }

  return {
    id,
    name,
    title,
    size: buffer.byteLength,
    frameCount: parsed.header.frameCount,
    width: parsed.width,
    height: parsed.height,
    createdAt,
    url: `/api/orbs/${id}`,
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
