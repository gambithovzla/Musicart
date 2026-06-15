"use client";

import { useState, useTransition } from "react";
import { recalcularImpactos } from "./actions";

export function RecalcularImpactos() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const r = await recalcularImpactos();
        if (r.ok) setMessage(r.message);
        else setError(r.message);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="self-start rounded-full border border-album/40 px-5 py-2.5 text-sm text-album-light transition-colors hover:bg-album/10 disabled:opacity-50"
      >
        {pending ? "Recalculando impactos…" : "Recalcular impactos viejos (los que están en 72)"}
      </button>
      {message && (
        <p className="rounded-xl border border-album/30 bg-album/10 px-4 py-3 text-sm text-album-light">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
