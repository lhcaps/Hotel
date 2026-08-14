import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@room/config', '@room/contracts'],
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1';
    const apiOrigin = (() => {
      try {
        return new URL(apiBase).origin;
      } catch {
        return 'http://127.0.0.1:3001';
      }
    })();
    return [
      // Forward public, anonymous API calls (e.g. public contact fetch on
      // /admin/property) to the API server. Authenticated routes keep their
      // own dedicated /api/* proxies under apps/web/src/app/api so cookies
      // and CSRF behaviour remain under explicit control.
      {
        source: '/api/v1/public/:path*',
        destination: `${apiOrigin}/api/v1/public/:path*`,
      },
    ];
  },
};

export default nextConfig;
