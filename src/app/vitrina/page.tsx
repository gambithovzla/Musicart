// La vitrina del curador (pública): una galería de las carátulas que atesora,
// con la paleta de cada portada. La pieza de marca para coleccionistas.

import Link from "next/link";
import { getVitrinaAlbums } from "@/lib/vitrina";
import { VitrinaGaleria } from "./VitrinaGaleria";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "La vitrina · Musicart",
  description:
    "Los discos que el curador de Musicart atesora: una vitrina de carátulas favoritas, cada una con su historia.",
};

export default async function VitrinaPage() {
  const albums = await getVitrinaAlbums();

  return (
    <main className="px-6 pb-16 pt-14">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-dim">La colección</p>
        <h1 className="font-serif mt-3 text-4xl font-semibold">La vitrina</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-dim">
          Los discos que atesoro. Cada carátula, una que vale la pena tener a la
          vista. Tócala para leer su historia.
        </p>
      </header>

      <div className="mt-10">
        {albums.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-surface p-10 text-center">
            <p className="text-4xl">🖼️</p>
            <p className="mt-4 font-serif text-lg">La vitrina se está montando</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-dim">
              Aún no hay discos en exhibición. Vuelve pronto: el curador está
              eligiendo las carátulas que merecen estar aquí.
            </p>
            <Link
              href="/explorar"
              className="mt-6 inline-block rounded-full border border-white/15 px-5 py-2.5 text-sm text-foreground/80"
            >
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-dim">
              {albums.length} {albums.length === 1 ? "disco" : "discos"} en exhibición
            </p>
            <VitrinaGaleria albums={albums} />
          </>
        )}
      </div>
    </main>
  );
}
