import { ImageResponse } from "next/og";
import { REGIONES, PAISES } from "@/lib/paises";
import { fuentesDeLaImprenta } from "@/lib/imprenta-og";

export const alt = "El atlas · Musicart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Sin base de datos de por medio: la sección es la tabla de países, que es
// código. Aun así va dinámica por coherencia con las demás (9.9) y para que el
// build no dependa de nada.
export const dynamic = "force-dynamic";

const PAPEL = "#14110c";
const TINTA = "#f0e7d5";
const TINTA_SUAVE = "#a99e8a";
const ACENTO = "#c8a24a";

export default async function AtlasOg() {
  const fonts = await fuentesDeLaImprenta();

  // Un puñado de países como muestra de que esto es el mundo entero, no cuatro
  // sitios. Se eligen de regiones distintas a propósito.
  const muestra = ["VE", "ML", "JP", "BR", "SN", "IS", "EG", "AU"]
    .map((c) => PAISES.find((p) => p.code === c)?.nombre)
    .filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPEL,
          color: TINTA,
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", height: 14, background: ACENTO }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 56px" }}>
          <p
            style={{
              fontSize: 22,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: ACENTO,
              margin: 0,
              fontFamily: "IBM Plex Mono",
            }}
          >
            Musicart · Sección IV
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Fraunces",
              fontSize: 92,
              fontWeight: 600,
              lineHeight: 0.98,
              margin: "20px 0 0 0",
            }}
          >
            <span>Conociendo</span>
            <span>a…</span>
          </div>

          <div style={{ display: "flex", height: 2, background: TINTA, margin: "28px 0 0 0" }} />

          <p style={{ fontSize: 27, color: TINTA_SUAVE, lineHeight: 1.35, margin: "24px 0 0 0" }}>
            Elige un país y te lo cuento en cinco discos: de dónde viene su
            música, con qué se mezcló y qué suena hoy.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              margin: "auto 0 0 0",
            }}
          >
            {muestra.map((n) => (
              <span
                key={n}
                style={{
                  display: "flex",
                  border: `1px solid ${TINTA_SUAVE}`,
                  padding: "6px 12px",
                  fontSize: 20,
                  color: TINTA_SUAVE,
                  fontFamily: "IBM Plex Mono",
                }}
              >
                {n}
              </span>
            ))}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 4px",
                fontSize: 20,
                color: ACENTO,
                fontFamily: "IBM Plex Mono",
              }}
            >
              y {PAISES.length - muestra.length} más, en {REGIONES.length} regiones
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
