import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  // A package-lock.json exists in the home directory; keep Turbopack rooted at this project.
  turbopack: { root: path.resolve(__dirname) },
  // HQ embeds this app in an iframe; allow it from 10 Minute School origins only.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.10minuteschool.com https://*.10minuteschool.net" },
        ],
      },
    ];
  },
};

export default nextConfig;
