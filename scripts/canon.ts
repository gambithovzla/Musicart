// Constructor del índice del canon (Fase 9 — el Salón de la Fama).
//
//   npm run canon                      # índice completo (~1000 discos) + portadas
//   npm run canon -- --limite 300      # más corto, para probar
//   npm run canon -- --portadas 200    # solo rellenar carátulas pendientes
//   npm run canon -- --recalibrar      # solo recalcular puntajes (sin red)
//
// Corre FUERA de Vercel (en local o en Railway, como el worker del catálogo):
// tarda minutos y habla con Wikidata, Last.fm y Deezer. No necesita clave de
// IA — aquí no interviene ningún LLM, a propósito.

import { prisma } from "../src/lib/db";
import { construirIndice, recalibrar, rellenarPortadas } from "../src/lib/canon/ingest";

function assertEnv(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    throw new Error(
      "DATABASE_URL debe ser PostgreSQL (la URL de Railway). Copia la URL pública " +
        "(proxy.rlwy.net) en tu .env para correr esto en local.",
    );
  }
}

function argNum(flag: string, fallback: number): number {
  const idx = process.argv.indexOf(flag);
  const val = idx !== -1 ? Number(process.argv[idx + 1]) : NaN;
  return Number.isFinite(val) && val > 0 ? val : fallback;
}

function tieneFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  assertEnv();
  const log = (msg: string) => console.log(`   ${msg}`);

  console.log("\n🏛  Musicart — índice del canon (Salón de la Fama)\n");

  if (tieneFlag("--recalibrar")) {
    await recalibrar(log);
    return;
  }

  if (tieneFlag("--portadas")) {
    await rellenarPortadas(argNum("--portadas", 200), log);
    return;
  }

  const resumen = await construirIndice({
    limite: argNum("--limite", 1000),
    minSitelinks: argNum("--min-sitelinks", 15),
    conOyentes: !tieneFlag("--sin-oyentes"),
    log,
  });

  console.log(
    `\n   ${resumen.candidatos} candidatos · ${resumen.nuevos} nuevos · ` +
      `${resumen.actualizados} actualizados · ${resumen.conPremios} con premios`,
  );

  // Las portadas van después y con tope: son otras mil peticiones.
  await rellenarPortadas(argNum("--portadas-max", 300), log);

  const cien = await prisma.canonAlbum.count({ where: { score: 100 } });
  const noventaycinco = await prisma.canonAlbum.count({ where: { score: { gte: 95 } } });
  const total = await prisma.canonAlbum.count();
  console.log(
    `\n✅ Índice listo: ${total} discos · ${cien} en el club de los 100 · ` +
      `${noventaycinco} de 95 para arriba\n`,
  );
}

main()
  .catch((err) => {
    console.error(`\n❌ ${(err as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
