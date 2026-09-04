// Probar las tres fuentes del origen de un artista, contra las APIs de verdad.
//
//   npm run probar:origen -- "Sentimiento Muerto" "artistas venezolanos"
//   npm run probar:origen -- "Rokia Traoré" "algo de Malí"
//
// Para qué: la barrera del origen (7.9) pregunta a MusicBrainz, a Wikidata y a
// la Wikipedia, y cuando ninguna sabe se CALLA en vez de romperse. Eso está
// bien para el oyente y es fatal para diagnosticar: una fuente caída o una API
// que cambió no da error, simplemente deja de aportar. Esto lo enseña.
//
// El mismo diagnóstico vive en /revision para el dueño (que anda en el
// teléfono); esto es su versión de terminal, y no necesita ni base de datos ni
// clave de IA — las tres fuentes son datos abiertos.

import { detectarPaisesPedido, diagnosticoDeOrigen } from "../src/lib/origin-guard";

async function main() {
  const [artista, pedido] = process.argv.slice(2);
  if (!artista) {
    console.error('Uso: npm run probar:origen -- "Artista" "pedido del oyente"');
    process.exit(1);
  }

  const peticion = pedido ?? "artistas venezolanos";
  const paises = detectarPaisesPedido(peticion);
  console.log(`\nPedido: «${peticion}»`);
  if (paises.length === 0) {
    console.log("→ No nombra ningún país: la barrera ni se activa.\n");
    return;
  }
  console.log(`→ Países detectados: ${paises.map((p) => p.nombre).join(", ")}`);
  console.log(`Artista: ${artista}\n`);

  const { sondas, veredicto } = await diagnosticoDeOrigen(artista, paises);
  for (const s of sondas) {
    const marca = s.veredicto === "si" ? "✓" : s.veredicto === "no" ? "✗" : "·";
    console.log(`${marca} ${s.fuente.padEnd(12)} ${String(s.ms).padStart(5)} ms  ${s.dice}`);
  }

  console.log(
    `\nVeredicto: ${veredicto.veredicto.toUpperCase()}` +
      (veredicto.origen ? ` (${veredicto.origen}, según ${veredicto.fuente})` : "") +
      (veredicto.veredicto === "desconocido"
        ? " — no se descarta a nadie, pero al oyente se le avisa."
        : ""),
  );
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
