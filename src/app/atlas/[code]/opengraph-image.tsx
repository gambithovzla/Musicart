import { ImageResponse } from "next/og";
import { paisPorCodigo } from "@/lib/paises";
import { getRetrato } from "@/lib/atlas";
import { ETIQUETA_PAPEL } from "@/lib/atlas-tipos";
import { fuentesDeLaImprenta } from "@/lib/imprenta-og";

export const alt = "El retrato musical de un país · Musicart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const PAPEL = "#14110c";
const TINTA = "#f0e7d5";
const TINTA_SUAVE = "#a99e8a";
const ACENTO = "#c8a24a";

// Compartir un retrato (11.6). Lo que se comparte de un país NO es una carátula
// suelta: es el ÍNDICE del retrato — los cinco papeles con su disco al lado, que
// es exactamente lo que hace que esto sea un atlas y no una playlist. Quien lo
// ve en el chat entiende la promesa sin abrir el enlace.
export default async function RetratoOg({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const fonts = await fuentesDeLaImprenta();
  const pais = paisPorCodigo(code);

  // Igual que las del Salón: si la base no responde, se comparte la portada de
  // la sección en vez de un 500.
  let retrato = null;
  try {
    retrato = pais ? await getRetrato(pais.code) : null;
  } catch {
    retrato = null;
  }

  const nombre = pais?.nombre ?? "el mundo";
  const titulo = retrato?.titulo ?? `Conociendo a ${nombre}`;
  const discos = retrato?.status === "listo" ? retrato.discos.slice(0, 5) : [];
  const tituloSize = titulo.length > 34 ? 54 : titulo.length > 22 ? 66 : 78;

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

        <div style={{ display: "flex", flex: 1, padding: "44px 56px", gap: 44 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 420 }}>
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
              Musicart · El atlas
            </p>
            <p
              style={{
                fontFamily: "Fraunces",
                fontSize: tituloSize,
                fontWeight: 600,
                lineHeight: 1.0,
                margin: "18px 0 0 0",
              }}
            >
              {titulo}
            </p>
            <div style={{ display: "flex", height: 2, background: TINTA, margin: "24px 0 0 0" }} />
            <p
              style={{
                fontSize: 23,
                color: TINTA_SUAVE,
                lineHeight: 1.35,
                margin: "20px 0 0 0",
              }}
            >
              {discos.length > 0
                ? `${discos.length} discos para conocer ${nombre}. De cada artista se comprueba que sea de ahí.`
                : `Un país, cinco discos, y de cada artista se comprueba que sea de ahí.`}
            </p>
          </div>

          {discos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }}>
              {discos.map((d) => (
                <div
                  key={d.orden}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderTop: `1px solid ${TINTA_SUAVE}`,
                    padding: "12px 0 10px 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: ACENTO,
                      fontFamily: "IBM Plex Mono",
                    }}
                  >
                    {ETIQUETA_PAPEL[d.papel]}
                  </span>
                  <span
                    style={{
                      fontFamily: "Fraunces",
                      fontSize: 30,
                      fontWeight: 600,
                      lineHeight: 1.05,
                      margin: "4px 0 0 0",
                    }}
                  >
                    {d.title.length > 34 ? `${d.title.slice(0, 33)}…` : d.title}
                  </span>
                  <span style={{ fontSize: 19, color: TINTA_SUAVE, margin: "2px 0 0 0" }}>
                    {d.artist}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
