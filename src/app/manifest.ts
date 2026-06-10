import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Musicart — un disco al día",
    short_name: "Musicart",
    description:
      "Cada día, un álbum que merece tu atención: su historia, su contexto y por qué debería importarte.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0b09",
    theme_color: "#0d0b09",
    lang: "es",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
