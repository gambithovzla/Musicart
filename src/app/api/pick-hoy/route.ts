// Fabrica el disco fresco del día (Fase 6). Tarda 1-3 min (investiga, narra y
// verifica un disco nuevo), por eso vive en su propia route con maxDuration alto
// y la home lo dispara con una pantalla de carga. Siempre termina con un disco
// guardado (fresco si se puede, catálogo si no): la home se refresca y lo muestra.
//
// Con { rehacer: true } y siendo admin, borra primero el disco de hoy y lo
// vuelve a fabricar — el control "genero el disco que me dé la gana cada día".

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  generarPickDelDia,
  borrarPickDeHoy,
  albumIdPickDeHoy,
} from "@/lib/recommend";
import { todayKey } from "@/lib/daily";
import {
  DEVICE_COOKIE,
  TZ_COOKIE,
  LANG_COOKIE,
  SEEN_TODAY_COOKIE,
  parseTodayLang,
  parseSeenToday,
  buildSeenToday,
} from "@/lib/device";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const [session, jar] = await Promise.all([auth(), cookies()]);
    const deviceId = jar.get(DEVICE_COOKIE)?.value ?? "";
    const userId = session?.user?.id ?? null;
    if (!deviceId && !userId) {
      return NextResponse.json({ ok: false, reason: "sin-identidad" });
    }

    const tzRaw = jar.get(TZ_COOKIE)?.value;
    const tz = tzRaw ? decodeURIComponent(tzRaw) : null;
    const date = todayKey(tz);
    const lang = parseTodayLang(jar.get(LANG_COOKIE)?.value, date);

    // Discos ya mostrados hoy (cookie por dispositivo): al rehacer los excluimos
    // TODOS, no solo el último. Si no, rehacer cicla entre los discos del día,
    // porque los picks de hoy no entran en el historial "reciente" (date < hoy).
    const vistosHoy = parseSeenToday(jar.get(SEEN_TODAY_COOKIE)?.value, date);

    // ¿Pidieron rehacer? Solo admins: guardamos el disco actual para no repetirlo.
    // También leemos la instrucción en lenguaje natural ("rock en inglés…"), que
    // solo respetamos si quien pide es admin.
    const { rehacer, instruccion } = await leerCuerpo(req);
    const excluirAlbumIds: string[] = [...vistosHoy];
    let instruccionAdmin: string | null = null;
    if (rehacer) {
      if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ ok: false, reason: "no-admin" }, { status: 403 });
      }
      instruccionAdmin = instruccion;
      const previo = await albumIdPickDeHoy(deviceId, userId, tz);
      if (previo) excluirAlbumIds.push(previo);
      await borrarPickDeHoy(deviceId, userId, tz);
    }

    const pick = await generarPickDelDia(deviceId, userId, tz, lang, undefined, {
      excluirAlbumIds,
      instruccionAdmin,
    });

    // Recordamos lo mostrado hoy (lo previo + el nuevo) para próximos "Rehacer".
    const nuevoId = pick?.dossier.album.id;
    const seen = buildSeenToday(
      date,
      [...excluirAlbumIds, ...(nuevoId ? [nuevoId] : [])],
    );
    const res = NextResponse.json({ ok: pick !== null });
    res.cookies.set(SEEN_TODAY_COOKIE, seen, {
      path: "/",
      maxAge: 86_400,
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    console.error("[api/pick-hoy] error fabricando el disco del día:", err);
    // No reventamos: la home cae a la rotación global al refrescar.
    return NextResponse.json({ ok: false, reason: "error" });
  }
}

async function leerCuerpo(
  req: Request,
): Promise<{ rehacer: boolean; instruccion: string | null }> {
  try {
    const body = (await req.json()) as { rehacer?: boolean; instruccion?: string };
    const instruccion = body?.instruccion?.trim();
    return {
      rehacer: body?.rehacer === true,
      // Cota defensiva: el pedido del admin va a un prompt; lo recortamos.
      instruccion: instruccion ? instruccion.slice(0, 500) : null,
    };
  } catch {
    return { rehacer: false, instruccion: null }; // sin body (la home dispara sin cuerpo)
  }
}
