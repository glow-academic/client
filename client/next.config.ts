/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env['NEXT_PUBLIC_BASE_PATH'] || '',  // "/beta" in beta
  output:   'standalone',
  devIndicators: false,
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  eslint:     { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false, tsconfigPath: './tsconfig.json' },

  reactStrictMode: false,
  serverExternalPackages: ['pg', '@auth/pg-adapter'],

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, 'pg-native': false, 'cloudflare:sockets': false };
    }
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$|^cloudflare:sockets$/ })
    );
    return config;
  },
};

export default nextConfig;