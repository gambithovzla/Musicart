import { ImageResponse } from "next/og";
import { getVitrinaAlbums } from "@/lib/vitrina";

export const alt = "La vitrina · Musicart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// No se prerenderiza en el build. Dos motivos: la vitrina cambia cuando el
// curador mete un disco (una imagen congelada en el último despliegue enseñaría
// una vitrina vieja), y sobre todo, prerenderizarla ata el BUILD a que la base
// de datos responda — si Postgres tiene un mal minuto justo entonces, el
// despliegue entero falla por una imagen social. Las del Salón (9.9) ya se
// hicieron así.
export const dynamic = "force-dynamic";

// Imagen social de la vitrina: un colage de las carátulas atesoradas junto al
// título. Si aún no hay discos, una tarjeta editorial limpia.
export default async function VitrinaOg() {
  const albums = await getVitrinaAlbums();
  const covers = albums
    .map((a) => a.coverUrl)
    .filter((c): c is string => !!c)
    .slice(0, 6);

  const accent = albums[0]?.palette?.vibrant ?? "#c8a24a";

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
          background: "linear-gradient(145deg, #1a1611 0%, #0d0b09 55%, #241d13 100%)",
          color: "#f3eee6",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <p
            style={{
              fontSize: 26,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: accent,
              margin: 0,
            }}
          >
            Musicart · la colección
          </p>
          <p style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.02, margin: "16px 0 0 0" }}>
            La vitrina
          </p>
          <p style={{ fontSize: 30, color: "#c7bdae", margin: "18px 0 0 0", lineHeight: 1.35 }}>
            Las carátulas que atesoro,
            <br />
            cada una con su historia.
          </p>
          {albums.length > 0 && (
            <p style={{ fontSize: 24, color: accent, margin: "26px 0 0 0" }}>
              {albums.length} {albums.length === 1 ? "disco en exhibición" : "discos en exhibición"}
            </p>
          )}
        </div>

        {covers.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              width: 460,
              gap: 14,
              justifyContent: "flex-end",
            }}
          >
            {covers.map((c, i) => (
              <img
                key={i}
                src={c}
                width={210}
                height={210}
                alt=""
                style={{
                  borderRadius: 16,
                  objectFit: "cover",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
