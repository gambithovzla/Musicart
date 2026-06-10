// CLI del pipeline de dossiers.
// Uso:  npm run dossier -- "Continuum" "John Mayer" [--publish]

import { runDossierPipeline } from "../src/lib/dossier/pipeline";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const publish = args.includes("--publish");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [album, artist] = positional;

  if (!album || !artist) {
    console.log('Uso: npm run dossier -- "Nombre del Álbum" "Artista" [--publish]');
    process.exit(1);
  }

  console.log(`\n🎵 Musicart — pipeline de dossier\n   ${album} — ${artist}\n`);

  const result = await runDossierPipeline(album, artist, {
    publish,
    log: (msg) => console.log(`   ${msg}`),
  });

  console.log(`\n   Estado: ${result.status === "published" ? "✓ PUBLICADO" : "borrador (draft)"}`);
  if (result.report.ok) {
    console.log("   Verificación: limpia — cero afirmaciones sin respaldo.");
  } else {
    console.log("   ⚠ Verificación con observaciones (guardado como draft):");
    for (const e of result.report.hardErrors) console.log(`     · [duro] ${e}`);
    for (const c of result.report.unsupportedClaims) console.log(`     · [claim] ${c}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(`\n✗ Error: ${(e as Error).message}\n`);
  process.exit(1);
});
