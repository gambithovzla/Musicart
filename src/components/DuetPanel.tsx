"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acceptDuetInviteAction,
  createDuetInviteAction,
  leaveDuetAction,
} from "@/app/duet-actions";
import type { DuetSummary } from "@/lib/duet";

export function DuetPanel({ duet }: { duet: DuetSummary }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState(duet.inviteCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (duet.status === "none") {
    return (
      <section className="mt-8 rounded-2xl border border-white/10 bg-surface p-5">
        <h2 className="font-serif text-lg">Modo dueto</h2>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          Vincula tu cuenta con otra persona: cada semana os proponemos un disco
          en la intersección de vuestros gustos.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  const { inviteCode: c } = await createDuetInviteAction();
                  setInviteCode(c);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Error al crear invitación");
                }
              })
            }
            className="rounded-2xl bg-album px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {pending ? "Creando…" : "Invitar a alguien"}
          </button>

          {inviteCode && (
            <div className="rounded-xl border border-album/30 bg-album/10 px-4 py-3 text-center">
              <p className="text-xs text-dim">Tu código de invitación</p>
              <p className="font-mono mt-1 text-2xl font-bold tracking-[0.2em] text-album-light">
                {inviteCode}
              </p>
              <p className="mt-2 text-xs text-dim">
                Compártelo con quien quieras escuchar en dueto
              </p>
            </div>
          )}

          <div className="relative my-1 text-center text-xs text-dim">
            <span className="bg-surface px-2">o</span>
            <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-white/10" />
          </div>

          <label className="block text-sm">
            <span className="text-dim">Tengo un código</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. A1B2C3D4"
              maxLength={8}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d0b09] px-4 py-3 font-mono text-sm uppercase tracking-widest focus:border-album/60 focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={pending || code.trim().length < 6}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await acceptDuetInviteAction(code);
                if (!res.ok) setError(res.error);
                else {
                  setCode("");
                  router.refresh();
                }
              })
            }
            className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            Unirme al dueto
          </button>
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-300/90">{error}</p>}
      </section>
    );
  }

  if (duet.status === "pending") {
    return (
      <section className="mt-8 rounded-2xl border border-album/25 bg-album/5 p-5">
        <h2 className="font-serif text-lg text-album-light">Esperando a tu dueto</h2>
        <p className="mt-2 text-sm text-dim">
          Comparte este código. Cuando la otra persona lo introduzca, arranca
          vuestro disco semanal.
        </p>
        <p className="font-mono mt-4 text-center text-3xl font-bold tracking-[0.2em] text-album-light">
          {duet.inviteCode}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => leaveDuetAction())}
          className="mt-4 w-full text-center text-xs text-dim underline underline-offset-4 disabled:opacity-50"
        >
          Cancelar invitación
        </button>
      </section>
    );
  }

  const partnerLabel =
    duet.partnerName ?? duet.partnerEmail?.split("@")[0] ?? "tu dueto";

  return (
    <section className="mt-8 rounded-2xl border border-album/25 bg-album/5 p-5">
      <h2 className="font-serif text-lg text-album-light">Modo dueto activo</h2>
      <p className="mt-2 text-sm text-dim">
        Escucháis con <span className="text-foreground">{partnerLabel}</span>
      </p>
      <Link
        href="/dueto"
        className="mt-4 flex items-center justify-between rounded-xl border border-album/30 bg-album/10 px-4 py-3 text-sm transition-transform active:scale-[0.99]"
      >
        <span>
          <span className="font-medium text-album-light">Disco de la semana</span>
          <span className="mt-0.5 block text-xs text-dim">
            Vuestro punto de encuentro musical
          </span>
        </span>
        <span aria-hidden>→</span>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => leaveDuetAction())}
        className="mt-4 w-full text-center text-xs text-dim underline underline-offset-4 disabled:opacity-50"
      >
        Dejar el dueto
      </button>
    </section>
  );
}
