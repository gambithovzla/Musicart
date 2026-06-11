# CLAUDE.md — Guía para sesiones de IA en Musicart

## Qué es Musicart

Curaduría musical narrativa, **hecha enteramente por IA**. Un disco al día con
su historia verificada, personalizado por perfil + diario + ánimo del usuario.
El usuario nunca sube contenido: la IA cura el catálogo, recomienda y explica
**por qué ese disco, para ti, hoy**. La escucha ocurre en Spotify/Apple
Music/YouTube Music; Musicart es el guía.

**Antes de escribir código, lee `ROADMAP.md`**: ahí están la visión completa,
la fase **🔨 EN CURSO**, las tareas con checkbox y los criterios de aceptación.

## Reglas de trabajo para la IA

1. **Trabaja solo en la fase marcada EN CURSO** del ROADMAP. No saltes de fase
   ni empieces features de fases futuras sin confirmar con el usuario.
2. **Marca los checkboxes** del ROADMAP en el mismo commit que completa la tarea.
   Al terminar una fase, pregunta antes de marcar la siguiente como EN CURSO.
3. **Anti-alucinación es ley**: cualquier texto generado por LLM sobre un álbum
   debe narrarse SOLO sobre hechos del `FactsPayload` (ver
   `src/lib/dossier/verify.ts`). Nunca publiques narrativa sin verificar.
4. **La app nunca se cae por la IA**: toda llamada a LLM en runtime necesita
   fallback (rotación global, contenido cacheado). Un 500 por timeout de
   OpenAI es un bug.
5. **UI y comentarios de código en español.** Tono cercano, melómano, sin
   tecnicismos hacia el usuario.
6. El usuario del proyecto no es programador y suele estar desde el teléfono:
   explica en lenguaje claro, da pasos concretos y verifica tú mismo todo lo
   que se pueda verificar desde el código.

## Stack

Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 ·
Framer Motion · Prisma 6 + **PostgreSQL (Railway)** · Zod ·
LLM por fetch directo (OpenAI o Anthropic, sin SDKs).

## Mapa del código

```
prisma/schema.prisma     Modelos: Artist, Album, Dossier (jumpsJson), TrackNote,
                         Profile, DailyPick (reason, mood, regenerated), Review,
                         GenerationQueue. Campos *Json son String (portabilidad).
prisma/seed.ts           Seed idempotente con 3 discos demo (manual: npm run db:seed).
src/app/page.tsx         Home: el ritual diario, personalizado por device (cookie).
src/app/album/[id]/      Dossier completo del disco + saltos de descubrimiento.
src/app/diario/          Historial de escuchas con racha (client + server actions).
src/app/perfil/          Onboarding ligero (client + server actions).
src/app/entrar/          Inicio de sesión (Google + email) y fusión del device.
src/app/revision/        Panel del dueño: drafts + cola (/revision?clave=ADMIN_SECRET).
src/auth.ts              Auth.js: providers, Prisma adapter, sesión en DB.
src/app/actions.ts       Server actions: saveReview, getReview, saveProfile,
                         getJournal, checkInMood.
src/lib/daily.ts         Rotación global determinista: el fallback eterno del
                         pick personalizado (usuarios sin señales o IA caída).
src/lib/recommend.ts     Motor de recomendación (Fase 1 + 3.3): pick por perfil+diario+
                         mood; con sesión comparte pick por userId entre dispositivos.
src/lib/identity.ts      Fase 3.3: userId + deviceId y filtros de consulta.
src/lib/user-data.ts     Fase 3.4: exportación y borrado de datos del oyente.
src/lib/curator.ts       Curador IA (Fase 2): propone álbumes → GenerationQueue;
                         bootstrapCatalogQueue si el curador falla.
src/lib/db.ts            Singleton de PrismaClient.
src/lib/dossier/         Pipeline anti-alucinación:
  facts.ts                 reúne hechos (MusicBrainz, Wikipedia, Last.fm, iTunes, Odesli)
  generate.ts              LLM narra SOLO sobre el FactsPayload
  verify.ts                LLM verificador caza inventos + validadores duros
  pipeline.ts              orquesta: facts → generate → verify → save (draft|published)
  llm.ts                   adapter OpenAI/Anthropic (env: LLM_PROVIDER, LLM_MODEL)
src/lib/sources/         Clientes de las APIs externas.
src/lib/types.ts         Tipos de dominio (FactsPayload, DossierContent, Palette…).
src/lib/merge-device.ts  Fusión Profile/Reviews/DailyPicks al iniciar sesión.
src/lib/device.ts        Identidad anónima por dispositivo (localStorage + cookie
                         musicart_device para personalizar en el servidor).
src/lib/theme.ts|palette.ts  Theming de la UI con la paleta de la portada.
src/components/          DailyReveal, MoodCheckin, ShareAlbum, DeviceSync, Narrator (voz),
                         ReflectionForm, ListenLinks…
src/app/explorar/        Rutas temáticas (Fase 4.4).
scripts/dossier.ts       CLI: npm run dossier -- "Álbum" "Artista" --publish
scripts/worker.ts        Worker del catálogo (cron Railway): npm run worker
```

