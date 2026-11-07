import { createFileRoute } from "@tanstack/react-router";
import {
  MAX_COVER_BYTES,
  MAX_ORB_BYTES,
  sniffImageType,
  validateOrbName,
} from "../../lib/orb-file.js";
import { createOrb, listOrbs } from "../../server/orbs.server.js";

function errorResponse(error, status = 500) {
  return Response.json(
    {
      error: error.code || "internal_error",
      message: error.message || "服务端错误",
    },
    { status: error.status || status },
  );
}

/** 丢弃超大请求体，避免开发代理因未消费 body 而报 fetch failed。 */
async function discardBody(request) {
  if (!request.body) return;
  const reader = request.body.getReader();
  try {
    while (!(await reader.read()).done) {
      // 分块丢弃，避免一次性分配整个请求体。
    }
  } catch {
    // 客户端中断时忽略。
  }
}

export const Route = createFileRoute("/api/orbs")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json({ items: await listOrbs() });
        } catch (error) {
          return errorResponse(error);
        }
      },

      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") || 0);
        // multipart 边界与字段额外开销按 64 KB 预留，避免超大请求进入解析。
        if (contentLength > MAX_ORB_BYTES + MAX_COVER_BYTES + 64 * 1024) {
          await discardBody(request);
          return Response.json(
            { error: "too_large", message: "文件不能超过 10 MB" },
            { status: 413 },
          );
        }

        let form;
        try {
          form = await request.formData();
        } catch {
          return Response.json(
            { error: "bad_request", message: "请求必须是 multipart/form-data" },
            { status: 400 },
          );
        }

        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function") {
          return Response.json(
            { error: "missing_file", message: "缺少 file 字段" },
            { status: 400 },
          );
        }

        const name = validateOrbName(file.name);
        if (!name) {
          return Response.json({ error: "bad_name", message: "仅支持 .orb 文件" }, { status: 400 });
        }
        if (file.size === 0) {
          return Response.json({ error: "empty_file", message: "文件内容为空" }, { status: 400 });
        }
        if (file.size > MAX_ORB_BYTES) {
          return Response.json(
            { error: "too_large", message: "文件不能超过 10 MB" },
            { status: 413 },
          );
        }

        let cover = null;
        const coverFile = form.get("cover");
        if (coverFile && typeof coverFile.arrayBuffer === "function") {
          if (coverFile.size > MAX_COVER_BYTES) {
            return Response.json(
              { error: "invalid_cover", message: "封面不能超过 5 MB" },
              { status: 400 },
            );
          }
          const head = new Uint8Array(await coverFile.slice(0, 16).arrayBuffer());
          if (!sniffImageType(head)) {
            return Response.json(
              { error: "invalid_cover", message: "封面不是有效图片" },
              { status: 400 },
            );
          }
          cover = { buffer: await coverFile.arrayBuffer() };
        }

        try {
          const buffer = await file.arrayBuffer();
          const item = await createOrb({
            buffer,
            name,
            title: String(form.get("title") || ""),
            description: String(form.get("description") || ""),
            cover,
          });
          return Response.json({ item }, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
