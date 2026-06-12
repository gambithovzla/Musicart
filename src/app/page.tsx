// Home: el ritual diario. Un disco, una historia, un viaje.
// Si el dispositivo tiene señales (perfil, diario, mood), el disco lo elige el
// motor de recomendación; si no (o si la IA falla), va la rotación global.

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getTodayPick, formatDateEs, todayKey } from "@/lib/daily";
import { getPersonalizedPick, puedeGenerarPickFresco } from "@/lib/recommend";
import { getMadriguera } from "@/lib/madriguera";
import { hasProfile } from "@/app/actions";
import { DEVICE_COOKIE, TZ_COOKIE, LANG_COOKIE, parseTodayLang } from "@/lib/device";
import { albumThemeStyle } from "@/lib/theme";
import { parseJson, type Palette } from "@/lib/types";
import { isAdminEmail } from "@/lib/admin";
import { DailyReveal } from "@/components/DailyReveal";
import { Onboarding } from "@/components/Onboarding";
import { CreandoDiscoHoy } from "@/components/CreandoDiscoHoy";
import { RehacerDiscoAdmin } from "@/components/RehacerDiscoAdmin";
import { MoodCheckin } from "@/components/MoodCheckin";
import { CuriosityCard } from "@/components/CuriosityCard";
import { LanguageGate } from "@/components/LanguageGate";
import { todayQuestion } from "@/lib/curiosities";
import type { CuriosityAnswer } from "@/lib/curiosities";
import { getListenerIdentity, findProfileRecord, reviewsWhere } from "@/lib/identity";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function firstSentence(text: string, maxLen = 160): string {
  const match = text.match(/^.+?[.!?…](\s|$)/);
  const sentence = (match?.[0] ?? text).trim();
  return sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1)}…` : sentence;
}

export default async function Home() {
  const [session, jar] = await Promise.all([auth(), cookies()]);
  const deviceId = jar.get(DEVICE_COOKIE)?.value ?? "";
  const tzRaw = jar.get(TZ_COOKIE)?.value;
  const tz = tzRaw ? decodeURIComponent(tzRaw) : null;
  const userId = session?.user?.id ?? null;
  const dateKey = todayKey(tz);

  // La entrada es el ritual de conocerte: sin perfil, NO se muestra ningún disco.
  // Vamos directo al onboarding por pasos; al terminar, la home fabrica el primero.
  const tienePerfil = await hasProfile();
  if (!tienePerfil) {
    return <Onboarding dateKey={dateKey} nombre={session?.user?.name ?? null} />;
  }

  // ¿Ya tiene el disco de hoy guardado? Lo miramos ANTES del gate de idioma:
  // si el disco ya existe, no tiene sentido volver a preguntar el idioma (sería
  // confuso y, además, el pick está cacheado y no cambiaría). El idioma solo
  // importa para generar el primero del día.
  const personal =
    deviceId || userId
      ? await getPersonalizedPick(deviceId, userId, tz)
      : null;

  if (!personal) {
    // Gate de idioma: solo antes de fabricar el disco del día (una vez al día).
    const langRaw = jar.get(LANG_COOKIE)?.value;
    const todayLang = parseTodayLang(langRaw, dateKey);
    if (deviceId && !todayLang) {
      return <LanguageGate dateKey={dateKey} />;
    }

    // Si el oyente tiene señales de gusto, fabricamos hoy un disco fresco a su
    // medida (tarda 1-3 min) con pantalla de carga; cuando termina, se refresca
    // y aparece. Sin señales (o sin IA), va la rotación global, sin esperas.
    if ((deviceId || userId) && (await puedeGenerarPickFresco(deviceId, userId))) {
      return <CreandoDiscoHoy />;
    }
  }

  const pick = personal?.dossier ?? (await getTodayPick(tz));

  if (!pick) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="font-serif text-3xl">Musicart</h1>
        <p className="text-dim">
          Aún no hay álbumes en el catálogo. Corre{" "}
          <code className="rounded bg-surface px-2 py-1 text-sm">npm run db:seed</code>{" "}
          para cargar los discos de demostración.
        </p>
      </main>
    );
  }

  const [madriguera, identity] = await Promise.all([
    getMadriguera(pick.album.id),
    getListenerIdentity(),
  ]);

  // Pregunta del día: fallback estático; el CuriosityCard carga la IA en background.
  let initialCuriosityQuestion: ReturnType<typeof todayQuestion> = null;
  if (tienePerfil) {
    const profile = await findProfileRecord(identity);
    const prev = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : {};

    // Si ya hay una pregunta generada para hoy, usarla de inmediato.
    const cached = prev.todayCuriosity as
      | { date: string; id: string; text: string; options: string[] }
      | undefined;
    if (cached?.date === dateKey && cached.text) {
      initialCuriosityQuestion = { id: cached.id, text: cached.text, options: cached.options };
    } else {
      // Fallback estático mientras el CuriosityCard genera la IA en background.
      const answered = new Set<string>(
        (Array.isArray(prev.curiosities) ? (prev.curiosities as CuriosityAnswer[]) : [])
          .filter((a) => a.date === dateKey)
          .map((a) => a.id),
      );
      initialCuriosityQuestion = todayQuestion(answered, dateKey);
    }
  }

  const palette = parseJson<Palette | null>(pick.album.paletteJson, null);

  const reviewFilter = reviewsWhere(identity);
  const yaResenoHoy =
    reviewFilter &&
    (await prisma.review.findFirst({
      where: { ...reviewFilter, albumId: pick.album.id },
      select: { id: true },
    }));
  const wowFacts = parseJson<string[]>(pick.wowFactsJson ?? "[]", []);
  const wowHook = yaResenoHoy && wowFacts.length > 0 ? wowFacts[0] : null;

  return (
    <main style={albumThemeStyle(palette)}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[45dvh]"
        style={{
          background:
            "linear-gradient(to bottom, var(--album-dark) 0%, transparent 100%)",
          opacity: 0.55,
        }}
      />
      <div className="relative">
        {isAdminEmail(session?.user?.email) && <RehacerDiscoAdmin />}
        <MoodCheckin
          mood={personal?.mood ?? null}
          canChange={!personal?.regenerated}
        />
        <DailyReveal
          album={{
            albumId: pick.album.id,
            title: pick.album.title,
            artist: pick.album.artist.name,
            year: pick.album.year,
            coverUrl: pick.album.coverUrl,
            durationMin: pick.album.durationMin,
            difficulty: pick.album.difficulty,
            impact: pick.album.impact,
            impactNote: pick.impactNote,
            hook: firstSentence(pick.intro),
            dateLabel: formatDateEs(tz),
            reason: personal?.reason ?? null,
            personalized: Boolean(personal),
            showProfileInvite: !tienePerfil,
            returnWelcome: personal?.returnPick ?? false,
            madriguera,
            wowHook,
          }}
        />
        {initialCuriosityQuestion && (
          <CuriosityCard
            initialQuestion={initialCuriosityQuestion}
            dateKey={dateKey}
          />
        )}
      </div>
    </main>
  );
}
