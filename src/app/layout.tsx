import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { Cabecera } from "@/components/Cabecera";
import { DeviceSync } from "@/components/DeviceSync";
import { InstallPrompt } from "@/components/InstallPrompt";
import { THEME_COOKIE } from "@/lib/device";

// Tres tipografías con tres oficios distintos, como en una redacción:
//
// · DISPLAY (Fraunces) — titulares y cifras. Es una serif con óptica variable:
//   a 60px se ve tallada y a 14px sigue siendo legible.
// · TEXTO (Archivo) — la grotesca de la prensa. Sustituye a Inter, que es la
//   tipografía de TODAS las apps del mundo y por sí sola ya delata la plantilla.
// · DATO (IBM Plex Mono) — todo lo que es número o referencia: puntajes,
//   fechas, folios, rótulos. Que los datos se vean como datos.
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const texto = Archivo({
  variable: "--font-texto",
  subsets: ["latin"],
});

const dato = IBM_Plex_Mono({
  variable: "--font-dato",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Musicart — un disco al día",
  description:
    "Cada día, un álbum que merece tu atención: su historia, su contexto y por qué debería importarte. Curaduría musical narrativa para melómanos curiosos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Musicart",
  },
};

export const viewport: Viewport = {
  themeColor: "#14110c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const isLight = jar.get(THEME_COOKIE)?.value === "light";
  return (
    <html lang="es" className={isLight ? "light" : undefined}>
      <body
        className={`${texto.variable} ${display.variable} ${dato.variable} antialiased`}
      >
        <DeviceSync />
        {/* El folio corrido va en el layout, no en cada página: una publicación
            lleva su cabecera en todas las hojas. */}
        <Cabecera edicion={isLight ? "light" : "dark"} />
        <div className="mx-auto min-h-dvh max-w-lg pb-24">{children}</div>
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  );
}
