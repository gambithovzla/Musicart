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
  parseTodayLang,
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
    const lang = parseTodayLang(jar.get(LANG_COOKIE)?.value, todayKey(tz));

    // ¿Pidieron rehacer? Solo admins: guardamos el disco actual para no repetirlo.
    const rehacer = await pidieronRehacer(req);
    let excluirAlbumIds: string[] = [];
    if (rehacer) {
      if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ ok: false, reason: "no-admin" }, { status: 403 });
      }
      const previo = await albumIdPickDeHoy(deviceId, userId, tz);
      if (previo) excluirAlbumIds = [previo];
      await borrarPickDeHoy(deviceId, userId, tz);
    }

    const pick = await generarPickDelDia(deviceId, userId, tz, lang, undefined, {
      excluirAlbumIds,
    });
    return NextResponse.json({ ok: pick !== null });
  } catch (err) {
    console.error("[api/pick-hoy] error fabricando el disco del día:", err);
    // No reventamos: la home cae a la rotación global al refrescar.
    return NextResponse.json({ ok: false, reason: "error" });
  }
}

async function pidieronRehacer(req: Request): Promise<boolean> {
  try {
    const body = (await req.json()) as { rehacer?: boolean };
    return body?.rehacer === true;
  } catch {
    return false; // sin body (la home dispara sin cuerpo)
  }
}
