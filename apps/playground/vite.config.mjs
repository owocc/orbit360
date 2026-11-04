import { copyFileSync, cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const out = resolve(here, "dist");
const MIME = {
  ".json": "application/json; charset=utf-8",
  ".orb": "application/octet-stream",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** dev 服务器把仓库根目录的 catalog.json / assets/ 暴露给页面。 */
function repoStatic() {
  return {
    name: "orbit360-repo-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (pathname !== "/catalog.json" && !pathname.startsWith("/assets/")) return next();

        const file = resolve(repo, `.${pathname}`);
        if (!file.startsWith(repo + sep) || !existsSync(file) || !statSync(file).isFile()) {
          return next();
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(file).pipe(res);
      });
    },
  };
}

/** 构建时把仓库根目录的示例资产带进 dist/。 */
function siteAssets() {
  return {
    name: "orbit360-site-assets",
    closeBundle() {
      if (existsSync(resolve(repo, "assets"))) {
        cpSync(resolve(repo, "assets"), resolve(out, "assets"), { recursive: true });
      }
      if (existsSync(resolve(repo, "catalog.json"))) {
        copyFileSync(resolve(repo, "catalog.json"), resolve(out, "catalog.json"));
      }
      if (existsSync(resolve(repo, ".nojekyll"))) {
        copyFileSync(resolve(repo, ".nojekyll"), resolve(out, ".nojekyll"));
      }
      if (existsSync(resolve(repo, "_headers"))) {
        copyFileSync(resolve(repo, "_headers"), resolve(out, "_headers"));
      }
      if (existsSync(resolve(repo, "_redirects"))) {
        copyFileSync(resolve(repo, "_redirects"), resolve(out, "_redirects"));
      }
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: lazyPlugins(() => [tailwindcss(), react(), repoStatic(), siteAssets()]),
  build: {
    outDir: out,
    assetsDir: "web",
    emptyOutDir: true,
  },
});
