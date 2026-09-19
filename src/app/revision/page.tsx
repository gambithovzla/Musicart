// Panel de revisión (Fase 2.3): drafts, cola y TTS. Solo admins (ADMIN_EMAILS).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getProductMetrics } from "@/lib/analytics";
import { todayKey } from "@/lib/daily";
import { generacionesHoy, dailyGenerationBudget, estadoPresupuesto } from "@/lib/budget";
import { dossierHasAudio } from "@/lib/dossier/render-audio";
import { publishDossier, discardDossier } from "./actions";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { TtsControls } from "./TtsControls";
import { GenerarDiscoForm } from "./GenerarDiscoForm";
import { RecalcularImpactos } from "./RecalcularImpactos";
import { BuscarYCrear } from "./BuscarYCrear";
import { CuradorAlbumes, type AlbumCurable } from "./CuradorAlbumes";
import { ClubDeLosCien } from "./ClubDeLosCien";
import { LevantarSalon } from "@/components/LevantarSalon";
import { EstadoCurador } from "./EstadoCurador";
import { EstadoOrigen } from "./EstadoOrigen";
import { getCanonCurado, estadoDelSalon } from "@/lib/canon/consulta";
import { parseJson } from "@/lib/types";
import type { SocialVerification } from "@/lib/social/types";
import { SocialStudio, type SocialContentRow, type SocialDossierOption } from "./SocialStudio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata = { title: "Revisión · Musicart" };

