import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces .next/standalone so the production image can run without node_modules.
  output: 'standalone',
  // Mongoose pulls in optional native drivers; keep it out of the server bundle.
  serverExternalPackages: ['mongoose'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
