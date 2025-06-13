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
};

export default nextConfig;
