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
  // Type errors now gate the build — the TS backlog was burned down (#1). The
  // build fails on any tsc error, so contract drift (client reading API
  // fields/endpoints that no longer exist) can't ship undetected again.
  typescript: { ignoreBuildErrors: false, tsconfigPath: "./tsconfig.json" },
  // TODO: ESLint still ignored during builds — ~16 errors remain (mostly
  // react-hooks/exhaustive-deps, which are behavior-sensitive; a few no-console).
  // Flip to false after a deliberate pass over those (tracked in #1).
  eslint: { ignoreDuringBuilds: true },

  reactStrictMode: false,
  serverExternalPackages: ["pg", "@auth/pg-adapter"],
  // STANDALONE TRACING FIX (backport of main's v1.0.33 fix):
  //
  // The ambient (no-req) server-token path reads the cookie via a
  // `webpackIgnore` dynamic `import("next/headers")` (see
  // `lib/api/server-token.ts` — that dodges the client bundle to preserve the
  // server-only-bearer win). But `webpackIgnore` ALSO hides that import from
  // `@vercel/nft`'s output-file tracing, so the standalone build never traces
  // `undici` (which Next's server runtime needs at runtime) through that path.
  // The deployed `.next/standalone` was therefore missing
  // `node_modules/undici/index.js`: the ambient `getServerIdToken()` threw
  // MODULE_NOT_FOUND, the try/catch swallowed it → no Authorization header on
  // SSR/BFF fetches → API 401 → every data page rendered "Access Denied".
  //
  // Forcing undici into the traced standalone output for every route makes the
  // ambient token path work at runtime regardless of any incidental dep chain,
  // without touching the auth logic or the working req-based ws-ticket path.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/undici/**/*"],
  },
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
