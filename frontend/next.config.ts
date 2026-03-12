import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "images.loox.io" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
