import handler from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./paraglide/server.js";

export default {
  fetch(request) {
    // TanStack Router 通过 rewrite 自行处理 URL 本地化，因此这里传入原始 request。
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
