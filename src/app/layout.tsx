import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { DeviceSync } from "@/components/DeviceSync";
import { InstallPrompt } from "@/components/InstallPrompt";
import { THEME_COOKIE } from "@/lib/device";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
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
  themeColor: "#0d0b09",
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
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <DeviceSync />
        <div className="mx-auto min-h-dvh max-w-lg pb-24">{children}</div>
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  );
}
