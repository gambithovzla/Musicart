// Construye el facts payload: la única verdad sobre la que el LLM puede narrar.
// Todo viene de fuentes verificables; cada pieza lleva su fuente.

import { searchReleaseGroup, getAlbumDetails } from "../sources/musicbrainz";
import { getCoverUrl } from "../sources/coverart";
import { getAlbumContext, getArtistContext } from "../sources/wikipedia";
import { getAlbumInfo } from "../sources/lastfm";
import { searchAlbum as searchItunes } from "../sources/itunes";
import { resolveLinks, searchLinks } from "../sources/odesli";
import type { AlbumLinks, FactsPayload } from "../types";

export type GatheredAlbum = {
  payload: FactsPayload;
  coverUrl: string | null;
  links: AlbumLinks;
  mbid: string | null;
  artistMbid: string | null;
};

export async function gatherAlbumFacts(
  albumQuery: string,
  artistQuery: string,
  log: (msg: string) => void = () => {},
): Promise<GatheredAlbum> {
  // 1. MusicBrainz: identidad canónica del álbum.
  log("Buscando en MusicBrainz…");
  const rg = await searchReleaseGroup(albumQuery, artistQuery);
  if (!rg) {
    throw new Error(
      `No se encontró "${albumQuery}" de ${artistQuery} en MusicBrainz. Revisa el nombre.`,
    );
  }
  const title = rg.title;
  const artist = rg.artistName;
  const year = rg.firstReleaseDate
    ? Number(rg.firstReleaseDate.slice(0, 4))
    : new Date().getFullYear();

  log(`Encontrado: ${title} — ${artist} (${year}). Obteniendo tracklist…`);
  const details = await getAlbumDetails(rg.id);
  if (!details || details.tracklist.length === 0) {
    throw new Error("MusicBrainz no devolvió tracklist para este álbum.");
  }

  const payload: FactsPayload = {
    album: {
      title,
      artist,
      year,
      releaseDate: rg.firstReleaseDate,
      label: details.label,
      durationMin: details.durationMin,
    },
    tracklist: details.tracklist.map((t) => ({
      position: t.position,
      title: t.title,
    })),
    facts: [
      {
        fact: `"${title}" de ${artist} se lanzó en ${rg.firstReleaseDate ?? year}${details.label ? ` por el sello ${details.label}` : ""}.`,
        source: "musicbrainz",
      },
      {
        fact: `El álbum tiene ${details.tracklist.length} canciones${details.durationMin ? ` y dura aproximadamente ${details.durationMin} minutos` : ""}.`,
        source: "musicbrainz",
      },
    ],
    passages: [],
    tags: [],
    sources: [`https://musicbrainz.org/release-group/${rg.id}`],
  };

  // 2. Contexto: Wikipedia (es → en) del álbum y del artista.
  log("Buscando contexto en Wikipedia…");
  const [albumWiki, artistWiki] = await Promise.all([
    getAlbumContext(title, artist),
    getArtistContext(artist),
  ]);
  if (albumWiki) {
    payload.passages!.push({
      source: `wikipedia:${albumWiki.lang}:álbum`,
      text: albumWiki.text,
    });
    payload.sources.push(albumWiki.url);
  }
  if (artistWiki) {
    payload.passages!.push({
      source: `wikipedia:${artistWiki.lang}:artista`,
      text: artistWiki.text,
    });
    payload.sources.push(artistWiki.url);
  }
  if (!albumWiki && !artistWiki) {
    log("⚠ Sin artículos de Wikipedia — el dossier tendrá menos contexto.");
  }

  // 3. Last.fm (opcional): tags y resumen.
  const lastfm = await getAlbumInfo(title, artist).catch(() => null);
  if (lastfm) {
    payload.tags = lastfm.tags;
    if (lastfm.wikiSummary) {
      payload.passages!.push({ source: "lastfm:wiki", text: lastfm.wikiSummary });
    }
    if (lastfm.listeners) {
      payload.facts.push({
        fact: `Tiene ${lastfm.listeners.toLocaleString("es")} oyentes registrados en Last.fm.`,
        source: "lastfm",
      });
    }
  }

  // 4. Portada y links de escucha.
  log("Resolviendo portada y links de escucha…");
  const [caaCover, itunes] = await Promise.all([
    getCoverUrl(rg.id),
    searchItunes(title, artist),
  ]);
  const coverUrl = itunes.coverUrl ?? caaCover;

  let links: AlbumLinks = searchLinks(title, artist);
  if (itunes.appleMusicUrl) {
    links.appleMusic = itunes.appleMusicUrl;
    const resolved = await resolveLinks(itunes.appleMusicUrl);
    if (resolved) {
      links = { ...links, ...Object.fromEntries(
        Object.entries(resolved).filter(([, v]) => v),
      ) };
    }
  }

  return {
    payload,
    coverUrl,
    links,
    mbid: rg.id,
    artistMbid: rg.artistMbid ?? null,
  };
}
