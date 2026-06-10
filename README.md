# Musicart — un disco al día

Curaduría musical narrativa para melómanos curiosos. Cada día, un álbum completo:
su historia, su contexto, sus canciones clave y por qué debería importarte.
La escucha ocurre en Spotify / Apple Music / YouTube Music; Musicart es el guía.

**PWA móvil-first** · Next.js 15 + Prisma (SQLite dev) + Tailwind 4 + Framer Motion

## Correr en local

```bash
npm install
npx prisma migrate dev   # crea la base de datos
npm run db:seed          # carga 3 dossiers de demostración (Continuum, Rumours, El Mal Querer)
npm run dev              # http://localhost:3000 (ábrelo en vista móvil)
```

## Generar dossiers reales con IA

1. Pon tu clave en `.env` (`OPENAI_API_KEY` o `ANTHROPIC_API_KEY` + `LLM_PROVIDER`).
2. Corre el pipeline:

```bash
npm run dossier -- "The Dark Side of the Moon" "Pink Floyd" --publish
```

El pipeline es **anti-alucinación por diseño**:

```
MusicBrainz (fechas, tracklist, sello)
Wikipedia es/en (contexto histórico)      →  FACTS PAYLOAD  →  LLM narra SOLO sobre esos hechos
Last.fm (tags, popularidad — opcional)                        →  LLM verificador caza afirmaciones sin respaldo
iTunes + Odesli (portada, deep links)                         →  validadores duros (años, títulos de tracks)
```

Si la verificación no queda limpia, el dossier se guarda como `draft` y no se publica.
Cada álbum se genera **una sola vez** y queda cacheado en DB para todos los usuarios.

Para inspeccionar los hechos sin llamar a la IA:

```bash
npx tsx scripts/facts-preview.ts "Brothers in Arms" "Dire Straits"
```

## El loop diario

1. **Hoy** — el álbum del día se revela con la app teñida por la paleta de su portada.
2. **Dossier** — la historia, el artista, las canciones con notas, por qué importa.
3. **Narración por voz** — todo el dossier se puede escuchar (voz del navegador;
   arquitectura lista para MP3s TTS pre-renderizados vía `Dossier.audioJson`).
4. **Escuchar** — deep links a Spotify / Apple Music / YouTube Music.
5. **Reflexión** — rating + preguntas → se guarda en el **Diario** (con racha 🔥).
6. **Perfil** — onboarding ligero que alimentará las recomendaciones personalizadas.

## Estructura

```
prisma/               schema + seed + fixtures de demo
scripts/              dossier.ts (pipeline CLI) · facts-preview.ts (debug)
src/lib/sources/      clientes: musicbrainz, wikipedia, lastfm, itunes, odesli, coverart
src/lib/dossier/      pipeline IA: facts → generate → verify → save
src/app/              pantallas: / (hoy) · /album/[id] · /diario · /perfil
src/components/       DailyReveal, Narrator, ReflectionForm, ListenLinks…
```

## Roadmap (ver plan completo)

- **Fase 2** — auth (Auth.js), recomendación personalizada por LLM ("este disco, para ti, hoy"),
  cron nocturno que pre-genera picks, migrar SQLite → Postgres (cambiar `provider` en schema.prisma).
- **Fase 3** — panel admin de revisión de drafts, analytics, validación con usuarios reales.
- **Fase 4** — Stripe freemium, rutas temáticas, modo conductor (audio continuo + Media Session),
  TTS de calidad podcast, tarjetas compartibles.
