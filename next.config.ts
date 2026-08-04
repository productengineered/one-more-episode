import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.tvmaze.com" },
      { protocol: "https", hostname: "image.tmdb.org" },
    ],
  },
  async redirects() {
    return [{ source: "/premieres", destination: "/discover", permanent: false }];
  },
};

export default nextConfig;
