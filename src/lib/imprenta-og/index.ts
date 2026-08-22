// Las tipografías de la imprenta, para las imágenes sociales (9.9 y 11.6).
//
// Por qué existe este archivo: `ImageResponse` no dibuja con el navegador, así
// que NO tiene ninguna fuente del sistema ni ve el `next/font` de la app. Si no
// se le pasan las nuestras, pinta todo con su grotesca de fábrica — y una
// imagen del Salón en la tipografía de cualquier app es exactamente lo que la
// Fase 10 existe para no hacer (regla 4: la tipografía ES la interfaz).
//
// Los ficheros van en el repo y se leen del disco: una imagen social no puede
// depender de que un servidor de fuentes responda, y así se pinta igual de bien
// sin red. Se leen una sola vez por instancia (`cache`).
//
// Ojo con el `outputFileTracingIncludes` de `next.config.ts`: sin él, Vercel no
// se lleva estos .ttf al empaquetar esas rutas y la imagen saldría con la
// fuente de fábrica. Si añades una imagen social nueva, añádela también ahí.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CARPETA = join(process.cwd(), "src/lib/imprenta-og");

const FICHEROS = [
  { archivo: "Fraunces-SemiBold.ttf", name: "Fraunces", weight: 600 as const },
  { archivo: "Archivo-Regular.ttf", name: "Archivo", weight: 400 as const },
  { archivo: "IBMPlexMono-Medium.ttf", name: "IBM Plex Mono", weight: 500 as const },
];

type Fuente = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600;
  style: "normal";
};

let cache: Fuente[] | null = null;

/**
 * Las tres fuentes listas para `ImageResponse`, o `undefined` si no se pudieron
 * leer. Devolver `undefined` es importante: `ImageResponse` con una lista VACÍA
 * se cae ("No fonts are loaded"), mientras que sin el campo usa su fuente de
 * fábrica. Peor que una imagen con otra tipografía es un enlace que no enseña
 * nada — la regla de que la app nunca se cae vale también aquí.
 */
export async function fuentesDeLaImprenta(): Promise<Fuente[] | undefined> {
  if (cache) return cache;
  try {
    const fuentes = await Promise.all(
      FICHEROS.map(async (f) => ({
        name: f.name,
        data: await readFile(join(CARPETA, f.archivo)),
        weight: f.weight,
        style: "normal" as const,
      })),
    );
    cache = fuentes;
    return fuentes;
  } catch {
    return undefined;
  }
}
