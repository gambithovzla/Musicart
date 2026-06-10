# Musicart — un disco al día 🎵

Curaduría musical narrativa **hecha por IA**, para melómanos curiosos. Cada día,
un álbum completo: su historia, su contexto, sus canciones clave y **por qué
debería importarte a ti**. La escucha ocurre en Spotify / Apple Music / YouTube
Music; Musicart es el guía.

La idea nace de esa madriguera deliciosa: ves una película de Michael Jackson,
preguntas cómo se grabó *Thriller*, saltas a Prince, de ahí a The Beatles y
descubres que duraron juntos menos de 10 años. Musicart empaqueta ese "click"
de descubrimiento — verificado, narrado y personalizado.

**PWA móvil-first** · Next.js 15 + Prisma (PostgreSQL) + Tailwind 4 + Framer Motion

> 📍 **Plan del producto:** ver [`ROADMAP.md`](./ROADMAP.md) — fases, tareas y
> estado actual. **Guía para sesiones de IA:** [`CLAUDE.md`](./CLAUDE.md).

## El loop diario

1. **Hoy** — el álbum del día se revela con la app teñida por la paleta de su portada.
2. **Dossier** — la historia, el artista, las canciones con notas, por qué importa.
3. **Narración por voz** — todo el dossier se puede escuchar.
4. **Escuchar** — deep links a Spotify / Apple Music / YouTube Music.
5. **Reflexión** — rating + preguntas → se guarda en el **Diario** (con racha 🔥).
6. **Perfil** — quién eres como oyente; alimenta las recomendaciones personalizadas.

## IA anti-alucinación por diseño

Toda la narrativa se genera **solo sobre hechos verificados**:

```
MusicBrainz (fechas, tracklist, sello)
Wikipedia es/en (contexto histórico)      →  FACTS PAYLOAD  →  LLM narra SOLO sobre esos hechos
Last.fm (tags, popularidad — opcional)                        →  LLM verificador caza afirmaciones sin respaldo
iTunes + Odesli (portada, deep links)                         →  validadores duros (años, títulos de tracks)
```

Si la verificación no queda limpia, el dossier se guarda como `draft` y no se
publica. Cada álbum se genera **una sola vez** y queda cacheado en DB para todos.

Generar un dossier (CLI, requiere `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` en `.env`):

```bash
npm run dossier -- "The Dark Side of the Moon" "Pink Floyd" --publish
```

## Correr en local

Necesitas PostgreSQL. En `.env` define `DATABASE_URL`, p. ej.
`DATABASE_URL="postgresql://user:pass@localhost:5432/musicart"`.

```bash
npm install
npx prisma migrate dev   # aplica las migraciones
npm run db:seed          # carga 3 dossiers de demostración
npm run dev              # http://localhost:3000 (ábrelo en vista móvil)
```

## Producción (Vercel + Railway)

- **Vercel** sirve la app; la rama de producción es **`master`**.
- **Railway** aloja el PostgreSQL; Vercel se conecta con la **URL pública**
  (`...proxy.rlwy.net`) en la variable `DATABASE_URL` (Production + Preview).
- El `build` corre `prisma migrate deploy` + `prisma db seed` (idempotente):
  tablas y datos de demo se crean solos en el primer deploy.

> ⚠️ SQLite no funciona en Vercel (filesystem efímero) — por eso Postgres.

## Estructura

```
prisma/               schema + seed + fixtures de demo
scripts/              dossier.ts (pipeline CLI) · facts-preview.ts (debug)
src/lib/sources/      clientes: musicbrainz, wikipedia, lastfm, itunes, odesli, coverart
src/lib/dossier/      pipeline IA: facts → generate → verify → save
src/app/              pantallas: / (hoy) · /album/[id] · /diario · /perfil
src/components/       DailyReveal, Narrator, ReflectionForm, ListenLinks…
```

## Roadmap (resumen — detalle en [`ROADMAP.md`](./ROADMAP.md))

- ✅ **Fase 0** — MVP en producción (Vercel + Railway, ritual diario, pipeline IA)
- 🔨 **Fase 1** — El cerebro recomendador: pick personalizado por perfil + diario
  + mood, con el "por qué este disco, para ti, hoy"
- 📦 **Fase 2** — Catálogo que crece solo (curador IA + worker) e hilos de
  descubrimiento (los saltos MJ → Prince → Beatles)
- 👤 **Fase 3** — Cuentas reales (auth) y sincronización multi-dispositivo
- 💎 **Fase 4** — TTS calidad podcast, modo conductor, compartibles, freemium
