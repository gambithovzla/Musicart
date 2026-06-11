// Home: el ritual diario. Un disco, una historia, un viaje.
// Si el dispositivo tiene señales (perfil, diario, mood), el disco lo elige el
// motor de recomendación; si no (o si la IA falla), va la rotación global.

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getTodayPick, formatDateEs } from "@/lib/daily";
import { getPersonalizedPick } from "@/lib/recommend";
import { hasProfile } from "@/app/actions";
import { DEVICE_COOKIE, TZ_COOKIE } from "@/lib/device";
import { albumThemeStyle } from "@/lib/theme";
import { parseJson, type Palette } from "@/lib/types";
import { DailyReveal } from "@/components/DailyReveal";
import { MoodCheckin } from "@/components/MoodCheckin";

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

  const personal =
    deviceId || userId
      ? await getPersonalizedPick(deviceId, userId, tz)
      : null;
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

  const tienePerfil = await hasProfile();
  const palette = parseJson<Palette | null>(pick.album.paletteJson, null);

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
            hook: firstSentence(pick.intro),
            dateLabel: formatDateEs(tz),
            reason: personal?.reason ?? null,
            personalized: Boolean(personal),
            showProfileInvite: !tienePerfil,
            returnWelcome: personal?.returnPick ?? false,
          }}
        />
      </div>
    </main>
  );
}
