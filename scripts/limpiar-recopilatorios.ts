// Limpieza de recopilatorios viejos del catálogo (Fase 7).
//
// Los discos tipo "Grandes Éxitos", "Lo Esencial", "Obras Cumbres", antologías o
// discos en vivo son los que peor se encuentran en streaming. La regla 3 de
// `discover.ts` ya evita proponerlos en los discos NUEVOS; este script limpia los
// que ya quedaron PUBLICADOS en el catálogo (rotación / fallback).
//
// Seguro y reversible: NO borra nada. Saca el disco de rotación pasando su
// dossier a `draft` (solo `published` entra en la experiencia). Si te equivocas,
// vuelves a publicarlo desde /revision.
//
// Uso:
//   npm run db:limpiar-recopilatorios            (solo LISTA lo que encontró)
//   npm run db:limpiar-recopilatorios -- --aplicar   (los pasa a draft)

import { prisma } from "../src/lib/db";

// Quita acentos y baja a minúsculas para comparar sin tropezar con tildes.
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Pistas en el TÍTULO de que es un recopilatorio / grandes éxitos / en vivo.
// Se evalúan sobre el título normalizado (sin acentos, en minúsculas).
const PATRONES: { etiqueta: string; re: RegExp }[] = [
  { etiqueta: "grandes éxitos", re: /\bgrandes exitos\b/ },
  { etiqueta: "lo esencial / esenciales", re: /\b(lo esencial|esencial(es)?)\b/ },
  { etiqueta: "lo mejor de", re: /\blo mejor\b/ },
  { etiqueta: "obras cumbres", re: /\bobras cumbres\b/ },
  { etiqueta: "antología", re: /\bantologia\b/ },
  { etiqueta: "colección / collection", re: /\b(coleccion|collection)\b/ },
  { etiqueta: "greatest hits", re: /\bgreatest hits\b/ },
  { etiqueta: "best of / the best", re: /\b(best of|the best|very best)\b/ },
  { etiqueta: "the essential / essentials", re: /\bessential(s)?\b/ },
  { etiqueta: "anthology", re: /\banthology\b/ },
  { etiqueta: "singles collection", re: /\bsingles\b/ },
  { etiqueta: "unplugged", re: /\bunplugged\b/ },
  { etiqueta: "en vivo / live / concierto", re: /\b(en vivo|en directo|live|in concert|concierto)\b/ },
  { etiqueta: "éxitos / hits", re: /\b(exitos|hits)\b/ },
  { etiqueta: "recopilación / compilation", re: /\b(recopila|compila)/ },
  { etiqueta: "serie de oro / definitive / platinum", re: /\b(serie de oro|definitive|platinum)\b/ },
];

function detectar(titulo: string): string | null {
  const t = normalizar(titulo);
  for (const p of PATRONES) {
    if (p.re.test(t)) return p.etiqueta;
  }
  return null;
}

async function main() {
  const aplicar = process.argv.slice(2).includes("--aplicar");

  console.log("\n🧹 Musicart — limpieza de recopilatorios del catálogo\n");

  const publicados = await prisma.dossier.findMany({
    where: { status: "published" },
    include: { album: { include: { artist: true } } },
  });

  const sospechosos = publicados
    .map((d) => ({ dossier: d, motivo: detectar(d.album.title) }))
    .filter((x): x is { dossier: (typeof publicados)[number]; motivo: string } => x.motivo !== null);

  if (sospechosos.length === 0) {
    console.log("   ✓ No encontré recopilatorios publicados. El catálogo está limpio.\n");
    return;
  }

  console.log(`   Encontré ${sospechosos.length} disco(s) que parecen recopilatorios:\n`);
  for (const { dossier, motivo } of sospechosos) {
    console.log(
      `   · "${dossier.album.title}" — ${dossier.album.artist.name} (${dossier.album.year})  [${motivo}]`,
    );
  }

  if (!aplicar) {
    console.log(
      "\n   Esto fue solo una vista previa (no cambié nada).",
    );
    console.log(
      "   Para sacarlos de rotación (pasarlos a borrador), corre:\n" +
        "      npm run db:limpiar-recopilatorios -- --aplicar\n" +
        "   Es reversible: podrás re-publicarlos desde /revision si hace falta.\n",
    );
    return;
  }

  const ids = sospechosos.map((s) => s.dossier.id);
  const res = await prisma.dossier.updateMany({
    where: { id: { in: ids } },
    data: { status: "draft" },
  });

  console.log(
    `\n   ✓ Listo: ${res.count} disco(s) salieron de rotación (ahora son borradores).`,
  );
  console.log(
    "   Ya no aparecerán en la experiencia. Quedan en /revision por si quieres revisarlos.\n",
  );
}

main()
  .catch((err) => {
    console.error("Error en la limpieza:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
