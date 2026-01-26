// next.config.js
module.exports = {
  images: {
    domains: ['racho-devs.s3.us-east-2.amazonaws.com', 'zomtech.com'],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors. These should be fixed for code quality.
    ignoreDuringBuilds: true,
  },
};