## Comandos

```bash
npm run dev          # desarrollo (requiere DATABASE_URL en .env)
npm run build        # prisma migrate deploy && next build
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed idempotente (manual; el build ya no siembra)
npm run dossier -- "Álbum" "Artista" --publish   # generar un dossier (CLI, requiere API key)
npm run worker -- --batch 2                      # corrida del worker de catálogo (curador + pipeline)
```

## Entornos y despliegue

- **Producción:** Vercel, rama **`master`** (configurada a mano en Vercel
  Settings; el repo usa `master`, NO `main`). Cada push a master despliega.
- **Base de datos:** PostgreSQL en **Railway**. Vercel se conecta con la URL
  **pública** (`...proxy.rlwy.net:PUERTO/railway`) en `DATABASE_URL`
  (Production + Preview). La URL interna `railway.internal` solo sirve para
  servicios dentro de Railway (la usa el worker del catálogo).
- **El build ya NO siembra la base** (tarea 1.5 hecha): para un entorno nuevo
  corre `npm run db:seed` a mano (sigue siendo idempotente).
- **Variables en Vercel:** `DATABASE_URL`, `OPENAI_API_KEY` (la usa el motor de
  recomendación en runtime), `ADMIN_SECRET` (protege el panel `/revision`).
- **Worker del catálogo (Fase 2):** servicio cron en Railway (ya dado de alta
  y "Ready") que corre `npm run worker` cada día a las 06:00 UTC. Toda su
  configuración vive en `railway.json` (build no-op, start, cron). Sus
  variables: `DATABASE_URL` (ahí sí la URL **interna** `railway.internal`) y
  `OPENAI_API_KEY`.
- Flujo de trabajo: rama → PR → el dueño hace merge a `master` desde GitHub
  (normalmente desde el teléfono). No mergear sin su OK.

## Gotchas conocidos

- SQLite NO funciona en Vercel (ya se migró; no volver atrás).
- `package.json#prisma` está deprecado (warning en builds; migrar a
  `prisma.config.ts` cuando toque, no es urgente).
- `next/font` descarga Google Fonts en build: los sandboxes sin red fallan ahí
  (en Vercel funciona; no es un bug del código).
- El seed tolera fallos de red de iTunes/paleta (portada nula es aceptable).
- `Dossier.status`: solo `published` entra en la rotación; `draft` queda
  esperando revisión en `/revision?clave=ADMIN_SECRET`.
- El worker corre con `tsx` (devDependency): en Railway instala con
  devDependencies incluidas (no definas `NODE_ENV=production` en el build).
- En Railway NO debe correr `npm run build` (la red interna a Postgres no
  existe en la fase de build → P1001 en `migrate deploy`; además el worker no
  necesita Next). `railway.json` lo evita — no lo borres. Las migraciones las
  aplica el build de Vercel.
- Tampoco re-corras `npm ci` en el buildCommand de Railway: la fase de install
  ya instaló todo (incluidas devDependencies) y un segundo `npm ci` choca con
  la caché montada de Nixpacks → EBUSY. El buildCommand es un `echo` a propósito.
