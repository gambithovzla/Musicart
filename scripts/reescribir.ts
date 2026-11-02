// Reescribe historias viejas con el redactor nuevo (editor → redactor → estilo).
//
// Uso:
//   npm run reescribir                       # las 5 más leídas que aún son v1
//   npm run reescribir -- --limite 30        # una tanda más grande
//   npm run reescribir -- --album <id>       # una en concreto (aunque ya sea v2)
//   npm run reescribir -- --pendientes       # solo cuenta cuántas faltan
//
// Requiere DATABASE_URL y una clave de IA (ANTHROPIC_API_KEY para la pluma).
// Nunca empeora una historia: si la nueva no pasa la verificación, se queda la vieja.

import {
  pendientesDeReescribir,
  reescribirHistoria,
} from "../src/lib/dossier/reescribir";
import { plumaModelName } from "../src/lib/dossier/llm";

function valor(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const log = (msg: string) => console.log(`   ${msg}`);

  const pendientes = await pendientesDeReescribir();
  console.log(`\nMusicart — reescritura de historias (pluma: ${plumaModelName()})`);
  console.log(`   Historias publicadas aún con el redactor viejo: ${pendientes.length}\n`);
  if (args.includes("--pendientes")) return;

  const album = valor(args, "--album");
  const ids = album ? [album] : pendientes.slice(0, Math.max(1, Number(valor(args, "--limite") ?? 5)));

  let bien = 0;
  for (const [i, id] of ids.entries()) {
    console.log(`[${i + 1}/${ids.length}] ${id}`);
    const r = await reescribirHistoria(id, { log, forzar: Boolean(album) });
    if (r.ok) {
      bien++;
      console.log(`   ✓ ${r.titulo}`);
      for (const a of r.avisos) console.log(`     · ${a}`);
    } else {
      console.log(`   · ${r.titulo}: ${r.motivo}`);
    }
  }
  console.log(`\nListo: ${bien} de ${ids.length} reescritas.\n`);
}

main()
  .catch((e) => {
    console.error(`\n✗ Error: ${(e as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
