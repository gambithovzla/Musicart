// Orquestador del pipeline: hechos → generación → verificación → guardado.
// Cada álbum se procesa UNA vez y queda cacheado en DB para todos los usuarios.

import { prisma } from "../db";
import { gatherAlbumFacts } from "./facts";
import { generateDossier, type GeneratedDossier } from "./generate";
import { verifyDossier, type VerificationReport } from "./verify";
import { extractPalette } from "../palette";
import { enqueueAlbum } from "../curator";

export type PipelineResult = {
  albumId: string;
  dossierId: string;
  status: "draft" | "published";
  report: VerificationReport;
};

export async function runDossierPipeline(
  albumQuery: string,
  artistQuery: string,
  options: { publish?: boolean; log?: (msg: string) => void } = {},
): Promise<PipelineResult> {
  const log = options.log ?? (() => {});

  // 1. Hechos verificados de las fuentes.
  const gathered = await gatherAlbumFacts(albumQuery, artistQuery, log);
  const { payload } = gathered;

  // ¿Ya existe? El cache es permanente.
  const existing = await prisma.album.findFirst({
    where: { mbid: gathered.mbid ?? undefined },
    include: { dossiers: true },
  });
  if (existing?.dossiers.some((d) => d.locale === "es")) {
    log(`"${payload.album.title}" ya tiene dossier — no se regenera.`);
    const dossier = existing.dossiers.find((d) => d.locale === "es")!;
    return {
      albumId: existing.id,
      dossierId: dossier.id,
      status: dossier.status as "draft" | "published",
      report: { ok: true, hardErrors: [], unsupportedClaims: [] },
    };
  }

  // 2. Generar narrativa (con un reintento si la verificación encuentra inventos).
  log("Generando dossier con IA…");
  let dossier: GeneratedDossier = await generateDossier(payload);
  log("Verificando afirmaciones contra los hechos…");
  let report = await verifyDossier(dossier, payload);

  if (!report.ok) {
    const feedback = [...report.hardErrors, ...report.unsupportedClaims].join("\n- ");
    log(`Verificación encontró ${report.hardErrors.length + report.unsupportedClaims.length} problemas. Regenerando…`);
    dossier = await generateDossier(payload, `- ${feedback}`);
    report = await verifyDossier(dossier, payload);
  }

  // 3. Paleta de la portada.
  const palette = gathered.coverUrl
    ? await extractPalette(gathered.coverUrl)
    : null;

  // 4. Guardar. Solo se publica si la verificación quedó limpia (o lo fuerza el flag).
  const status: "draft" | "published" =
    options.publish && report.ok ? "published" : "draft";

  const artist = await prisma.artist.upsert({
    where: { mbid: gathered.artistMbid ?? `name:${payload.album.artist}` },
    update: { name: payload.album.artist },
    create: {
      mbid: gathered.artistMbid ?? `name:${payload.album.artist}`,
      name: payload.album.artist,
    },
  });

  const album = existing
    ? await prisma.album.update({
        where: { id: existing.id },
        data: { factsJson: JSON.stringify(payload) },
      })
    : await prisma.album.create({
        data: {
          mbid: gathered.mbid,
          title: payload.album.title,
          year: payload.album.year,
          coverUrl: gathered.coverUrl,
          durationMin: payload.album.durationMin,
          difficulty: dossier.difficulty,
          impact: dossier.impact,
          linksJson: JSON.stringify(gathered.links),
          paletteJson: palette ? JSON.stringify(palette) : null,
          factsJson: JSON.stringify(payload),
          artistId: artist.id,
        },
      });

  const saved = await prisma.dossier.create({
    data: {
      albumId: album.id,
      locale: "es",
      status,
      intro: dossier.intro,
      artistStory: dossier.artistStory,
      whyItMatters: dossier.whyItMatters,
      questionsJson: JSON.stringify(dossier.questions),
      jumpsJson: JSON.stringify(dossier.jumps ?? []),
      trackNotes: {
        create: payload.tracklist.map((t) => {
          const note = dossier.trackNotes.find((n) => n.position === t.position);
          return {
            position: t.position,
            title: t.title,
            note: note?.note ?? null,
          };
        }),
      },
    },
  });

  // 5. Los saltos de un dossier publicado alimentan la cola de generación:
  //    así la madriguera se excava sola. Si falla, no tumba el pipeline.
  if (status === "published") {
    for (const jump of dossier.jumps ?? []) {
      try {
        const encolado = await enqueueAlbum({
          title: jump.title,
          artist: jump.artist,
          source: "jump",
          reason: `Salto desde "${payload.album.title}": ${jump.connection}`,
          priority: 60,
        });
        if (encolado) log(`Salto encolado: "${jump.title}" de ${jump.artist}`);
      } catch (err) {
        log(`No se pudo encolar el salto "${jump.title}": ${(err as Error).message}`);
      }
    }
  }

  return { albumId: album.id, dossierId: saved.id, status, report };
}
