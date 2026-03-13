import type { NextConfig } from "next";

const isProd = process.env.NODE_VALUE === 'production';
const repoName = "Vellum"

const nextConfig = {
  output: 'export', // For GitHub Pages
  images: {
    unoptimized: true, // Necessary for static exports
  },
  basePath: isProd ? `/${repoName}` : '',
  assetPrefix: isProd ? `/${repoName}/` : '',
};

export default nextConfig;
