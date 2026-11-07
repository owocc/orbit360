import { createServerFn } from "@tanstack/react-start";
import { listOrbs } from "./orbs.server.js";

/** 画廊分页查询：固定 20 条/页，客户端只传 cursor。 */
export const getOrbsPage = createServerFn({ method: "GET" })
  .validator((data) => ({
    cursor: typeof data?.cursor === "string" && data.cursor ? data.cursor : null,
  }))
  .handler(({ data }) => listOrbs({ cursor: data.cursor }));
