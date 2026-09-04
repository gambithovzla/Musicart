import { parseJson, type FactsPayload } from "./types";
import type { ThematicRoute } from "./thematic-routes";

type AlbumRow = {
  id: string;
  title: string;
  year: number;
  coverUrl: string | null;
  impact?: number;
  difficulty?: number;
  factsJson: string;
  artist: { name: string };
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/-/g, " ") // unifica "hip-hop" y "hip hop"
    .replace(/\s+/g, " ")
    .trim();
}

function albumTags(a: AlbumRow): string[] {
  return (parseJson<Partial<FactsPayload>>(a.factsJson, {}).tags ?? []).map(norm);
}

// Coincidencia por PALABRA COMPLETA, no por subcadena: la etiqueta del disco
// encaja con la de la ruta si es igual o si contiene la de la ruta como palabra
// entera ("classic rock" encaja con "rock"). NO al revés — así "rock en español"
// (etiqueta de ruta) no arrastra a cualquier disco de "rock".
function tagRegex(routeTag: string): RegExp {
  const esc = routeTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`);
}

function matchesTags(a: AlbumRow, routeRegexes: RegExp[]): boolean {
  const tags = albumTags(a);
  return tags.some((t) => routeRegexes.some((re) => re.test(t)));
}

// Empareja discos del catálogo con una ruta según SUS criterios (etiquetas,
// impacto, dificultad, época). Un disco entra si cumple TODOS los criterios
// definidos en la ruta. Sin listas fijas: la ruta refleja el catálogo real y se
// actualiza sola cuando entran discos nuevos que encajan.
// Genérica sobre T (con T al menos AlbumRow) para que quien llame pueda pasar
// filas con campos extra (p. ej. el impactNote del dossier) y conservarlos en
// el resultado sin perder el tipado.
export function matchRouteAlbums<T extends AlbumRow>(
  route: ThematicRoute,
  catalog: T[],
): T[] {
  const routeRegexes = (route.tags ?? []).map((t) => tagRegex(norm(t)));

  const matched = catalog.filter((a) => {
    if (routeRegexes.length > 0 && !matchesTags(a, routeRegexes)) return false;
    if (route.minImpact != null && (a.impact ?? 0) < route.minImpact) return false;
    if (route.minDifficulty != null && (a.difficulty ?? 0) < route.minDifficulty)
      return false;
    if (route.maxDifficulty != null && (a.difficulty ?? 99) > route.maxDifficulty)
      return false;
    if (route.yearFrom != null && a.year < route.yearFrom) return false;
    if (route.yearTo != null && a.year > route.yearTo) return false;
    return true;
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
