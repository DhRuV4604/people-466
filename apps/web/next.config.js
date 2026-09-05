/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The shared package ships TypeScript sources compiled to CJS; transpiling it
  // here keeps the workspace link working without a separate build step in dev.
  transpilePackages: ['@peoplepay360/shared'],
  output: 'standalone',
};

module.exports = nextConfig;
