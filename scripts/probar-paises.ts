// Comprobar la tabla de países y cómo se lee (Fase 11). NO toca la red.
//
//   npm run probar:paises
//
// Por qué existe: la tabla pasó de 54 países a 192, y dos cosas se rompen solas
// cuando crece. Una, los gentilicios cortos: con sufijo libre, "mali" casaba
// con "malísimo" y el oyente pedía discos de Malí sin saberlo. Otra, las
// colisiones entre idiomas: "Dominican" es de dos países y "Congolese" de dos
// más. Esto las caza en un segundo, sin base de datos y sin IA.

import { paisesEnFrase, detectarPaisesPedido } from "../src/lib/origin-guard";
import { PAISES, REGIONES } from "../src/lib/paises";

const FRASES: [string, "es" | "en", string[]][] = [
  ["Sentimiento Muerto fue una banda venezolana de rock formada en Caracas.", "es", ["VE"]],
  ["Rokia Traoré es una cantante y compositora maliense.", "es", ["ML"]],
  ["Cesária Évora fue una cantante caboverdiana de morna.", "es", ["CV"]],
  ["Tinariwen is a group of Tuareg musicians from Mali.", "en", ["ML"]],
  ["Youssou N'Dour is a singer from Senegal.", "en", ["SN"]],
  ["Fela Kuti was a Nigerian musician and political activist.", "en", ["NG"]],
  ["Mulatu Astatke is an Ethiopian musician, father of Ethio-jazz.", "en", ["ET"]],
  ["Green Day is an American rock band from California.", "en", ["US"]],
  ["Ladysmith Black Mambazo is a South African choral group.", "en", ["ZA"]],
  // Trampas: nombres de persona y de sitio que se llaman como un país.
  ["Chad Smith is an American drummer.", "en", ["US"]],
  ["Little Richard was born in Macon, Georgia.", "en", []],
  ["Bomba Estéreo is a Latin American band.", "en", []],
  // Ambiguas a propósito: quien llama no concluye nada con dos países.
  ["Papa Wemba was a Congolese rumba singer.", "en", ["CD", "CG"]],
  ["Juan Luis Guerra is a Dominican singer-songwriter.", "en", ["DO", "DM"]],
  ["Es una banda venezolana que canta en inglés y vive en México.", "es", ["VE", "MX"]],
];

const PEDIDOS: [string, string[]][] = [
  ["quiero rock venezolano", ["VE"]],
  ["algo de Cabo Verde", ["CV"]],
  ["artistas malienses", ["ML"]],
  ["música etíope de los 70", ["ET"]],
  ["algo de Senegal o de Malí", ["SN", "ML"]],
  // Ni gentilicio ni país: la barrera no se activa.
  ["ponme algo que no sea malísimo", []],
  ["quiero algo cantado en inglés", []],
  ["flamenco de Granada", []],
  ["rock indie de los 2000", []],
];

let fallos = 0;

function comprobar(nombre: string, got: string[], esperado: string[]) {
  // El ORDEN no es parte del contrato: sale de cómo está escrita la tabla (por
  // regiones). Lo que importa es QUÉ países se reconocen.
  const igual = (a: string[]) => [...a].sort().join(",");
  const ok = igual(got) === igual(esperado);
  if (!ok) {
    fallos++;
    console.log(`✗ ${nombre}\n    salió [${got}] y esperaba [${esperado}]`);
  } else {
    console.log(`✓ ${nombre}`);
  }
}

console.log(`\nLa tabla: ${PAISES.length} países en ${REGIONES.length} regiones.\n`);

console.log("Leer la primera frase de un artículo:");
for (const [frase, lang, esperado] of FRASES) {
  comprobar(`[${lang}] ${frase.slice(0, 58)}…`, paisesEnFrase(frase, lang), esperado);
}

console.log("\nLeer el pedido del oyente:");
for (const [pedido, esperado] of PEDIDOS) {
  comprobar(`«${pedido}»`, detectarPaisesPedido(pedido).map((p) => p.code), esperado);
}

// Las colisiones no son un fallo, pero conviene saber cuáles hay: cada una es
// una frase que nunca podrá concluir nada.
// Se miran por idioma: que "mexican" esté en la lista española Y en la inglesa
// del MISMO país no es una colisión, es el mismo país dos veces.
for (const [idioma, saca] of [
  ["español", (p: (typeof PAISES)[number]) => p.claves],
  ["inglés", (p: (typeof PAISES)[number]) => p.clavesEn],
] as const) {
  const porGentilicio = new Map<string, string[]>();
  for (const p of PAISES) {
    for (const c of saca(p)) {
      const ya = porGentilicio.get(c) ?? [];
      if (!ya.includes(p.code)) porGentilicio.set(c, [...ya, p.code]);
    }
  }
  const colisiones = [...porGentilicio].filter(([, v]) => v.length > 1);
  console.log(
    `\nGentilicios compartidos en ${idioma} (frases que quedarán en "no lo sé"): ${
      colisiones.map(([k, v]) => `${k} → ${v.join("/")}`).join(", ") || "ninguno"
    }`,
  );
}

console.log(fallos === 0 ? "\nTodo bien.\n" : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
