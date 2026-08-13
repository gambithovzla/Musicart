"use server";

// Acciones del Salón de la Fama (Fase 9).
// Todo lo de aquí es barato: consultas al índice ya calculado. Ninguna llamada
// a un LLM — el dial tiene que responder al instante o no es un dial.

import { cookies } from "next/headers";
import { getListenerIdentity } from "@/lib/identity";
import { discoDePuntaje, type DiscoDePuntaje } from "@/lib/canon/consulta";
import { DIAL_COOKIE } from "@/lib/device";

// Cuántos discos recuerda el dial para no repetirse. Suficiente para que una
// sesión larga no vea dos veces lo mismo, y corto para que el canon entero no
// se agote (al llegar al tope, lo más viejo vuelve a estar disponible).
const MEMORIA_DIAL = 40;

/** El dial: "dame un disco de 95". Devuelve null si el índice no tiene nada cerca. */
export async function pedirDiscoDePuntaje(
  score: number,
): Promise<DiscoDePuntaje | null> {
  const objetivo = Number(score);
  if (!Number.isFinite(objetivo)) return null;

  const [identity, jar] = await Promise.all([getListenerIdentity(), cookies()]);

  // Lo que el dial ya entregó (en esta sesión y en las anteriores). Es la
  // diferencia entre un dial y un botón que da siempre el mismo disco.
  const yaDados = (jar.get(DIAL_COOKIE)?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // La semilla cambia con cada vuelta: dos pulsaciones seguidas no ordenan
  // igual los empates, aunque el índice sea el mismo.
  const semilla = `${new Date().toISOString().slice(0, 10)}|${yaDados.length}`;
  const resultado = await discoDePuntaje(objetivo, identity, semilla, yaDados);
  if (!resultado) return null;

  jar.set(DIAL_COOKIE, [resultado.album.id, ...yaDados].slice(0, MEMORIA_DIAL).join(","), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  return resultado;
}
