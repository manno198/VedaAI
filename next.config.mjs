/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-to-img", "@napi-rs/canvas"],
  },
};

export default nextConfig;
