"use client";

import Link from "next/link";
import { useState } from "react";

export function SubscriptionPanel({
  isPro,
  used,
  limit,
  hasAccount,
  stripeReady,
  status,
}: {
  isPro: boolean;
  used: number;
  limit: number;
  hasAccount: boolean;
  stripeReady: boolean;
  status: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callApi(path: "/api/stripe/checkout" | "/api/stripe/portal") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Error de Stripe");
      }
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-surface p-5">
      <h2 className="font-serif text-lg">Tu plan</h2>

      {status === "success" && (
        <p className="mt-2 text-sm text-album-light">
          ¡Bienvenido a Pro! Ya puedes leer dossiers sin límite.
        </p>
      )}
      {status === "canceled" && (
        <p className="mt-2 text-sm text-dim">Pago cancelado — sigues en el plan gratis.</p>
      )}

      {isPro ? (
        <>
          <p className="mt-2 text-sm text-album-light">Musicart Pro — lecturas ilimitadas</p>
          {stripeReady && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void callApi("/api/stripe/portal")}
              className="mt-4 rounded-full border border-white/15 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? "Abriendo…" : "Gestionar suscripción"}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-dim">
            Plan gratis: {used} / {limit} dossiers este mes (tu disco del día no cuenta).
          </p>
          {!hasAccount ? (
            <Link
              href="/entrar?next=/perfil"
              className="mt-4 inline-block rounded-full bg-album px-5 py-2.5 text-sm font-semibold text-black"
            >
              Entrar para suscribirte
            </Link>
          ) : stripeReady ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void callApi("/api/stripe/checkout")}
              className="mt-4 rounded-full bg-album px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {loading ? "Abriendo Stripe…" : "Pasar a Pro"}
            </button>
          ) : null}
        </>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </section>
  );
}
