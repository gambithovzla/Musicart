// Seed: carga los dossiers de demostración con portada, paleta y deep links.
// Idempotente: si un álbum ya existe (título + artista), lo omite.

import { PrismaClient } from "@prisma/client";
import { Vibrant } from "node-vibrant/node";
import { FIXTURES } from "./fixtures";
import type { AlbumLinks, FactsPayload, Palette } from "../src/lib/types";

const prisma = new PrismaClient();

type ItunesResult = { coverUrl: string | null; appleMusicUrl: string | null };

async function fetchItunes(album: string, artist: string): Promise<ItunesResult> {
  const term = encodeURIComponent(`${artist} ${album}`);
  const res = await fetch(
    `https://itunes.apple.com/search?term=${term}&entity=album&limit=5`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = (await res.json()) as {
    results: { collectionName?: string; artworkUrl100?: string; collectionViewUrl?: string }[];
  };
  const match =
    data.results.find((r) =>
      r.collectionName?.toLowerCase().includes(album.toLowerCase()),
    ) ?? data.results[0];
  if (!match) return { coverUrl: null, appleMusicUrl: null };
  return {
    coverUrl: match.artworkUrl100?.replace("100x100", "600x600") ?? null,
    appleMusicUrl: match.collectionViewUrl ?? null,
  };
}

async function extractPalette(coverUrl: string): Promise<Palette | null> {
  const res = await fetch(coverUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const palette = await Vibrant.from(buffer).getPalette();
  return {
    vibrant: palette.Vibrant?.hex,
    darkVibrant: palette.DarkVibrant?.hex,
    lightVibrant: palette.LightVibrant?.hex,
    muted: palette.Muted?.hex,
    darkMuted: palette.DarkMuted?.hex,
    lightMuted: palette.LightMuted?.hex,
  };
}

async function main() {
  for (const f of FIXTURES) {
    const existing = await prisma.album.findFirst({
      where: { title: f.album.title, artist: { name: f.artist.name } },
    });
    if (existing) {
      console.log(`— ${f.album.title} ya existe, omitido`);
      continue;
    }

    let itunes: ItunesResult = { coverUrl: null, appleMusicUrl: null };
    try {
      itunes = await fetchItunes(f.album.title, f.artist.name);
    } catch (err) {
      console.warn(`  iTunes falló para ${f.album.title}:`, (err as Error).message);
    }

    let palette: Palette | null = null;
    if (itunes.coverUrl) {
      try {
        palette = await extractPalette(itunes.coverUrl);
      } catch (err) {
        console.warn(`  Paleta falló para ${f.album.title}:`, (err as Error).message);
      }
    }

    const query = encodeURIComponent(`${f.album.title} ${f.artist.name}`);
    const links: AlbumLinks = {
      spotify: `https://open.spotify.com/search/${query}/albums`,
      youtubeMusic: `https://music.youtube.com/search?q=${query}`,
      ...(itunes.appleMusicUrl ? { appleMusic: itunes.appleMusicUrl } : {}),
    };

    const factsPayload: FactsPayload = {
      album: {
        title: f.album.title,
        artist: f.artist.name,
        year: f.album.year,
        releaseDate: f.album.releaseDate,
        label: f.album.label,
        durationMin: f.album.durationMin,
      },
      tracklist: f.tracks.map((t) => ({ position: t.position, title: t.title })),
      facts: f.facts,
      sources: [],
    };

    const artist = await prisma.artist.upsert({
      where: { mbid: `seed:${f.artist.name}` },
      update: {},
      create: { name: f.artist.name, mbid: `seed:${f.artist.name}` },
    });

    await prisma.album.create({
      data: {
        title: f.album.title,
        year: f.album.year,
        coverUrl: itunes.coverUrl,
        durationMin: f.album.durationMin,
        difficulty: f.album.difficulty,
        impact: f.album.impact,
        linksJson: JSON.stringify(links),
        paletteJson: palette ? JSON.stringify(palette) : null,
        factsJson: JSON.stringify(factsPayload),
        artistId: artist.id,
        dossiers: {
          create: {
            locale: "es",
            status: "published",
            intro: f.dossier.intro,
            artistStory: f.dossier.artistStory,
            whyItMatters: f.dossier.whyItMatters,
            questionsJson: JSON.stringify(f.dossier.questions),
            impactNote: f.dossier.impactNote ?? null,
            trackNotes: {
              create: f.tracks.map((t) => ({
                position: t.position,
                title: t.title,
                note: t.note ?? null,
              })),
            },
          },
        },
      },
    });

    console.log(`✓ ${f.album.title} — ${f.artist.name} (portada: ${itunes.coverUrl ? "sí" : "no"}, paleta: ${palette ? "sí" : "no"})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
