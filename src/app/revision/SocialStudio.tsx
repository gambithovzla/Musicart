"use client";

import { useState, useTransition } from "react";
import { approveSocialDraft, archiveSocialDraft, createSocialDraft } from "./actions";

export type SocialDossierOption = {
  id: string;
  title: string;
  artist: string;
  year: number;
};

export type SocialContentRow = {
  id: string;
  title: string;
  artist: string;
  hook: string;
  script: string;
  caption: string;
  status: string;
  rightsStatus: string;
  videoUrl: string | null;
  error: string | null;
  verificationOk: boolean;
  verificationNotes: string[];
  createdAt: string;
};

function label(status: string) {
  return ({
    draft: "En mesa",
    blocked: "Bloqueado",
    approved: "Aprobado",
    rendering: "En imprenta",
    ready: "Video listo",
    failed: "Falló",
  } as Record<string, string>)[status] ?? status;
}

export function SocialStudio({ dossiers, contents }: { dossiers: SocialDossierOption[]; contents: SocialContentRow[] }) {
  const [dossierId, setDossierId] = useState(dossiers[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    });
  }

  return (
    <div className="mt-6">
      <div className="recuadro p-5">
        <p className="rotulo text-dim">Nueva tirada</p>
        <label className="mt-4 block text-sm" htmlFor="social-dossier">Disco de partida</label>
        <select
          id="social-dossier"
          value={dossierId}
          onChange={(event) => setDossierId(event.target.value)}
          className="mt-2 min-h-12 w-full border border-white/20 bg-transparent px-3 text-base"
        >
          {dossiers.map((dossier) => (
            <option key={dossier.id} value={dossier.id} className="bg-black">
              {dossier.title} · {dossier.artist} · {dossier.year}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !dossierId}
          onClick={() => run(() => createSocialDraft(dossierId))}
          className="sello mt-4 disabled:opacity-50"
        >
          {pending ? "Editando…" : "Crear guion vertical"}
        </button>
        <p className="mt-3 text-xs text-dim">
          El editor solo puede usar los hechos y la narrativa que ya superaron el verificador de Musicart.
        </p>
      </div>

      {message ? <p className="mt-4 border-l-4 border-album px-4 py-3 text-sm">{message}</p> : null}
      {error ? <p className="mt-4 border-l-4 border-red-400 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-8 flex flex-col gap-8">
        {contents.length === 0 ? (
          <p className="regla py-5 text-sm text-dim">Aún no hay piezas en la mesa editorial.</p>
        ) : contents.map((content, index) => (
          <article key={content.id} className="regla pb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="dato text-xs text-dim">№ {String(index + 1).padStart(2, "0")} · {content.createdAt}</p>
                <h3 className="font-serif mt-2 text-xl">{content.title}</h3>
                <p className="text-sm text-dim">{content.artist}</p>
              </div>
              <span className={`dato text-xs ${content.status === "ready" ? "text-album" : content.status === "blocked" || content.status === "failed" ? "text-red-300" : "text-dim"}`}>
                {label(content.status)}
              </span>
            </div>

            <p className="font-serif mt-5 text-lg italic leading-relaxed">“{content.hook}”</p>
            <details className="mt-4">
              <summary className="pulsable min-h-12 cursor-pointer py-3 text-sm">Leer guion y caption</summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{content.script}</p>
              <p className="mt-4 border-l border-white/25 pl-4 text-sm text-dim">{content.caption}</p>
            </details>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className={content.verificationOk ? "text-album" : "text-red-300"}>
                {content.verificationOk ? "✓ hechos verificados" : "✗ verificación bloqueada"}
              </span>
              <span className={content.rightsStatus === "clear" ? "text-album" : "text-red-300"}>
                {content.rightsStatus === "clear" ? "✓ recursos propios" : "derechos por revisar"}
              </span>
            </div>
            {content.verificationNotes.length > 0 ? (
              <ul className="mt-3 border-l-2 border-red-400 pl-4 text-xs text-red-300">
                {content.verificationNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : null}
            {content.error ? <p className="mt-3 break-words text-xs text-red-300">{content.error}</p> : null}

            {content.videoUrl ? (
              <div className="mt-5">
                <video controls preload="metadata" src={content.videoUrl} className="max-h-[32rem] w-full bg-black" />
                <a href={content.videoUrl} download className="sello-hueco mt-3 inline-flex">Descargar MP4</a>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {(content.status === "draft" || content.status === "failed") && content.verificationOk ? (
                <button type="button" disabled={pending} onClick={() => run(() => approveSocialDraft(content.id))} className="sello disabled:opacity-50">
                  Aprobar y enviar a imprenta
                </button>
              ) : null}
              {!["archived", "rendering"].includes(content.status) ? (
                <button type="button" disabled={pending} onClick={() => run(() => archiveSocialDraft(content.id))} className="sello-hueco disabled:opacity-50">
                  Retirar
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

