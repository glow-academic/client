// next.config.ts
import type { NextConfig } from "next";
import type { WebpackConfigContext } from "next/dist/server/config-shared";
import type { Configuration as WebpackConfig } from "webpack";

module.exports = {
  basePath: process.env["APP_PREFIX"] || "",
  output: "standalone",
  devIndicators: false,
  trailingSlash: false,
  // TODO: Re-enable linting and type checking after fixing all ESLint and TypeScript errors
  // eslint: { ignoreDuringBuilds: false },
  // typescript: { ignoreBuildErrors: false, tsconfigPath: "./tsconfig.json" },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true, tsconfigPath: "./tsconfig.json" },

  reactStrictMode: false,
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
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
