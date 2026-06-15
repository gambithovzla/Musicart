"use client";

// La madriguera interactiva: una tarjeta de salto. Si el disco ya existe, enlaza.
// Si no, un toque lo FABRICA al momento (POST /api/saltar) y te lleva a él — la
// cadena de descubrimiento se sigue sola, sin que el dueño siembre nada.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { DiscoveryJump } from "@/lib/types";

type Estado = "idle" | "creando" | "cola" | "error";

export function SaltoInteractivo({
  jump,
  albumId,
  coverUrl,
}: {
  jump: DiscoveryJump;
  albumId: string | null;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("idle");

  async function saltar() {
    if (estado === "creando") return;
    setEstado("creando");
    try {
      const res = await fetch("/api/saltar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: jump.title, artist: jump.artist }),
      });
      const data = (await res.json()) as { ok?: boolean; albumId?: string; reason?: string };
      if (data.ok && data.albumId) {
        router.push(`/album/${data.albumId}`);
        return;
      }
      setEstado(data.reason === "sin-presupuesto" ? "cola" : "error");
    } catch {
      setEstado("error");
    }
  }

  const cta =
    estado === "creando"
      ? "Creando el disco… (1-3 min)"
      : estado === "cola"
        ? "Lo dejé en cola — vuelve pronto ✓"
        : estado === "error"
          ? "No se pudo ahora — toca para reintentar"
          : "✦ Saltar a este disco";

  const tarjeta = (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={`Portada de ${jump.title}`}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-album-dark">
            <span className="font-serif text-xl text-album-light">♪</span>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">
          {jump.title} <span className="font-normal text-dim">· {jump.artist}</span>
        </p>
        <p className="font-serif mt-1 text-sm italic leading-snug text-foreground/80">
          {jump.connection}
        </p>
        <p
          className={`mt-1.5 text-xs ${
            estado === "error" ? "text-red-300/90" : "text-album-light"
          }`}
        >
          {albumId ? "Léelo en Musicart →" : cta}
        </p>
      </div>
    </div>
  );

  if (albumId) {
    return (
      <Link href={`/album/${albumId}`} className="block transition-transform active:scale-[0.99]">
        {tarjeta}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={saltar}
      disabled={estado === "creando"}
      className="block w-full text-left transition-transform active:scale-[0.99] disabled:opacity-80"
    >
      {tarjeta}
    </button>
  );
}
