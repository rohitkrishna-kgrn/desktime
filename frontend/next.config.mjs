/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow all image sources (screenshots served from backend)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
