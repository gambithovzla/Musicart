"use client";

import Link from "next/link";
import { useState } from "react";

export function Paywall({
  used,
  limit,
  hasAccount,
  stripeReady,
}: {
  used: number;
  limit: number;
  hasAccount: boolean;
  stripeReady: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "No se pudo iniciar el pago");
      }
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-album/30 bg-album/5 px-6 py-8 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-album">Musicart Pro</p>
      <h2 className="font-serif mt-3 text-2xl font-semibold">
        Has llegado al límite del plan gratis
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-dim">
        Este mes ya leíste {used} de {limit} dossiers incluidos. Tu disco del día
        siempre es gratis; con Pro desbloqueas lecturas ilimitadas y la madriguera
        completa.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        {!hasAccount ? (
          <Link
            href="/entrar?next=/perfil"
            className="rounded-full bg-album px-6 py-3 text-sm font-semibold text-black"
          >
            Entrar y suscribirte
          </Link>
        ) : stripeReady ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void checkout()}
            className="rounded-full bg-album px-6 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Abriendo Stripe…" : "Pasar a Pro — ilimitado"}
          </button>
        ) : (
          <p className="text-xs text-dim">Suscripciones disponibles pronto.</p>
        )}
        <Link href="/" className="text-xs text-dim underline underline-offset-2">
          Volver a tu disco de hoy
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-300">{error}</p>
      )}
    </div>
  );
}
