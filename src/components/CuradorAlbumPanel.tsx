"use client";

// Panel de curador en la página del disco (solo admin): puntúa, mándalo a la
// vitrina, ponle estante y —abajo del todo— bórralo. Lo que antes vivía escondido
// en /revision, ahora al alcance del disco que estás escuchando.

import {
  EstanteEditor,
  EstrellasCurador,
  VitrinaToggle,
} from "@/app/revision/CuradorControls";
import { BorrarDiscoAdmin } from "@/components/BorrarDiscoAdmin";

export function CuradorAlbumPanel({
  albumId,
  title,
  rating,
  showcase,
  shelf,
  estantes,
}: {
  albumId: string;
  title: string;
  rating: number | null;
  showcase: boolean;
  shelf: string | null;
  estantes: string[];
}) {
  return (
    <div className="mt-10 border-t border-white/10 pt-6">
      <p className="text-center text-xs uppercase tracking-[0.3em] text-dim">
        Curador
      </p>

      <div className="mx-auto mt-5 flex max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-surface p-5">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-dim">Tu puntaje</p>
          <EstrellasCurador albumId={albumId} rating={rating} />
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-dim">Vitrina</p>
          <VitrinaToggle albumId={albumId} inicial={showcase} />
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-dim">
            Estante temático
          </p>
          <EstanteEditor albumId={albumId} inicial={shelf} sugerencias={estantes} />
        </div>
      </div>

      <BorrarDiscoAdmin albumId={albumId} title={title} />
    </div>
  );
}
