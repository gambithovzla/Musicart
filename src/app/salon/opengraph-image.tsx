import { ImageResponse } from "next/og";
import { getMuro, estadoDelSalon } from "@/lib/canon/consulta";
import { fuentesDeLaImprenta } from "./tipos";

export const alt = "El Salón de la Fama · Musicart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// No se prerenderiza en el build: el índice del canon crece (el worker lo llena
// de noche), así que una cifra congelada en el último despliegue sería mentira.
// De paso, el build deja de depender de que la base responda para pintar esto.
export const dynamic = "force-dynamic";

// La imagen social del Salón (9.9). No es la de la Vitrina con otro texto: la
// Vitrina comparte GUSTO (un colage de carátulas queridas) y el Salón comparte
// VEREDICTO, así que aquí manda la cifra y el dato, no el mosaico.
//
// Está compuesta con la imprenta (Fase 10): filete grueso arriba, rótulo en
// versalitas, titular en display, cero esquinas redondeadas y las sombras
// duras, sin difuminar. Los colores y las fuentes van a pelo porque
// `ImageResponse` no ve las variables CSS ni el `next/font` de la app (ver
// `./tipos`), y siempre en la edición de noche: una imagen social se ve casi
// siempre sobre el fondo oscuro de la app que la enseña.
const PAPEL = "#14110c";
const PAPEL_HONDO = "#0c0a07";
const TINTA = "#f0e7d5";
const TINTA_SUAVE = "#a99e8a";
const ACENTO = "#c8a24a";

/** 1024 → "1.024". A mano: el ICU del runtime no siempre agrupa millares. */
function millares(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default async function SalonOg() {
  // Una imagen social nunca puede tumbar una página: si la base no responde,
  // se comparte la portada de la sección sin cifras en vez de un 500.
  const fonts = await fuentesDeLaImprenta();

  let covers: string[] = [];
  let total = 0;
  let inmortales = 0;
  try {
    const [muro, estado] = await Promise.all([getMuro(6), estadoDelSalon()]);
    covers = muro
      .map((a) => a.coverUrl)
      .filter((c): c is string => !!c)
      .slice(0, 6);
    inmortales = muro.filter((a) => a.score === 100).length;
    total = estado.conPuntaje;
  } catch {
    // sin datos, la portada sola
  }

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
        {/* Filete grueso: la sección arranca con una barra entintada. */}
        <div style={{ display: "flex", height: 14, background: ACENTO }} />

        <div style={{ display: "flex", flex: 1, padding: "48px 56px", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
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
              Musicart · Sección II
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Fraunces",
                fontSize: 88,
                fontWeight: 600,
                lineHeight: 0.98,
                margin: "20px 0 0 0",
              }}
            >
              <span>El Salón</span>
              <span>de la Fama</span>
            </div>
            <div style={{ display: "flex", height: 2, background: TINTA, margin: "28px 0 0 0" }} />
            <p style={{ fontSize: 27, color: TINTA_SUAVE, lineHeight: 1.35, margin: "24px 0 0 0" }}>
              El veredicto de la historia, no mi gusto: cada disco con un puntaje
              de 1 a 100 comparable con todos los demás.
            </p>

            {total > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 18, margin: "auto 0 0 0" }}>
                <span
                  style={{
                    display: "flex",
                    border: `2px solid ${TINTA}`,
                    padding: "8px 14px",
                    fontSize: 26,
                    fontFamily: "IBM Plex Mono",
                  }}
                >
                  {millares(total)} discos en el canon
                </span>
                {inmortales > 0 && (
                  <span
                    style={{
                      display: "flex",
                      fontSize: 22,
                      color: TINTA_SUAVE,
                      fontFamily: "IBM Plex Mono",
                    }}
                  >
                    {inmortales} en el club de los 100
                  </span>
                )}
              </div>
            )}
          </div>

          {covers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: 470 }}>
                {covers.map((c, i) => (
                  <img
                    key={i}
                    src={c}
                    width={148}
                    height={148}
                    alt=""
                    style={{
                      objectFit: "cover",
                      border: `1px solid ${TINTA_SUAVE}`,
                      boxShadow: `6px 6px 0 0 ${PAPEL_HONDO}`,
                    }}
                  />
                ))}
              </div>
              {/* Pie de figura: regla 7, lo que se ilustra se rotula. */}
              <p
                style={{
                  fontSize: 17,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: TINTA_SUAVE,
                  margin: "18px 0 0 0",
                  fontFamily: "IBM Plex Mono",
                }}
              >
                Lámina — el muro de los inmortales
              </p>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
