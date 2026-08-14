import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@room/config', '@room/contracts'],
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
