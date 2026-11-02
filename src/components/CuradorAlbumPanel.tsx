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
import { ReescribirHistoria } from "@/components/ReescribirHistoria";

export function CuradorAlbumPanel({
  albumId,
  title,
  rating,
  showcase,
  shelf,
  estantes,
  historiaNueva,
}: {
  albumId: string;
  title: string;
  rating: number | null;
  showcase: boolean;
  shelf: string | null;
  estantes: string[];
  historiaNueva: boolean;
}) {
  return (
    <div className="filete mt-10 pt-6">
      <div className="cabecera-seccion">
        <span className="rotulo">Curador</span>
        <span className="dato text-[11px] text-tinta-suave">solo tú lo ves</span>
      </div>

      <div className="recuadro mx-auto mt-5 flex max-w-sm flex-col gap-5 p-5">
        <ReescribirHistoria albumId={albumId} yaNueva={historiaNueva} />

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
