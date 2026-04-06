/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'oaidalleapiprodscus.blob.core.windows.net' },
      { protocol: 'https', hostname: '**.blob.core.windows.net' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'prisma', '@prisma/client'],
  },
  // Allow build without database connection
  output: 'standalone',
};

module.exports = nextConfig;