export default async function RevisionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/entrar?next=/revision");
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-3 px-8 text-center">
        <h1 className="font-serif text-2xl">Revisión</h1>
        <p className="text-sm text-dim">
          Esta sección es solo para administradores. Entraste como{" "}
          <span className="text-foreground/80">{session.user.email}</span>.
        </p>
        <Link href="/perfil" className="text-sm text-album underline underline-offset-2">
          Volver al perfil
        </Link>
      </main>
    );
  }

  const [canonCurado, estadoSalon, metrics, drafts, cola, publicados, socialContents] = await Promise.all([
    getCanonCurado(),
    estadoDelSalon(),
    getProductMetrics(),
    prisma.dossier.findMany({
      where: { status: "draft", locale: "es" },
      include: { album: { include: { artist: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.generationQueue.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.dossier.findMany({
      where: { status: "published", locale: "es" },
      include: { album: { include: { artist: true } } },
      orderBy: { album: { title: "asc" } },
    }),
    prisma.socialContent.findMany({
      where: { status: { not: "archived" } },
      include: { dossier: { include: { album: { include: { artist: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const generadosHoy = await generacionesHoy(todayKey());
  const topeDiario = dailyGenerationBudget();
  const cupo = await estadoPresupuesto(todayKey());

  // Lista de curaduría: un disco por álbum publicado, con el puntaje del curador
  // y si está en la vitrina. Deduplicamos por álbum (puede haber >1 dossier).
  const adminUserId = session.user.id;
  const vistosAlbum = new Set<string>();
  const albumesUnicos = publicados.filter((d) => {
    if (vistosAlbum.has(d.albumId)) return false;
    vistosAlbum.add(d.albumId);
    return true;
  });
  const misReviews = adminUserId
    ? await prisma.review.findMany({
        where: { userId: adminUserId, albumId: { in: albumesUnicos.map((d) => d.albumId) } },
        select: { albumId: true, rating: true },
      })
    : [];
  const ratingPorAlbum = new Map(misReviews.map((r) => [r.albumId, r.rating]));
  const curables: AlbumCurable[] = albumesUnicos.map((d) => ({
    albumId: d.albumId,
    title: d.album.title,
    artist: d.album.artist.name,
    year: d.album.year,
    coverUrl: d.album.coverUrl,
    showcase: d.album.showcase,
    rating: ratingPorAlbum.get(d.albumId) ?? null,
    shelf: d.album.showcaseShelf?.trim() || null,
  }));
  const enVitrina = curables.filter((a) => a.showcase).length;
  const estantesExistentes = [
    ...new Set(
      curables
        .map((a) => a.shelf)
        .filter((s): s is string => !!s),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const ttsRows = publicados.map((d) => ({
    id: d.id,
    albumId: d.albumId,
    title: d.album.title,
    artist: d.album.artist.name,
    hasAudio: dossierHasAudio(d.audioJson),
  }));
  const missingTts = ttsRows.filter((d) => !d.hasAudio).length;
  const socialDossiers: SocialDossierOption[] = publicados.map((d) => ({
    id: d.id,
    title: d.album.title,
    artist: d.album.artist.name,
    year: d.album.year,
  }));
  const socialRows: SocialContentRow[] = socialContents.map((content) => {
    const verification = parseJson<SocialVerification | null>(content.verificationJson, null);
    return {
      id: content.id,
      title: content.dossier.album.title,
      artist: content.dossier.album.artist.name,
      hook: content.hook,
      script: content.script,
      caption: content.caption,
      status: content.status,
      rightsStatus: content.rightsStatus,
      videoUrl: content.videoUrl,
      error: content.error,
      verificationOk: Boolean(verification?.ok),
      verificationNotes: [...(verification?.hardErrors ?? []), ...(verification?.unsupportedClaims ?? [])],
      createdAt: content.createdAt.toLocaleDateString("es-PE"),
    };
  });

  return (
    <main className="px-6 pb-16 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Admin</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">Revisión</h1>
        <p className="mt-1 text-sm text-dim">{session.user.email}</p>
      </header>

      <AnalyticsPanel metrics={metrics} />

      <section className="mt-12">
        <p className="rotulo text-album">Trabajador social · edición I</p>
        <h2 className="font-serif mt-2 text-2xl">La mesa de video</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dim">
          Convierte un dossier verificado en un guion vertical, revisa sus recibos y apruébalo antes de que el worker genere la voz y el MP4.
        </p>
        <SocialStudio dossiers={socialDossiers} contents={socialRows} />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl">Buscar y crear</h2>
        <p className="mt-1 text-sm text-dim">
          Busca un disco o artista, tócalo y la IA fabrica su dossier completo
          —historia, anécdotas, notas canción por canción, verificado. Luego
          puntúalo y ponlo en tu vitrina.
        </p>
        <BuscarYCrear />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl">Crear un disco</h2>
        <p className="mt-1 text-sm text-dim">
          Toca el botón y la IA elige y crea un disco nuevo para el catálogo —las
          veces que quieras, cuando quieras. El robot diario sigue funcionando aparte.
        </p>
        <p className="mt-3 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm text-dim">
          Tope de gasto · discos nuevos fabricados a oyentes hoy:{" "}
          <span
            className={
              generadosHoy >= topeDiario ? "text-red-300" : "text-album-light"
            }
          >
            {generadosHoy}/{topeDiario}
          </span>
          {generadosHoy >= topeDiario && (
            <span className="text-red-300/90">
              {" "}
              — tope alcanzado: hoy los oyentes reciben discos del catálogo
              (sin costo de IA nueva).
            </span>
          )}
          <span className="block text-xs text-dim/70">
            Lo que creas aquí y el robot del catálogo no cuentan en este tope. Se
            ajusta con la variable DAILY_GENERATION_BUDGET.
          </span>
        </p>
        <EstadoCurador
          usados={cupo.usados}
          tope={cupo.tope}
          quedanExtra={cupo.quedanExtra}
        />
        <EstadoOrigen />
        <GenerarDiscoForm />
        <RecalcularImpactos />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl">
          Drafts pendientes{" "}
          <span className="text-base text-dim">({drafts.length})</span>
        </h2>
        <p className="mt-1 text-sm text-dim">
          No pasaron la verificación automática. Léelos y decide.
        </p>
        {drafts.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface p-5 text-sm text-dim">
            Nada pendiente — todo lo generado pasó la verificación. ✓
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-white/10 bg-surface p-5"
              >
                <p className="font-medium">
                  {d.album.title}{" "}
                  <span className="font-normal text-dim">
                    · {d.album.artist.name} · {d.album.year}
                  </span>
                </p>
                <p className="font-serif mt-2 line-clamp-3 text-sm italic leading-relaxed text-foreground/80">
                  {d.intro}
                </p>
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <Link
                    href={`/album/${d.albumId}`}
                    className="rounded-full border border-white/15 px-4 py-2 text-foreground/80"
                  >
                    Leer completo
                  </Link>
                  <form action={publishDossier.bind(null, d.id)}>
                    <button className="rounded-full bg-album px-4 py-2 font-semibold text-black">
                      Publicar
                    </button>
                  </form>
                  <form action={discardDossier.bind(null, d.id)}>
                    <button className="rounded-full border border-red-400/40 px-4 py-2 text-red-300">
                      Descartar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl">
          El club de los 100{" "}
          <span className="text-base text-dim">
            ({canonCurado.total} discos en el índice)
          </span>
        </h2>
        <p className="mt-1 text-sm text-dim">
          La cima del{" "}
          <Link href="/salon" className="text-album underline underline-offset-2">
            Salón de la Fama
          </Link>
          . La fórmula ordena mil discos bien, pero arriba manda tu criterio:
          fija a mano los que para ti son un 100 y la ingesta dejará de tocarlos.
        </p>
        <div className="mt-5">
          <LevantarSalon
            total={canonCurado.total}
            sinPuntaje={estadoSalon.sinPuntaje}
          />
        </div>
        <ClubDeLosCien
          fijados={canonCurado.fijados}
          candidatos={canonCurado.candidatos}
          total={canonCurado.total}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl">
          Tu vitrina{" "}
          <span className="text-base text-dim">({enVitrina} en exhibición)</span>
        </h2>
        <p className="mt-1 text-sm text-dim">
          Puntúa tus discos y elige cuáles se exhiben en{" "}
          <Link href="/vitrina" className="text-album underline underline-offset-2">
            la vitrina pública
          </Link>
          . Marca ★ los que atesoras.
        </p>
        {curables.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface p-5 text-sm text-dim">
            Aún no hay discos publicados para curar. Crea uno arriba.
          </p>
        ) : (
          <CuradorAlbumes albums={curables} estantes={estantesExistentes} />
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl">
          Audio podcast{" "}
          <span className="text-base text-dim">
            ({ttsRows.filter((d) => d.hasAudio).length}/{ttsRows.length} con audio)
          </span>
        </h2>
        <p className="mt-1 text-sm text-dim">
          Genera la voz narrada de cada dossier publicado.
        </p>
        <TtsControls dossiers={ttsRows} missingCount={missingTts} />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl">
          Cola de generación{" "}
          <span className="text-base text-dim">(últimos {cola.length})</span>
        </h2>
        {cola.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface p-5 text-sm text-dim">
            La cola está vacía. El worker la llenará en su próxima corrida (o
            corre <code>npm run worker</code>).
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {cola.map((q) => (
              <li
                key={q.id}
                className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">
                    “{q.title}” · {q.artist}
                  </span>
                  <EstadoBadge status={q.status} result={q.result} />
                </div>
                {q.reason && (
                  <p className="mt-1 text-xs italic text-dim">{q.reason}</p>
                )}
                {q.error && (
                  <p className="mt-1 break-words text-xs text-red-300/90">
                    {q.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EstadoBadge({ status, result }: { status: string; result: string | null }) {
  const etiqueta =
    status === "done"
      ? result === "published"
        ? "✓ publicado"
        : "◦ draft"
      : status === "failed"
        ? "✗ falló"
        : status === "running"
          ? "… generando"
          : "pendiente";
  const color =
    status === "done" && result === "published"
      ? "text-album-light"
      : status === "failed"
        ? "text-red-300"
        : "text-dim";
  return <span className={`shrink-0 text-xs ${color}`}>{etiqueta}</span>;
}
