import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained output in .next/standalone for minimal Docker images
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
