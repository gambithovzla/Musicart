import { queueKey } from "./curator";
import type { ThematicRoute } from "./thematic-routes";

type AlbumRow = {
  id: string;
  title: string;
  year: number;
  coverUrl: string | null;
  artist: { name: string };
};

export function matchRouteAlbums(
  route: ThematicRoute,
  catalog: AlbumRow[],
): AlbumRow[] {
  const wanted = new Set(
    route.albums.map((a) => queueKey(a.title, a.artist)),
  );
  return catalog.filter((a) => wanted.has(queueKey(a.title, a.artist.name)));
}

export function countRouteAlbums(
  route: ThematicRoute,
  catalog: AlbumRow[],
): number {
  return matchRouteAlbums(route, catalog).length;
}
