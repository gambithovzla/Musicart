// Worker de generación del catálogo (Fase 2).
// Pensado para correr como cron en Railway (o a mano):
//   npm run worker -- --batch 2 --propose 5
//
// Cada corrida:
//   1. Si la cola tiene pocos pendientes, el curador IA propone más álbumes.
//   2. Toma N items por prioridad y los genera con el pipeline anti-alucinación
//      (publica solo si la verificación queda limpia; si no, queda draft).
//   3. Deja registro de todo en GenerationQueue (status, result, error).
// Si todos los intentos de la corrida fallan, sale con código 1 (alerta del cron).

import { prisma } from "../src/lib/db";
import { proposeNextAlbums, bootstrapCatalogQueue } from "../src/lib/curator";
import { runDossierPipeline } from "../src/lib/dossier/pipeline";

const MAX_ATTEMPTS = 3; // un item que falla 3 veces deja de reintentarse

function assertWorkerEnv(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    throw new Error(
      "DATABASE_URL debe ser PostgreSQL (p. ej. la URL de Railway). " +
        "Copia la URL pública (proxy.rlwy.net) en tu .env para correr el worker en local.",
    );
  }
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta OPENAI_API_KEY o ANTHROPIC_API_KEY (curador + pipeline + verificador).",
    );
  }
}

async function countPending(): Promise<number> {
  return prisma.generationQueue.count({ where: { status: "pending" } });
}

async function feedQueue(minPendientes: number, log: (msg: string) => void) {
  let pendientes = await countPending();
  if (pendientes >= minPendientes) return;

  log(`Cola baja (${pendientes} pendientes): llamando al curador…`);
  try {
    await proposeNextAlbums(minPendientes, log);
  } catch (err) {
    log(`⚠ El curador falló: ${(err as Error).message}`);
  }

  pendientes = await countPending();
  if (pendientes >= minPendientes) return;

  log(`Cola sigue baja (${pendientes}): encolando clásicos de respaldo…`);
  await bootstrapCatalogQueue(minPendientes - pendientes, log);
}

function argNum(flag: string, fallback: number): number {
  const idx = process.argv.indexOf(flag);
  const val = idx !== -1 ? Number(process.argv[idx + 1]) : NaN;
  return Number.isFinite(val) && val > 0 ? val : fallback;
}

async function main() {
  assertWorkerEnv();
  const batch = argNum("--batch", Number(process.env.WORKER_BATCH) || 2);
  const minPendientes = argNum("--propose", 5);

  console.log(`\n🎵 Musicart — worker de catálogo (batch ${batch})\n`);

  // 1. Mantener la cola alimentada.
  await feedQueue(minPendientes, (msg) => console.log(`   ${msg}`));

  // 2. Tomar el lote: pendientes primero, luego fallidos con reintentos restantes.
  const items = await prisma.generationQueue.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "failed", attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: batch,
  });

  if (items.length === 0) {
    console.log("Nada que generar: la cola está al día.\n");
    return;
  }

  let publicados = 0;
  let drafts = 0;
  let fallidos = 0;

  for (const item of items) {
    console.log(`\n▶ "${item.title}" — ${item.artist} (intento ${item.attempts + 1})`);
    await prisma.generationQueue.update({
      where: { id: item.id },
      data: { status: "running", attempts: { increment: 1 } },
    });

    try {
      const result = await runDossierPipeline(item.title, item.artist, {
        publish: true,
        log: (msg) => console.log(`   ${msg}`),
      });
      const observaciones = result.report.ok
        ? null
        : [...result.report.hardErrors, ...result.report.unsupportedClaims]
            .slice(0, 5)
            .join(" · ")
            .slice(0, 500);
      await prisma.generationQueue.update({
        where: { id: item.id },
        data: { status: "done", result: result.status, error: observaciones },
      });
      if (result.status === "published") {
        publicados++;
        console.log("   ✓ Publicado.");
      } else {
        drafts++;
        console.log("   ◦ Quedó como draft (revisar en /revision).");
      }
    } catch (err) {
      fallidos++;
      const msg = (err as Error).message.slice(0, 500);
      await prisma.generationQueue.update({
        where: { id: item.id },
        data: { status: "failed", error: msg },
      });
      console.error(`   ✗ Falló: ${msg}`);
    }
  }

  console.log(
    `\nResumen: ${publicados} publicados · ${drafts} drafts · ${fallidos} fallidos\n`,
  );

  // 3. Alerta básica: si la corrida entera falló, que el cron lo marque.
  if (fallidos === items.length) {
    console.error("⚠ Todos los items de la corrida fallaron.");
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(`\n✗ Error fatal del worker: ${(e as Error).message}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
