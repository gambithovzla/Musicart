import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { parseJson, type Palette } from "@/lib/types";

export const alt = "Musicart — un disco al día";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function primeraFrase(texto: string, max = 130): string {
  const m = texto.match(/^.+?[.!?…](\s|$)/);
  const f = (m?.[0] ?? texto).trim();
  return f.length > max ? `${f.slice(0, max - 1)}…` : f;
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      artist: true,
      dossiers: {
        where: { locale: "es" },
        select: { intro: true, wowFactsJson: true },
        take: 1,
      },
    },
  });

  const title = album?.title ?? "Musicart";
  const artist = album?.artist.name ?? "Un disco al día";
  const year = album?.year;
  const cover = album?.coverUrl ?? null;

  // Gancho: una curiosidad "¿Sabías que…?" o la primera frase de la intro.
  const wowFacts = parseJson<string[]>(album?.dossiers[0]?.wowFactsJson, []);
  const intro = album?.dossiers[0]?.intro ?? "";
  const hook = wowFacts[0]?.trim()
    ? primeraFrase(wowFacts[0], 150)
    : intro
      ? primeraFrase(intro, 150)
      : "Un disco, una historia, un viaje.";

  // Tinte con la paleta de la portada (si la hay).
  const palette = parseJson<Palette | null>(album?.paletteJson, null);
  const dark = palette?.darkMuted ?? palette?.darkVibrant ?? "#2a2218";
  const accent = palette?.vibrant ?? palette?.lightVibrant ?? "#c8a24a";

  const titleSize = title.length > 30 ? 54 : title.length > 18 ? 66 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: 64,
          background: `linear-gradient(145deg, ${dark} 0%, #0d0b09 60%, #1a1611 100%)`,
          color: "#f3eee6",
          fontFamily: "Georgia, serif",
        }}
      >
        {cover ? (
          <img
            src={cover}
            width={460}
            height={460}
            alt=""
            style={{
              borderRadius: 24,
              objectFit: "cover",
              boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
            }}
          />
        ) : (
          <div
            style={{
              width: 460,
              height: 460,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000",
              fontSize: 120,
              color: accent,
            }}
          >
            ♪
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontSize: 26,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: accent,
              margin: 0,
            }}
          >
            Musicart · un disco al día
          </p>
          <p style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.04, margin: "18px 0 0 0" }}>
            {title}
          </p>
          <p style={{ fontSize: 34, color: "#b3aa9c", margin: "10px 0 0 0" }}>
            {artist}
            {year ? ` · ${year}` : ""}
          </p>
          <p
            style={{
              fontSize: 27,
              fontStyle: "italic",
              color: "#d8d0c2",
              lineHeight: 1.35,
              margin: "28px 0 0 0",
            }}
          >
            “{hook}”
          </p>
          <p style={{ fontSize: 22, color: accent, margin: "28px 0 0 0" }}>
            ✓ Verificado — con su historia, sin datos inventados
          </p>
        </div>
      </div>
    ),
    { ...size },
  );
}
