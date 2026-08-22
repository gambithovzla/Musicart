import { ImageResponse } from "next/og";
import { getCanonAlbum } from "@/lib/canon/consulta";
import { pisoDe } from "@/lib/canon/score";
import { fuentesDeLaImprenta } from "@/lib/imprenta-og";

export const alt = "Un disco del canon · Musicart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Igual que la del Salón: el puntaje se recalibra cada vez que entran discos
// nuevos al índice, así que esta imagen se pinta cuando alguien la pide.
export const dynamic = "force-dynamic";

const PAPEL = "#14110c";
const PAPEL_HONDO = "#0c0a07";
const TINTA = "#f0e7d5";
const TINTA_SUAVE = "#a99e8a";
const ACENTO = "#c8a24a";

// "Soy un 96 de 100" (9.9). Lo que se comparte de un disco del canon es SU
// CIFRA, así que la cifra es el objeto de la imagen: va grabada como en la
// pestaña (`SelloPuntaje`), con el mismo peso de tinta según la altura — un 100
// en negativo, un 95 con marco macizo, y de ahí para abajo el marco se afina.
//
// Y va con un recibo. Compartir un número sin decir de dónde sale es
// exactamente lo que el Salón existe para no hacer.
function entintado(score: number) {
  if (score >= 100) {
    return { background: TINTA, color: PAPEL, border: `3px solid ${TINTA}` };
  }
  if (score >= 95) {
    return { background: "transparent", color: TINTA, border: `4px solid ${TINTA}` };
  }
  if (score >= 90) {
    return { background: "transparent", color: TINTA, border: `2px solid ${TINTA}` };
  }
  return { background: "transparent", color: TINTA_SUAVE, border: `1px solid ${TINTA_SUAVE}` };
}

export default async function DiscoDelCanonOg({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fonts = await fuentesDeLaImprenta();

  // Como en la del Salón: si la base falla, imagen sobria y nunca un 500.
  let album = null;
  try {
    album = await getCanonAlbum(id);
  } catch {
    album = null;
  }

  const title = album?.title ?? "El Salón de la Fama";
  const artist = album?.artist ?? "El veredicto de la historia";
  const year = album?.year ?? null;
  const score = album?.score ?? 0;
  const piso = pisoDe(score);
  const recibo = album?.evidencia[0] ?? null;
  const sello = entintado(score);

  const titleSize = title.length > 34 ? 52 : title.length > 20 ? 64 : 76;

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

        <div style={{ display: "flex", flex: 1, padding: "44px 56px", gap: 48 }}>
          {album?.coverUrl ? (
            <img
              src={album.coverUrl}
              width={420}
              height={420}
              alt=""
              style={{
                objectFit: "cover",
                border: `1px solid ${TINTA_SUAVE}`,
                boxShadow: `12px 12px 0 0 ${PAPEL_HONDO}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 420,
                height: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${TINTA_SUAVE}`,
                background: PAPEL_HONDO,
                fontFamily: "Fraunces",
                fontSize: 170,
                fontWeight: 600,
                color: ACENTO,
              }}
            >
              {title.trim().charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <p
              style={{
                fontSize: 20,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: ACENTO,
                margin: 0,
                fontFamily: "IBM Plex Mono",
              }}
            >
              Musicart · El Salón de la Fama
            </p>
            <p
              style={{
                fontFamily: "Fraunces",
                fontSize: titleSize,
                fontWeight: 600,
                lineHeight: 1.02,
                margin: "16px 0 0 0",
              }}
            >
              {title}
            </p>
            <p style={{ fontSize: 30, color: TINTA_SUAVE, margin: "10px 0 0 0" }}>
              {artist}
              {year ? ` · ${year}` : ""}
            </p>

            {score > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 22, margin: "30px 0 0 0" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    padding: "10px 20px",
                    fontFamily: "IBM Plex Mono",
                    ...sello,
                  }}
                >
                  {/* La cifra va en display y el "/100" en mono, igual que
                      `SelloPuntaje` en la pestaña. */}
                  <span
                    style={{
                      fontFamily: "Fraunces",
                      fontSize: 86,
                      fontWeight: 600,
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                    }}
                  >
                    {score}
                  </span>
                  <span style={{ fontSize: 24, opacity: 0.6 }}>/100</span>
                </span>
                <span
                  style={{
                    display: "flex",
                    fontSize: 24,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: TINTA_SUAVE,
                    fontFamily: "IBM Plex Mono",
                  }}
                >
                  {piso.nombre}
                </span>
              </div>
            )}

            {recibo && (
              <p
                style={{
                  fontSize: 24,
                  color: TINTA_SUAVE,
                  lineHeight: 1.35,
                  borderTop: `1px solid ${TINTA_SUAVE}`,
                  padding: "20px 0 0 0",
                  margin: "auto 0 0 0",
                }}
              >
                {recibo}
              </p>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
