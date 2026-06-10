// Previsualiza el facts payload de un álbum SIN llamar a la IA.
// Uso:  npx tsx scripts/facts-preview.ts "Álbum" "Artista"

import { gatherAlbumFacts } from "../src/lib/dossier/facts";

async function main() {
  const [album, artist] = process.argv.slice(2).filter((a) => a !== "--");
  if (!album || !artist) {
    console.log('Uso: npx tsx scripts/facts-preview.ts "Álbum" "Artista"');
    process.exit(1);
  }

  const g = await gatherAlbumFacts(album, artist, (m) => console.log(`   ${m}`));
  const p = g.payload;

  console.log(`\n📀 ${p.album.title} — ${p.album.artist} (${p.album.year})`);
  console.log(`   Sello: ${p.album.label ?? "?"} · Duración: ${p.album.durationMin ?? "?"} min`);
  console.log(`   Portada: ${g.coverUrl ?? "no encontrada"}`);
  console.log(`   Links: ${JSON.stringify(g.links, null, 2)}`);
  console.log(`\n   Tracklist (${p.tracklist.length}):`);
  for (const t of p.tracklist) console.log(`     ${t.position}. ${t.title}`);
  console.log(`\n   Hechos (${p.facts.length}):`);
  for (const f of p.facts) console.log(`     · ${f.fact} [${f.source}]`);
  console.log(`\n   Pasajes de contexto: ${p.passages?.length ?? 0}`);
  for (const pa of p.passages ?? []) {
    console.log(`     · [${pa.source}] ${pa.text.slice(0, 120).replace(/\n/g, " ")}…`);
  }
  console.log(`\n   Fuentes:`);
  for (const s of p.sources) console.log(`     · ${s}`);
  console.log("");
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
