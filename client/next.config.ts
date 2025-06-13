import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Fail the build on ESLint errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Fail the build on TypeScript errors
    ignoreBuildErrors: false,
  },
  // Enable strict mode for better error catching
  reactStrictMode: true,

  // Fix pg-related issues - updated for Next.js 15+
  serverExternalPackages: ["pg", "@auth/pg-adapter"],

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Ignore pg-native on client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "pg-native": false,
        "cloudflare:sockets": false,
      };
    }

    // Ignore optional dependencies that cause build issues
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
      })
    );

    return config;
  },
};

export default nextConfig;
