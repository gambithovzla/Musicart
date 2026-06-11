import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { DeviceSync } from "@/components/DeviceSync";
import { InstallPrompt } from "@/components/InstallPrompt";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <DeviceSync />
        <div className="mx-auto min-h-dvh max-w-lg pb-24">{children}</div>
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  );
}
