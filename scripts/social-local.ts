// La imprenta de la laptop (Fase 12.7): la usa Efesto, en Panteón, una vez al día.
//
//   npm run social:local                 → pieza de hoy: la pide, la imprime y avisa
//   npm run social:local -- --salida C:\ruta\carpeta
//   npm run social:local -- --rehacer    → retira la de hoy y fabrica otra
//   npm run social:local -- --pedido "Wolf Alice"            → pieza nueva sobre lo que pidas
//   npm run social:local -- --disco "My Love Is Cool" --artista "Wolf Alice"  → un disco exacto
//   npm run social:local -- --estado     → solo dice en qué punto está (no gasta)
//
// Necesita, en un archivo `.env.social` en la raíz de Musicart (o en el entorno):
//   MUSICART_URL=https://<tu-dominio-de-musicart>
//   SOCIAL_API_KEY=<la misma llave que en Vercel>
//
// NO necesita la base de datos ni claves de IA: todo eso lo hace Musicart en
// Vercel. Aquí solo se imprime el video (Remotion), que en Vercel no cabe.
//
// La ÚLTIMA línea que imprime es un JSON con el resultado, para que el agente
// la lea sin adivinar: {"ok":true,"estado":"video-listo","mp4":"...","caption":"..."}

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { renderizarMp4 } from "../src/lib/social/mp4";
import type { PiezaDelDia } from "../src/lib/social/del-dia";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const valor = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const archivoEnv = path.join(process.cwd(), ".env.social");
if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);

const BASE = process.env.MUSICART_URL?.trim().replace(/\/$/, "");
const LLAVE = process.env.SOCIAL_API_KEY?.trim();
const SALIDA = path.resolve(valor("--salida") ?? path.join(process.cwd(), "salida-social"));

function terminar(resultado: Record<string, unknown>, codigo = 0): never {
  console.log(JSON.stringify(resultado));
  process.exit(codigo);
}

async function llamar(metodo: "GET" | "POST", cuerpo?: unknown): Promise<PiezaDelDia> {
  // La ruta puede tardar sus 300 s enteros fabricando: se espera un poco más.
  const res = await fetch(`${BASE}/api/social/del-dia`, {
    method: metodo,
    headers: { Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(330_000),
  });
  const data = (await res.json().catch(() => ({}))) as PiezaDelDia & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Musicart respondió ${res.status}`);
  return data;
}

async function main() {
  if (!BASE || !LLAVE) {
    terminar({ ok: false, error: "Faltan MUSICART_URL o SOCIAL_API_KEY (ponlos en .env.social)." }, 1);
  }

  if (flag("--estado")) {
    const p = await llamar("GET");
    terminar({ ok: true, estado: p.estado, siguiente: p.siguiente, disco: p.pieza?.disco ?? null });
  }

  // 1. Que Musicart avance la pieza hasta dejarla lista (varias llamadas: cada
  //    una cabe en los 300 s de Vercel).
  // El pedido va SOLO en la primera llamada: las siguientes terminan esa misma pieza.
  const pedido = valor("--pedido");
  const disco = valor("--disco");
  const artista = valor("--artista");
  if ((disco && !artista) || (!disco && artista)) {
    terminar({ ok: false, error: "--disco y --artista van juntos." }, 1);
  }
  let p = await llamar("POST", { accion: "avanzar", rehacer: flag("--rehacer"), pedido, disco, artista });
  if (p.estado === "pedido-sin-disco") {
    for (const linea of p.bitacora) console.error(`· ${linea}`);
    terminar({ ok: false, estado: p.estado, siguiente: p.siguiente, bitacora: p.bitacora }, 2);
  }
  for (const linea of p.bitacora) console.error(`· ${linea}`);
  for (let i = 0; i < 5 && (p.estado === "en-preparacion" || p.estado === "sin-pieza"); i++) {
    p = await llamar("POST", { accion: "avanzar" });
    for (const linea of p.bitacora) console.error(`· ${linea}`);
  }

  if (p.estado === "video-listo" && !flag("--reimprimir") && !pedido && !disco) {
    terminar({ ok: true, estado: p.estado, aviso: "El video de hoy ya estaba impreso.", videoUrl: p.pieza?.videoUrl, caption: p.pieza?.caption, siguiente: p.siguiente });
  }
  if (!["lista-para-imprimir", "fallo-imprenta", "video-listo"].includes(p.estado) || !p.pieza?.render) {
    terminar({ ok: false, estado: p.estado, siguiente: p.siguiente, notas: p.pieza?.notasVerificacion ?? [] }, 2);
  }
  const pieza = p.pieza!;

  // 2. Imprimir el MP4 aquí.
  await llamar("POST", { accion: "imprimiendo", id: pieza.id });
  const carpeta = path.join(SALIDA, `${p.fecha}-${pieza.id.slice(-6)}`);
  await mkdir(carpeta, { recursive: true });
  const mp4 = path.join(carpeta, "video.mp4");
  try {
    // La voz vive en un almacén privado: se baja con la llave y se deja en
    // public/ para que la imprenta la lea como archivo propio.
    const render = { ...pieza.render! };
    if (render.audioUrl) {
      const res = await fetch(`${BASE}/api/social/del-dia/voz?id=${encodeURIComponent(pieza.id)}`, {
        headers: { Authorization: `Bearer ${LLAVE}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`No pude bajar la voz (Musicart respondió ${res.status}).`);
      const dirVoz = path.join(process.cwd(), "public", "social", pieza.id);
      await mkdir(dirVoz, { recursive: true });
      await writeFile(path.join(dirVoz, "voice.mp3"), Buffer.from(await res.arrayBuffer()));
      render.audioUrl = `/social/${pieza.id}/voice.mp3`;
    }
    console.error(`· Imprimiendo «${pieza.disco}» de ${pieza.artista}…`);
    await renderizarMp4(render, mp4);
  } catch (err) {
    const error = (err as Error).message;
    await llamar("POST", { accion: "fallo", id: pieza.id, error }).catch(() => {});
    terminar({ ok: false, estado: "fallo-imprenta", error }, 3);
  }

  // 3. Dejar al lado todo lo que hace falta para publicar.
  await writeFile(path.join(carpeta, "caption.txt"), pieza.caption, "utf8");
  await writeFile(path.join(carpeta, "pieza.json"), JSON.stringify(pieza, null, 2), "utf8");

  // El MP4 se queda en la laptop: el almacén de Blob es privado, así que subirlo
  // no serviría para verlo en /revision. La revisión es por Telegram.
  const videoUrl: string | null = null;
  await llamar("POST", { accion: "impreso", id: pieza.id, videoUrl });

  terminar({
    ok: true,
    estado: "video-listo",
    mp4,
    carpeta,
    caption: pieza.caption,
    disco: pieza.disco,
    artista: pieza.artista,
    hook: pieza.hook,
    fuentes: pieza.fuentes,
    videoUrl,
    siguiente: "Manda el MP4 y el caption a Telegram para aprobación. Al publicar en TikTok, añade un sonido del disco desde la biblioteca de TikTok.",
  });
}

main().catch((err) => terminar({ ok: false, error: (err as Error).message }, 1));
