import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // プロトタイプ段階: lint は `npm run lint` で個別に回す (build は型チェックのみ)
    ignoreDuringBuilds: true,
  },
  experimental: {
    turbo: {
      resolveAlias: {
        underscore: 'lodash',
        mocha: { browser: 'mocha/browser-entry.js' },
      },
    },
  },
};

export default nextConfig;
