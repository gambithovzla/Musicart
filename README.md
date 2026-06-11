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

1. **Hoy** — *tu* álbum del día: la IA lo elige según tu perfil, tu diario y tu
   ánimo, y te dice **por qué este disco, para ti, hoy**. (Sin señales tuyas
   aún, va la rotación global — la app nunca depende de que la IA responda.)
2. **Mood** — "¿cómo te sientes hoy?": cambiar el ánimo puede re-elegir el disco.
3. **Dossier** — la historia, el artista, las canciones con notas, por qué importa.
4. **Narración por voz** — todo el dossier se puede escuchar.
5. **Escuchar** — deep links a Spotify / Apple Music / YouTube Music.
6. **Reflexión** — rating + preguntas → se guarda en el **Diario** (con racha 🔥).
7. **La madriguera** — cada dossier sugiere saltos verificados a otros discos
   (rivalidades, colaboraciones, influencias).

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

## El catálogo crece solo

Un **curador IA** decide qué álbumes faltan (clásicos imprescindibles, huecos de
género/época/idioma, afinidades con lo que los usuarios puntúan alto) y los
encola en `GenerationQueue`. Un **worker** (`npm run worker`) toma la cola,
genera con el pipeline anti-alucinación y publica solo lo verificado; lo que no
pasa queda en `draft`. Si el curador IA falla, un **bootstrap de clásicos**
llena la cola automáticamente. Los **saltos** de cada dossier publicado también
alimentan la cola: la madriguera se excava sola.

- **Revisión humana:** `/revision?clave=ADMIN_SECRET` lista los drafts (publicar
  / descartar) y el estado de la cola con sus errores.
- **Correr el worker a mano** (p. ej. para acelerar el catálogo): pon en `.env`
  la URL **pública** de Postgres (`…proxy.rlwy.net`) y `OPENAI_API_KEY`, luego
  `npm run worker -- --batch 2`.
- **Dónde corre el worker:** servicio cron en **Railway** (mismo proyecto que el
  Postgres). El archivo `railway.json` del repo ya trae toda la configuración
  (build sin Next, comando `npm run worker`, cron `0 6 * * *`). Alta una sola
  vez, desde el dashboard:
  1. *New service* → *GitHub repo* → este repositorio.
  2. Variables: `DATABASE_URL` (la URL **interna** `postgres.railway.internal`)
     y `OPENAI_API_KEY`. Nada más: el resto lo dicta `railway.json`.

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
- El `build` corre `prisma migrate deploy`: las migraciones se aplican solas en
  cada deploy. (El seed ya no corre en el build; para un entorno nuevo:
  `npm run db:seed`.)
- Variables en Vercel: `DATABASE_URL`, `OPENAI_API_KEY` (recomendaciones en
  runtime) y `ADMIN_SECRET` (panel `/revision`).

> ⚠️ SQLite no funciona en Vercel (filesystem efímero) — por eso Postgres.

## Estructura

```
prisma/               schema + seed + fixtures de demo
scripts/              dossier.ts (pipeline CLI) · worker.ts (cron del catálogo)
src/lib/sources/      clientes: musicbrainz, wikipedia, lastfm, itunes, odesli, coverart
src/lib/dossier/      pipeline IA: facts → generate → verify → save
src/lib/recommend.ts  motor de recomendación (pick personalizado del día)
src/lib/curator.ts    curador IA (qué álbumes generar) → GenerationQueue
src/app/              pantallas: / (hoy) · /album/[id] · /diario · /perfil · /revision
src/components/       DailyReveal, MoodCheckin, Narrator, ReflectionForm, ListenLinks…
```

## Roadmap (resumen — detalle en [`ROADMAP.md`](./ROADMAP.md))

- ✅ **Fase 0** — MVP en producción (Vercel + Railway, ritual diario, pipeline IA)
- ✅ **Fase 1** — El cerebro recomendador: pick personalizado por perfil + diario
  + mood, con el "por qué este disco, para ti, hoy"
- ✅ **Fase 2** — Catálogo que crece solo (curador IA + worker + madriguera);
  validado en producción (jun 2026)
- 🔨 **Fase 3** — Cuentas reales (Auth.js) y sincronización multi-dispositivo
- 💎 **Fase 4** — TTS calidad podcast, modo conductor, compartibles, freemium
