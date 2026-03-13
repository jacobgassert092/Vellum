import type { NextConfig } from "next";

const nextConfig = {
  output: 'export', // For GitHub Pages
  images: {
    unoptimized: true, // Necessary for static exports
  },
};

export default nextConfig;
