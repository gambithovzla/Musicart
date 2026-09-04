"use client";

// Orquesta la vitrina pública: alterna entre "Galería" (todas las piezas juntas,
// como pared de museo) y "Estantería" (vinilos agrupados por estante temático).
// El botón de compartir vive aquí arriba.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { VitrinaEstante } from "@/lib/vitrina";
import { VitrinaGaleria } from "./VitrinaGaleria";
import { Estanteria } from "./Estanteria";
import { ShareVitrina } from "./ShareVitrina";

type Vista = "galeria" | "estanteria";

export function VitrinaVistas({ estantes }: { estantes: VitrinaEstante[] }) {
  const [vista, setVista] = useState<Vista>("galeria");

  // Galería: TODAS las piezas juntas, sin estantes. Las mejor puntuadas primero
  // (las sin puntuar, al final), como un coleccionista muestra sus joyas.
  const todos = useMemo(
    () =>
      estantes
        .flatMap((e) => e.albums)
        .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)),
    [estantes],
  );

  // Estantería: los estantes con nombre solo se rotulan si aportan agrupación.
  const mostrarHeaders =
    estantes.length > 1 || (estantes[0]?.shelf ?? null) !== null;

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="flex rounded-full border border-white/10 bg-surface p-1 text-sm">
          <BotonVista activo={vista === "galeria"} onClick={() => setVista("galeria")}>
            Galería
          </BotonVista>
          <BotonVista activo={vista === "estanteria"} onClick={() => setVista("estanteria")}>
            Estantería
          </BotonVista>
        </div>
        <ShareVitrina />
      </div>

      {vista === "galeria" ? (
        <VitrinaGaleria albums={todos} />
      ) : (
        <div className="flex flex-col gap-12">
          {estantes.map((e, i) => (
            <motion.section
              key={e.shelf ?? "__sin_estante__"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.4), duration: 0.4 }}
            >
              {mostrarHeaders && (
                <h2 className="mb-1 flex items-baseline gap-2">
                  <span className="font-serif text-xl">
                    {e.shelf ?? "Más de la colección"}
                  </span>
                  <span className="text-xs text-dim">
                    {e.albums.length} {e.albums.length === 1 ? "disco" : "discos"}
                  </span>
                </h2>
              )}
              <Estanteria albums={e.albums} />
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}

function BotonVista({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
        activo ? "bg-album text-black" : "text-dim hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
