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

0. **Entrada = onboarding** — quien entra sin perfil no ve un disco genérico: va
   directo a un onboarding por pasos (géneros, artistas favoritos con foto, un
   disco que te marcó, tu canción favorita, idiomas, qué buscas). Solo al
   terminarlo se le fabrica su primer disco.
1. **Hoy** — la IA **fabrica un disco fresco a tu medida**: propone un disco real
   de toda la música según tu perfil + diario + ánimo y lo genera al momento (con
   pantalla "Estamos creando tu disco de hoy"), explicando **por qué este disco,
   para ti, hoy**. No lo saca de un catálogo sembrado. Si la IA falla o se acaba
   el tope diario, cae a catálogo/rotación — la app nunca depende de la IA.
2. **Mood** — "¿cómo te sientes hoy?": se guarda como señal para mañana (no tira
   el disco fresco de hoy para rehacerlo).
3. **Dossier** — la historia, el artista, las canciones con notas, por qué importa.
   Dificultad (1-5) e **impacto cultural (1-100)** son **clicleables**: explican
   por qué, sobre hechos verificados (premios, listas…).
4. **Narración por voz** — todo el dossier se puede escuchar.
5. **Escuchar** — deep links a Spotify / Apple Music / YouTube Music.
6. **Reflexión** — **puntaje 1-10 + comentario libre + canción favorita** →
   alimentan la memoria del curador y el **Diario** (con racha 🔥 e **hilo
   musical** que conecta tus escuchas).
7. **La madriguera** — cada dossier sugiere saltos verificados a otros discos
   (rivalidades, colaboraciones, influencias).
8. **Extras** — rebobinada mensual (`/rebobinada`), chat con el dossier,
   modo dueto semanal (`/dueto`), recordatorio push (Perfil), pick de regreso
   con cariño si llevas días sin pasar.

**Admin** (correos en `ADMIN_EMAILS`): panel `/revision` (drafts, cola, crear
disco, tope de gasto, TTS, métricas) y botón "Rehacer mi disco de hoy" en la home.

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

Generar audio podcast (CLI, requiere `OPENAI_API_KEY` o `TTS_API_KEY`):

```bash
# Un álbum concreto
npm run tts -- "Abbey Road" "The Beatles"

# Todos los publicados sin audio (máx. 3 por corrida)
npm run tts -- --missing --limit 3
```

Los MP3 quedan en `public/audio/{dossierId}/` (local/CLI) o en **Vercel Blob**
(si `BLOB_READ_WRITE_TOKEN` está configurado). También puedes generarlos desde
`/revision` (solo admins; ver `ADMIN_EMAILS`) con el botón «Generar audio».

## El catálogo crece solo

Un **curador IA** decide qué álbumes faltan (clásicos imprescindibles, huecos de
género/época/idioma, afinidades con lo que los usuarios puntúan alto) y los
encola en `GenerationQueue`. Un **worker** (`npm run worker`) mantiene de paso el
índice del Salón de la Fama (ver más abajo; eso no gasta IA), toma la cola,
genera con el pipeline anti-alucinación y publica solo lo verificado; lo que no
pasa queda en `draft`. Si el curador IA falla, un **bootstrap de clásicos**
llena la cola automáticamente. Los **saltos** de cada dossier publicado también
alimentan la cola: la madriguera se excava sola.

- **Revisión humana:** `/revision` (cuenta admin en `ADMIN_EMAILS`) lista drafts,
  cola, métricas de producto y botones TTS. Enlace visible en Perfil si eres admin.
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

## El Salón de la Fama (el canon)

`/salon` responde a una pregunta que el resto de la app no sabía contestar:
*¿cuáles son los discos 100 de 100? Dame uno de 95.*

El truco está en **separar el ranking del dossier**. La tabla `CanonAlbum` es un
índice ligero de miles de discos (título, artista, año, portada, puntaje y sus
recibos) **sin narrativa**: la historia se fabrica el día que alguien toca ese
disco, reutilizando el pipeline de siempre. Así hay miles de discos sin fabricar
miles de dossiers.

El puntaje **no lo escribe ningún LLM**. Sale de señales comprobables —en
cuántas ediciones de Wikipedia tiene artículo propio (Wikidata), qué premios
recibió, cuánta gente lo escucha (Last.fm, con poco peso: esto mide
consagración, no popularidad)— y después se calibra **por percentil contra todo
el índice**. Por eso un 91 significa siempre lo mismo, y por eso el 100 es
rarísimo (~0,4% del índice). Cada número se abre y enseña de dónde salió.

### Cómo se llena (sin terminal)

- **Desde el teléfono:** en `/revision`, el botón **"Levantar el Salón"**. Cada
  toque construye un tramo del canon (o busca carátulas que falten) y te dice
  cuántos discos entraron y si hay que volver a darle. Es reanudable: lo que
  entró se queda.
