// ¿Qué recuerda el curador de lo que respondiste, y cuánto pesa hoy?
//
// Sin red y sin base de datos: simula respuestas de la pregunta del día con
// distintas antigüedades y enseña EXACTAMENTE el texto que le llega al curador.
// Existe por el caso que lo destapó: contestar una vez "Montaña" en un
// "¿montaña o playa?" y ver escenas de montaña meses después.
//
//   npm run probar:memoria

import {
  formatCuriosities,
  DIAS_FRESCA,
  DIAS_OLVIDO,
  type CuriosityAnswer,
} from "../src/lib/curiosities";
import { ganchosQuemados, textoUsaGancho } from "../src/lib/reason-guard";

const HOY = "2026-08-28";

/** Una fecha de hace N días (para fabricar el ejemplo). */
function haceDias(n: number): string {
  const d = new Date(`${HOY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const RESPUESTAS: CuriosityAnswer[] = [
  { id: "week", question: "¿Cómo va tu semana?", answer: "Caótica", date: haceDias(1) },
  { id: "feel-now", question: "¿Cómo te sientes ahora mismo?", answer: "Con energía", date: haceDias(6) },
  { id: "ai-montana", question: "¿Montaña o playa?", answer: "Montaña", date: haceDias(70) },
  { id: "ai-vieja", question: "¿Qué te quita el sueño?", answer: "El trabajo", date: haceDias(200) },
];

console.log(`\nHOY es ${HOY}. Fresca ≤ ${DIAS_FRESCA} días · se olvida pasados ${DIAS_OLVIDO}.\n`);

console.log("═══ 1. Lo que el curador ve un día normal ".padEnd(76, "═"));
console.log(formatCuriosities(RESPUESTAS, { hoy: HOY }) || "(nada)");

const RAZON_DE_AYER =
  "Hoy, déjate llevar por la calidez de la voz de Gregory Porter mientras conduces hacia montañas nevadas de sensaciones.";
const ganchos = ganchosQuemados([RAZON_DE_AYER]);

console.log(`\n═══ 2. Si AYER ya te habló de eso `.padEnd(76, "═"));
console.log(`Razón de ayer: "${RAZON_DE_AYER}"`);
console.log(`Palabras que quedan vetadas hoy: ${ganchos.map((g) => g.forma).join(", ")}\n`);
console.log("Y lo que hoy ve el curador (la señal gastada ya ni se le enseña):");
console.log(
  formatCuriosities(RESPUESTAS, {
    hoy: HOY,
    excluir: (r) => textoUsaGancho(`${r.answer} ${r.extra ?? ""}`, ganchos),
  }) || "(nada)",
);

console.log(`\n═══ 3. La misma respuesta, ya caducada `.padEnd(76, "═"));
const CADUCADA: CuriosityAnswer[] = [
  { id: "ai-montana", question: "¿Montaña o playa?", answer: "Montaña", date: haceDias(DIAS_OLVIDO + 10) },
];
console.log(
  formatCuriosities(CADUCADA, { hoy: HOY }) ||
    `(nada — pasados ${DIAS_OLVIDO} días el curador ya no la mira)`,
);
console.log();
