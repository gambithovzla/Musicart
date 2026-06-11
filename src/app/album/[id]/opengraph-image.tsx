import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const alt = "Musicart — un disco al día";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await prisma.album.findUnique({
    where: { id },
    include: { artist: true },
  });

  const title = album?.title ?? "Musicart";
  const artist = album?.artist.name ?? "Un disco al día";
  const year = album?.year;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 64,
          background: "linear-gradient(145deg, #1a1611 0%, #0d0b09 55%, #2a2218 100%)",
          color: "#f3eee6",
          fontFamily: "Georgia, serif",
        }}
      >
        <p
          style={{
            fontSize: 28,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#c8a24a",
            marginBottom: 16,
          }}
        >
          Musicart
        </p>
        <p style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, margin: 0 }}>
          {title}
        </p>
        <p style={{ fontSize: 36, color: "#b3aa9c", marginTop: 16 }}>
          {artist}
          {year ? ` · ${year}` : ""}
        </p>
        <p style={{ fontSize: 24, color: "#8a7a55", marginTop: 32 }}>
          Un disco, una historia, un viaje
        </p>
      </div>
    ),
    { ...size },
  );
}
