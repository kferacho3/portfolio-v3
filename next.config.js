// next.config.js
module.exports = {
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
      {
        protocol: 'https',
        hostname: 'www.zom.ai',
      },
      // Preview hosts for constellation projects (Cycle 2)
      {
        protocol: 'https',
        hostname: '**.vercel.app',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
