/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'racho-devs.s3.us-east-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'zom.ai',
      },
    ],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors. These should be fixed for code quality.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
