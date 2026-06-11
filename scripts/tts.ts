// CLI TTS (Fase 4.1): pre-renderiza MP3s del dossier y actualiza audioJson.
//
//   npm run tts -- "Abbey Road" "The Beatles"
//   npm run tts -- --id <dossierId>
//   npm run tts -- --missing          # publicados sin audio
//   npm run tts -- --missing --limit 3

import { prisma } from "../src/lib/db";
import {
  dossierAudioInputFromRow,
  findDossiersMissingAudio,
  loadDossierForTts,
  renderDossierAudio,
} from "../src/lib/dossier/render-audio";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const missing = process.argv.includes("--missing");
  const dossierId = arg("--id");
  const limit = Number(arg("--limit") ?? "5");
  const positional = process.argv
    .slice(2)
    .filter((a) => !a.startsWith("--") && a !== arg("--limit") && a !== arg("--id"));

  console.log("\n🎙️ Musicart — TTS del dossier\n");

  if (missing) {
    const pending = await findDossiersMissingAudio(Math.max(1, limit));

    if (pending.length === 0) {
      console.log("Todos los dossiers publicados ya tienen audio.\n");
      return;
    }

    for (const d of pending) {
      console.log(`▶ "${d.album.title}" — ${d.album.artist.name}`);
      await renderDossierAudio(
        d.id,
        dossierAudioInputFromRow(d),
        (msg) => console.log(msg),
      );
    }
    console.log(`\nListo: ${pending.length} dossier(s) con audio.\n`);
    return;
  }

  if (dossierId) {
    const loaded = await loadDossierForTts(dossierId);
    if (!loaded) {
      console.error(`No se encontró dossier ${dossierId}`);
      process.exit(1);
    }
    console.log(`▶ "${loaded.albumTitle}" — ${loaded.artistName}`);
    await renderDossierAudio(loaded.dossierId, loaded.input, (msg) =>
      console.log(msg),
    );
    console.log("\nAudio guardado en public/audio/ y audioJson actualizado.\n");
    return;
  }

  const [album, artist] = positional;
  if (!album || !artist) {
    console.log(`Uso:
  npm run tts -- "Álbum" "Artista"
  npm run tts -- --id <dossierId>
  npm run tts -- --missing [--limit 5]
`);
    process.exit(1);
  }

  const dossier = await prisma.dossier.findFirst({
    where: {
      locale: "es",
      album: {
        title: { contains: album, mode: "insensitive" },
        artist: { name: { contains: artist, mode: "insensitive" } },
      },
    },
    include: {
      album: { include: { artist: true } },
      trackNotes: { orderBy: { position: "asc" } },
    },
  });

  if (!dossier) {
    console.error(`No se encontró dossier para "${album}" de ${artist}.`);
    process.exit(1);
  }

  console.log(`▶ "${dossier.album.title}" — ${dossier.album.artist.name}`);
  await renderDossierAudio(
    dossier.id,
    dossierAudioInputFromRow(dossier),
    (msg) => console.log(msg),
  );
  console.log("\nAudio guardado en public/audio/ y audioJson actualizado.\n");
}

main()
  .catch((e) => {
    console.error(`\n✗ Error: ${(e as Error).message}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
