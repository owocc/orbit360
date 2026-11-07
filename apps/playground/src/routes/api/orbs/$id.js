import { createFileRoute } from "@tanstack/react-router";
import { getOrbObject } from "../../../server/orbs.server.js";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/orbs/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!ID_PATTERN.test(params.id)) return new Response("Not found", { status: 404 });

        try {
          const result = await getOrbObject(params.id);
          if (!result) return new Response("Not found", { status: 404 });

          const { row, object } = result;
          const asciiName = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
          const headers = new Headers({
            "content-type": "application/octet-stream",
            "content-length": String(object.size),
            "cache-control": "public, max-age=31536000, immutable",
            "content-disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
            etag: object.httpEtag,
          });

          return new Response(object.body, { headers });
        } catch (error) {
          return Response.json(
            { error: error.code || "internal_error", message: error.message || "读取失败" },
            { status: error.status || 500 },
          );
        }
      },
    },
  },
});
