// Construye el facts payload: la única verdad sobre la que el LLM puede narrar.
// Todo viene de fuentes verificables; cada pieza lleva su fuente.
//
// Jerarquía de fuentes:
//   1. MusicBrainz — identidad canónica, tracklist, label, mbid.
//   2. iTunes (fallback) — si MusicBrainz no encuentra el disco (frecuente en
//      música latina/regional). Da título, año, tracklist, portada, label.
//   3. Wikipedia, Last.fm, Odesli — siempre se consultan (opcional).

import {
  searchReleaseGroup,
  getAlbumDetails,
  type MbConnection,
} from "../sources/musicbrainz";
import { getCoverUrl } from "../sources/coverart";
import { getAlbumDeepContext, getArtistDeepContext, firstFactSentence } from "../sources/wikipedia";
import { getAlbumInfo } from "../sources/lastfm";
import {
  searchAlbum as searchItunes,
  getItunesTracklist,
} from "../sources/itunes";
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
  // ── 1. MusicBrainz (fuente principal) ────────────────────────────────────
  log("Buscando en MusicBrainz…");
  const rg = await searchReleaseGroup(albumQuery, artistQuery).catch(() => null);

  let title: string;
  let artist: string;
  let year: number;
  let mbid: string | null = null;
  let artistMbid: string | null = null;
  let mbSources: string[] = [];
  let tracklist: { position: number; title: string }[] = [];
  let label: string | undefined = undefined;
  let durationMin: number | undefined = undefined;
  let releaseDate: string | undefined = undefined;
  let usedMusicBrainz = false;
  let connections: MbConnection[] = []; // samples/remixes (la madriguera)

  if (rg) {
    const details = await getAlbumDetails(rg.id).catch(() => null);
    if (details && details.tracklist.length > 0) {
      usedMusicBrainz = true;
      title = rg.title;
      artist = rg.artistName;
      year = rg.firstReleaseDate
        ? Number(rg.firstReleaseDate.slice(0, 4))
        : new Date().getFullYear();
      releaseDate = rg.firstReleaseDate;
      label = details.label;
      durationMin = details.durationMin;
      mbid = rg.id;
      artistMbid = rg.artistMbid ?? null; // GatheredAlbum espera string | null
      tracklist = details.tracklist.map((t) => ({
        position: t.position,
        title: t.title,
      }));
      connections = details.connections;
      mbSources = [`https://musicbrainz.org/release-group/${rg.id}`];
      log(`Encontrado en MusicBrainz: ${title} — ${artist} (${year}).`);
    } else {
      log("⚠ MusicBrainz encontró el álbum pero sin tracklist. Probando iTunes…");
    }
  } else {
    log("⚠ No encontrado en MusicBrainz. Probando iTunes como fuente de respaldo…");
  }

  // ── 2. iTunes (fuente de respaldo) ───────────────────────────────────────
  //    Se usa cuando MusicBrainz falló O no devolvió tracklist.
  //    También se usa siempre para la portada y los links de escucha.
  const itunes = await searchItunes(albumQuery, artistQuery).catch(
    () => ({
      coverUrl: null, appleMusicUrl: null, collectionId: null,
      title: null, artist: null, year: null, trackCount: null, label: null,
    }),
  );

  if (!usedMusicBrainz) {
    if (!itunes.title) {
      throw new Error(
        `No se encontró "${albumQuery}" de ${artistQuery} ni en MusicBrainz ni en iTunes. ` +
          "Revisa que el nombre esté bien escrito.",
      );
    }
    title = itunes.title!;
    artist = itunes.artist ?? artistQuery;
    year = itunes.year ?? new Date().getFullYear();
    label = itunes.label ?? undefined;

    log(`Encontrado en iTunes: ${title} — ${artist} (${year}). Obteniendo tracklist…`);
    if (itunes.collectionId) {
      tracklist = await getItunesTracklist(itunes.collectionId);
    }
    if (tracklist.length === 0 && itunes.trackCount) {
      // Sin tracklist pero sabemos cuántas pistas hay: alcanza para el dossier.
      log(`⚠ Sin tracklist detallado; el álbum tiene ${itunes.trackCount} canciones.`);
    }
  }

  // ── Construcción del payload base ────────────────────────────────────────
  const payload: FactsPayload = {
    album: {
      title: title!,
      artist: artist!,
      year: year!,
      releaseDate,
      label,
      durationMin,
    },
    tracklist,
    facts: [
      {
        fact:
          `"${title!}" de ${artist!} se lanzó en ${releaseDate ?? year!}` +
          (label ? ` por el sello ${label}` : "") +
          ".",
        source: usedMusicBrainz ? "musicbrainz" : "itunes",
      },
      ...(tracklist.length > 0
        ? [
            {
              fact: `El álbum tiene ${tracklist.length} canciones${durationMin ? ` y dura aproximadamente ${durationMin} minutos` : ""}.`,
              source: usedMusicBrainz ? "musicbrainz" : "itunes",
            },
          ]
        : itunes.trackCount
          ? [
              {
                fact: `El álbum tiene ${itunes.trackCount} canciones.`,
                source: "itunes",
              },
            ]
          : []),
    ],
    passages: [],
    tags: [],
    sources: [
      ...mbSources,
      ...(itunes.appleMusicUrl ? [itunes.appleMusicUrl] : []),
    ],
  };

  // ── 2.5 Conexiones entre canciones (samples / remixes) ───────────────────
  //    Datos estructurados de MusicBrainz → verificables. Materia prima de los
  //    wowFacts "¿Sabías que…?" y de la madriguera ("Río Babel samplea Porcelain").
  for (const c of connections) {
    const de = c.relatedArtist ? ` de ${c.relatedArtist}` : "";
    const fact =
      c.kind === "sample"
        ? c.direction === "uses"
          ? `«${c.track}» usa un sample de «${c.relatedTitle}»${de}.`
          : `«${c.track}» fue sampleada en «${c.relatedTitle}»${de}.`
        : c.direction === "uses"
          ? `«${c.track}» es un remix de «${c.relatedTitle}»${de}.`
          : `«${c.track}» fue remezclada en «${c.relatedTitle}»${de}.`;
    payload.facts.push({ fact, source: "musicbrainz:relación" });
  }
  if (connections.length > 0) {
    log(`Conexiones encontradas (samples/remixes): ${connections.length}.`);
  }

  // ── 3. Wikipedia (intro + secciones profundas, Fase 6.9) ─────────────────
  log("Buscando contexto en Wikipedia (intro + secciones profundas)…");
  const [albumWiki, artistWiki] = await Promise.all([
    getAlbumDeepContext(title!, artist!).catch(() => ({ intro: null, sections: [] })),
    getArtistDeepContext(artist!).catch(() => ({ intro: null, sections: [] })),
  ]);

  if (albumWiki.intro) {
    payload.passages!.push({
      source: `wikipedia:${albumWiki.intro.lang}:álbum:intro`,
      text: albumWiki.intro.text,
    });
    payload.sources.push(albumWiki.intro.url);
  }
  for (const sec of albumWiki.sections) {
    payload.passages!.push({ source: sec.source, text: sec.text });
    const nugget = firstFactSentence(sec.text);
    if (nugget) {
      payload.facts.push({ fact: nugget, source: sec.source });
    }
  }

  if (artistWiki.intro) {
    payload.passages!.push({
      source: `wikipedia:${artistWiki.intro.lang}:artista:intro`,
      text: artistWiki.intro.text,
    });
    payload.sources.push(artistWiki.intro.url);
  }
  for (const sec of artistWiki.sections) {
    payload.passages!.push({ source: sec.source, text: sec.text });
    const nugget = firstFactSentence(sec.text);
    if (nugget) {
      payload.facts.push({ fact: nugget, source: sec.source });
    }
  }

  if (!albumWiki.intro && !artistWiki.intro && albumWiki.sections.length === 0) {
    log("⚠ Sin artículos de Wikipedia — el dossier tendrá menos contexto.");
  } else if (albumWiki.sections.length + artistWiki.sections.length > 0) {
    log(
      `Wikipedia: ${albumWiki.sections.length + artistWiki.sections.length} secciones profundas añadidas.`,
    );
  }

  // ── 4. Last.fm (opcional) ─────────────────────────────────────────────────
  const lastfm = await getAlbumInfo(title!, artist!).catch(() => null);
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

  // ── 5. Portada y links de escucha ────────────────────────────────────────
  log("Resolviendo portada y links de escucha…");
  const caaCover = mbid ? await getCoverUrl(mbid).catch(() => null) : null;
  const coverUrl = itunes.coverUrl ?? caaCover;

  let links: AlbumLinks = searchLinks(title!, artist!);
  if (itunes.appleMusicUrl) {
    links.appleMusic = itunes.appleMusicUrl;
    const resolved = await resolveLinks(itunes.appleMusicUrl).catch(() => null);
    if (resolved) {
      links = {
        ...links,
        ...Object.fromEntries(Object.entries(resolved).filter(([, v]) => v)),
      };
    }
  }

  return { payload, coverUrl, links, mbid, artistMbid };
}
