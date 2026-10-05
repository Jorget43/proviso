import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Workspace repo: trace files from the repo root so the standalone build
  // includes packages/core, and compile core's TypeScript source directly.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: { root: path.join(__dirname, '../..') },
  transpilePackages: ['@proviso/core'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders(process.env.NODE_ENV !== 'production') }]
  },
};

export default nextConfig;
