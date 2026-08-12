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
  PEDIDO_COOKIE,
  SEEN_TODAY_COOKIE,
  parseTodayLang,
  parseTodayPedido,
  parseSeenToday,
  buildSeenToday,
} from "@/lib/device";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cuántos discos distintos puede fabricarse un oyente por día con "dame otro"
// (el original + sus reemplazos). Tope para no disparar el costo de IA; el
// admin con "Rehacer" no tiene este límite. El tope de gasto global (6.6) sigue
// aplicando por encima de esto.
const MAX_DISCOS_POR_DIA = 4;

// Tiempo que le damos a la fabricación, con margen contra el techo de la
// función (300 s). Que nos corten a mitad NO es un final aceptable: el disco de
// hoy se borró antes de empezar y no queda nada guardado, así que la home
// reintenta por su cuenta —sin el pedido del oyente— y le sirve otra cosa. Con
// presupuesto, el motor se rinde a tiempo y siempre deja un disco puesto.
const PRESUPUESTO_MS = 240_000;

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

    // Lo que el oyente pidió escuchar hoy desde el gate del día (texto libre o
    // un género). Lo respetamos en la fabricación normal, para CUALQUIER oyente.
    const pedidoDelDia = parseTodayPedido(jar.get(PEDIDO_COOKIE)?.value, date);

    // ¿Pidieron rehacer? Solo admins: guardamos el disco actual para no repetirlo.
    // También leemos la instrucción en lenguaje natural ("rock en inglés…") del
    // cuadro de admin, que solo respetamos en el rehacer si quien pide es admin.
    // rehacer  → control solo-admin (con instrucción libre, sin límite).
    // otro      → "no lo encontré / dame otro" de cualquier oyente, con tope diario.
    const { rehacer, otro, instruccion } = await leerCuerpo(req);
    const excluirAlbumIds: string[] = [...vistosHoy];
    // Por defecto manda el pedido del día (del gate); al rehacer lo reemplaza la
    // instrucción que el admin escribió en su cuadro.
    let peticion: string | null = pedidoDelDia;

    if (rehacer && !isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ ok: false, reason: "no-admin" }, { status: 403 });
    }

    // El oyente no admin que pide "otro" tiene un tope diario de discos fabricados.
    if (otro && !rehacer && vistosHoy.length >= MAX_DISCOS_POR_DIA) {
      return NextResponse.json({ ok: false, reason: "limite" });
    }

    if (rehacer || otro) {
      // El admin puede dirigir el rehacer con texto libre; el "otro" del oyente
      // conserva el pedido del día (no inyecta instrucción).
      if (rehacer) peticion = instruccion ?? pedidoDelDia;
      const previo = await albumIdPickDeHoy(deviceId, userId, tz);
      if (previo) excluirAlbumIds.push(previo);
      await borrarPickDeHoy(deviceId, userId, tz);
    }

    const pick = await generarPickDelDia(deviceId, userId, tz, lang, undefined, {
      excluirAlbumIds,
      peticion,
      // El admin/dueño no respeta el tope diario: para él la app siempre fabrica
      // fresco, nunca le repite un disco del catálogo por haberse agotado el tope.
      omitirPresupuesto: isAdminEmail(session?.user?.email),
      // Ojo, son dos "presupuestos" distintos: el de arriba es de DINERO (cuántos
      // discos nuevos se fabrican hoy) y este es de TIEMPO (cuánto puede tardar
      // esta llamada antes de que la plataforma la corte).
      presupuestoMs: PRESUPUESTO_MS,
    });

    // Recordamos lo mostrado hoy (lo previo + el nuevo) para próximos "Rehacer".
    const nuevoId = pick?.dossier.album.id;
    const seen = buildSeenToday(
      date,
      [...excluirAlbumIds, ...(nuevoId ? [nuevoId] : [])],
    );
    // El aviso viaja de vuelta para que quien acaba de pedir algo se entere en
    // el acto de que no se pudo cumplir, sin tener que bajar a leer la razón.
    const res = NextResponse.json({
      ok: pick !== null,
      avisoPedido: pick?.avisoPedido ?? null,
    });
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
): Promise<{ rehacer: boolean; otro: boolean; instruccion: string | null }> {
  try {
    const body = (await req.json()) as {
      rehacer?: boolean;
      otro?: boolean;
      instruccion?: string;
    };
    const instruccion = body?.instruccion?.trim();
    return {
      rehacer: body?.rehacer === true,
      otro: body?.otro === true,
      // Cota defensiva: el pedido del admin va a un prompt; lo recortamos.
      instruccion: instruccion ? instruccion.slice(0, 500) : null,
    };
  } catch {
    // sin body (la home dispara la fabricación normal sin cuerpo)
    return { rehacer: false, otro: false, instruccion: null };
  }
}
