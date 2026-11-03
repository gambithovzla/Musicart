import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las imágenes sociales (el Salón en la 9.9, el Atlas en la 11.6) dibujan con
  // las tipografías de la imprenta leyéndolas del disco. Sin esto, el
  // empaquetado de Vercel no se lleva los .ttf a esas funciones y la imagen
  // saldría con la fuente de fábrica de `ImageResponse`. Imagen social nueva =
  // una línea más aquí.
  outputFileTracingIncludes: {
    "/salon/opengraph-image": ["./src/lib/imprenta-og/*.ttf"],
    "/salon/disco/[id]/opengraph-image": ["./src/lib/imprenta-og/*.ttf"],
    "/atlas/opengraph-image": ["./src/lib/imprenta-og/*.ttf"],
    "/atlas/[code]/opengraph-image": ["./src/lib/imprenta-og/*.ttf"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mzstatic.com" }, // portadas de iTunes
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "**.archive.org" }, // redirecciones de Cover Art Archive
      { protocol: "https", hostname: "**.dzcdn.net" }, // carátulas del índice del canon (Deezer)
    ],
    // SIN optimizador de Vercel. El plan gratuito da una cuota mensual de
    // imágenes optimizadas y, al agotarse, /_next/image responde **402
    // OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED**: la app se queda sin UNA SOLA
    // portada (dossier, historias, madriguera, muro de la bienvenida) y lo que ve
    // el oyente es «la imagen está rota».
    //
    // Las portadas que usamos ya vienen en 500–600 px de origen (Cover Art
    // Archive e iTunes), que es justo lo que se pinta: el optimizador no aportaba
    // nada aquí y sí un techo mensual. Con `unoptimized` el navegador pide la
    // imagen a su origen y no pasa por Vercel.
    unoptimized: true,
  },
};

export default nextConfig;
