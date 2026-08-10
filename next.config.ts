import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mzstatic.com" }, // portadas de iTunes
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "**.archive.org" }, // redirecciones de Cover Art Archive
      { protocol: "https", hostname: "**.dzcdn.net" }, // carátulas del índice del canon (Deezer)
    ],
  },
};

export default nextConfig;
