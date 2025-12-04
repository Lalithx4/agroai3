/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,
  
  // Enable SWC minification for faster builds
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: ['api.open-meteo.com', 'nominatim.openstreetmap.org'],
    unoptimized: false,
  },
  
  // Enable compression
  compress: true,
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  
  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
  
  // Environment variables for client-side
  env: {
    NEXT_PUBLIC_APP_NAME: 'AgroAI',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

export default nextConfig;
