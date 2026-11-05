const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [workspaceRoot];

config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    if (url.startsWith("/index.bundle") || url.startsWith("/index.map")) {
      return "/examples/expo" + url;
    }
    return url;
  },
};

// 允许解析 .orb 资源文件
config.resolver.assetExts.push("orb");
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
