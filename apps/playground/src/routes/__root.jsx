import React from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { MinimalNav } from "../components/MinimalNav";
import { FlipFocusProvider } from "../components/FlipFocusModal";
import { getLocale } from "../paraglide/runtime.js";
import * as m from "../paraglide/messages.js";
import "../styles/tailwind.css";

function RootDocument({ children }) {
  return (
    <html lang={getLocale() === "zh" ? "zh-CN" : "en"}>
      <head>
        <HeadContent />
      </head>
      <body>
        <FlipFocusProvider>
          <div className="min-h-screen bg-white dark:bg-[#0a0b0e] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between font-sans transition-colors duration-200 overflow-x-hidden w-full max-w-full">
            <MinimalNav />
            <main className="flex-1 flex flex-col justify-center w-full max-w-full overflow-x-hidden">
              {children}
            </main>
            <footer className="w-full py-8 max-w-7xl mx-auto px-6 sm:px-12 border-t border-neutral-100 dark:border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400 dark:text-neutral-500 font-sans">
              <div>{m.footer_copy()}</div>
              <div>{m.footer_sub()}</div>
            </footer>
          </div>
        </FlipFocusProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: m.meta_title() },
      { name: "description", content: m.meta_description() },
      { name: "keywords", content: m.meta_keywords() },
      { property: "og:type", content: "website" },
      { property: "og:title", content: m.meta_og_title() },
      { property: "og:description", content: m.meta_og_description() },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' stroke='%23ffffff' stroke-width='8' fill='none'/><circle cx='50' cy='20' r='8' fill='%23ffffff'/></svg>",
      },
    ],
  }),
  component: () => <Outlet />,
  shellComponent: RootDocument,
});