- **Solo, de noche:** el worker de Railway lo mantiene en cada corrida — termina
  el índice si está a medias, lo refresca cada 7 días y busca portadas. Se salta
  con `npm run worker -- --sin-salon`.
- **A mano, para corridas grandes:**

```bash
npm run canon                  # construye/refresca el índice (~1000 discos)
npm run canon -- --limite 150  # corrida corta para probar
npm run canon -- --portadas 200  # solo carátulas pendientes
npm run canon -- --recalibrar    # solo recalcular puntajes (sin red)
```

La ingesta completa corre **fuera de Vercel** (en local o en Railway, como el
worker): tarda minutos y habla con varias APIs públicas. Necesita `DATABASE_URL`;
`LASTFM_API_KEY` es opcional (sin ella el índice se construye igual, con menos
matices). **No necesita clave de IA.**

> `CanonAlbum.score` y `Album.impact` son dos números de 1-100 **distintos**: el
> primero es comparable entre discos, el segundo (el impacto que la IA escribe
> dentro de un dossier) no lo es. No los mezcles.

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
  runtime), `ADMIN_EMAILS` (panel `/revision`) y, para la Fase 3, `AUTH_SECRET`,
  `AUTH_URL` (p. ej. `https://musicart-three.vercel.app`), `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`. Email opcional: `AUTH_RESEND_KEY`, `EMAIL_FROM`.
  Stripe (Fase 4.5): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
  (endpoint `https://tu-dominio/api/stripe/webhook`). Opcional: `FREEMIUM_DOSSIER_LIMIT`
  (default 5), `DAILY_GENERATION_BUDGET` (tope de discos nuevos/día para oyentes,
  default 15; Fase 6.6), `LLM_PROVIDER`/`LLM_MODEL` (default `gpt-4o-mini`; plan
  6.8: `GENERATION_MODEL` premium solo para escribir el dossier — vale tanto un
  modelo clásico (`gpt-4o`) como uno de razonamiento (`o3`, `gpt-5`: el adapter
  cambia solo al dialecto que toca, `max_completion_tokens` sin `temperature`).
  Para comprobar cuál está atendiendo, `/revision` → «¿El curador está vivo?»).
  Blob TTS: `BLOB_READ_WRITE_TOKEN`. Web Push (Fase 5.1):
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (genera las claves con `npx web-push generate-vapid-keys`); el envío diario
  es `npm run push` (cron en Railway con las mismas variables + `DATABASE_URL`).

> ⚠️ SQLite no funciona en Vercel (filesystem efímero) — por eso Postgres.

## Estructura

```
prisma/               schema + seed + fixtures de demo
scripts/              dossier.ts (pipeline CLI) · worker.ts (cron del catálogo)
src/lib/sources/      clientes: musicbrainz, wikipedia, lastfm, itunes, odesli, coverart
src/lib/dossier/      pipeline IA: facts → generate → verify → save
src/lib/recommend.ts  motor de recomendación (pick personalizado del día)
src/lib/curator.ts    curador IA (qué álbumes generar) → GenerationQueue
src/app/              / (hoy) · /album/[id] · /diario · /rebobinada · /dueto · /perfil · /explorar · /revision
src/components/       DailyReveal, MoodCheckin, Narrator, AlbumChat, DuetPanel, PushToggle…
```

## Roadmap (resumen — detalle en [`ROADMAP.md`](./ROADMAP.md))

- ✅ **Fase 0** — MVP en producción (Vercel + Railway, ritual diario, pipeline IA)
- ✅ **Fase 1** — El cerebro recomendador: pick personalizado por perfil + diario
  + mood, con el "por qué este disco, para ti, hoy"
- ✅ **Fase 2** — Catálogo que crece solo (curador IA + worker + madriguera);
  validado en producción (jun 2026)
- ✅ **Fase 3** — Cuentas reales (Auth.js, multi-dispositivo, export/borrado de datos)
- ✅ **Fase 4** — TTS, compartir, conductor, rutas, Stripe freemium, analytics admin
- ✅ **Fase 5** — Web Push, rebobinada mensual, chat con el disco, hilo musical
  en el diario, modo dueto semanal y pick de regreso con alma tras ausencia
- 🚧 **Fase 6** — "un amigo que te conoce" (EN CURSO): onboarding como entrada
  (6.7), **disco fresco fabricado cada día** por usuario (6.4), impacto 1-100 +
  reseña 1-10 con comentario y canción favorita + rankings clicleables (6.5),
  tope de gasto de IA (6.6). Pendientes: Spotify (6.2), profundidad narrativa con
  modelo premium (6.8) y curiosidades/madriguera viva (6.3/6.9).
