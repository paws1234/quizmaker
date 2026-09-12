import type { NextConfig } from 'next';

/**
 * .next/standalone is produced only for the Docker image (its `build` stage sets
 * NEXT_STANDALONE=1) because that target runs the server without node_modules.
 * Hosting platforms such as Vercel use their own output layout, so this stays
 * off everywhere else.
 */
const standalone = process.env.NEXT_STANDALONE === '1';

const nextConfig: NextConfig = {
    ...(standalone ? { output: 'standalone' as const } : {}),
  // Mongoose pulls in optional native drivers; keep it out of the server bundle.
  serverExternalPackages: ['mongoose'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
