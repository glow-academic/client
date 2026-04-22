// next.config.ts
import type { NextConfig } from "next";
import type { WebpackConfigContext } from "next/dist/server/config-shared";
import type { Configuration as WebpackConfig } from "webpack";
import { readFileSync } from "fs";
import { join } from "path";

// Read pinned API version from api-versions.json at build time
const apiVersions = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "api-versions.json"), "utf8"));
  } catch {
    return {};
  }
})();

module.exports = {
  env: {
    NEXT_PUBLIC_API_VERSION: apiVersions?.["glow-api"]?.version || "unknown",
  },
  basePath: process.env["APP_PREFIX"] || "",
  output: "standalone",
  devIndicators: false,
  trailingSlash: false,
  // TODO: Re-enable type checking after fixing all TypeScript errors
  typescript: { ignoreBuildErrors: true, tsconfigPath: "./tsconfig.json" },
  // TODO: Re-enable after catching lint up with the v2.6.0 refactor
  eslint: { ignoreDuringBuilds: true },

  reactStrictMode: false,
  serverExternalPackages: ["pg", "@auth/pg-adapter"],
  webpack: (
    config: WebpackConfig,
    { isServer, webpack }: WebpackConfigContext
  ): WebpackConfig => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          "pg-native": false,
          "cloudflare:sockets": false,
        },
      };
    }

    config.plugins?.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
      })
    );

    return config;
  },
} as NextConfig;
