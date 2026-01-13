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
};

export default nextConfig;
