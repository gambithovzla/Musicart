import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las imágenes sociales del Salón (9.9) dibujan con las tipografías de la
  // imprenta leyéndolas del disco. Sin esto, el empaquetado de Vercel no se
  // lleva los .ttf a esas dos funciones y la imagen saldría con la fuente de
  // fábrica de `ImageResponse`.
  outputFileTracingIncludes: {
    "/salon/opengraph-image": ["./src/app/salon/tipos/*.ttf"],
    "/salon/disco/[id]/opengraph-image": ["./src/app/salon/tipos/*.ttf"],
  },
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
