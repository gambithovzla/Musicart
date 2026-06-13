import { queueKey } from "./curator";
import { parseJson, type FactsPayload } from "./types";
import type { ThematicRoute } from "./thematic-routes";

type AlbumRow = {
  id: string;
  title: string;
  year: number;
  coverUrl: string | null;
  impact?: number;
  factsJson: string;
  artist: { name: string };
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function albumTags(a: AlbumRow): string[] {
  return (parseJson<Partial<FactsPayload>>(a.factsJson, {}).tags ?? []).map(norm);
}

// Empareja discos del catálogo con una ruta: por su semilla curada (siempre) o
// por afinidad de etiquetas EN VIVO (así entran solos los discos nuevos que
// encajan — antes la lista era fija y "Explorar" nunca se actualizaba).
export function matchRouteAlbums(
  route: ThematicRoute,
  catalog: AlbumRow[],
): AlbumRow[] {
  const curated = new Set(route.albums.map((a) => queueKey(a.title, a.artist)));
  const routeTags = (route.tags ?? []).map(norm);

  const matched = catalog.filter((a) => {
    if (curated.has(queueKey(a.title, a.artist.name))) return true;
    if (routeTags.length === 0) return false;
    const tags = albumTags(a);
    return tags.some((t) =>
      routeTags.some((rt) => t === rt || t.includes(rt) || rt.includes(t)),
    );
  });

  // Los de más impacto primero; a igualdad, el más reciente.
  return matched.sort(
    (a, b) => (b.impact ?? 0) - (a.impact ?? 0) || b.year - a.year,
  );
}

export function countRouteAlbums(
  route: ThematicRoute,
  catalog: AlbumRow[],
): number {
  return matchRouteAlbums(route, catalog).length;
}
