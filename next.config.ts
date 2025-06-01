
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      // The origin from the error log, assuming HTTPS and port 6000
      'https://6000-firebase-studio-1747625597829.cluster-uf6urqn4lned4spwk4xorq6bpo.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
