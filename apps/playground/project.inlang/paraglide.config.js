/** @type {import("@inlang/paraglide-js").ParaglideConfig} */
export default {
  outdir: "./src/paraglide",
  outputStructure: "message-modules",
  cookieName: "PARAGLIDE_LOCALE",
  strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
  trailingSlash: "never",
  urlPatterns: [
    {
      pattern: "/",
      localized: [
        ["zh", "/zh"],
        ["en", "/en"],
      ],
    },
    {
      pattern: "/:path(.*)?",
      localized: [
        ["zh", "/zh/:path(.*)?"],
        ["en", "/en/:path(.*)?"],
      ],
    },
  ],
};
