# CLAUDE.md — Guía para sesiones de IA en Musicart

## Qué es Musicart

Curaduría musical narrativa, **hecha enteramente por IA**. Un disco al día con
su historia verificada, personalizado por perfil + diario + ánimo del usuario.
Cada día la IA **fabrica un disco fresco a la medida de cada usuario** (propone
un disco real de toda la música según su gusto y lo genera al momento con el
pipeline anti-alucinación) — no lo saca de un catálogo cerrado de discos
sembrados. El usuario nunca sube contenido: la IA cura el catálogo, recomienda y
explica **por qué ese disco, para ti, hoy**. La escucha ocurre en Spotify/Apple
Music/YouTube Music; Musicart es el guía.

**Antes de escribir código, lee `ROADMAP.md`**: ahí están la visión completa,
las fases con checkbox y los criterios de aceptación. **Fases 0–7 completas;
Fase 8 EN CURSO** (ago 2026): **Caminos** — "por dónde entrar a un género".
Una secuencia de 5 discos en orden pedagógico, en **pestaña aparte** (`/caminos`):
el disco del día NO se toca. Ver las decisiones de diseño en el ROADMAP antes de
tocar nada de esta fase.

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
prisma/schema.prisma     Modelos: Artist, Album (difficulty 1-5, impact 1-100),
                         Dossier (jumpsJson, impactNote = por qué del impacto),
                         TrackNote, Profile, DailyPick (reason, mood, returnPick),
                         Review (rating 1-10; answersJson trae comentario libre +
                         canción favorita), GenerationQueue, GenerationBudget
                         (tope de gasto diario 6.6), PushSubscription, Rewind,
                         MusicalThread, DuetPair/DuetPick, DossierChat, DossierView,
                         Camino (Fase 8: tema, titulo, intro, stepsJson, status).
                         Campos *Json son String.
prisma/seed.ts|fixtures.ts  Seed idempotente con 3 discos demo (con impactNote).
src/app/page.tsx         Home: gate de onboarding (sin perfil → Onboarding, NO se
                         muestra disco) → gate de idioma (solo si no hay pick hoy)
                         → pick guardado / fabricar disco fresco / rotación.
src/app/api/pick-hoy/    Route (maxDuration 300) que fabrica el disco fresco del
                         día (generarPickDelDia); con {rehacer:true} y admin lo
                         rehace. La home la dispara con pantalla de carga.
src/app/album/[id]/      Dossier completo: métricas clicleables (impacto/dificultad),
                         reseña (1-10 + comentario + canción favorita) y saltos.
src/app/diario/          Historial de escuchas con racha + hilo musical (5.4).
src/app/rebobinada/      Carta mensual del mes musical (5.2).
src/app/caminos/         Fase 8: pestaña propia de los Caminos (lista + crear, y
                         /caminos/[id] con sus pasos). Las dos operaciones caras
                         viven en /api/caminos/crear (maxDuration 120) y
                         /api/caminos/paso (300), como el disco del día.
src/app/dueto/           Disco compartido semanal entre dos cuentas (5.5).
src/app/perfil/          Edición de perfil, push, dueto, Stripe, privacidad.
src/app/entrar/          Inicio de sesión (Google + email) y fusión del device.
src/app/revision/        Panel del dueño: drafts + cola + crear disco + tope de
                         gasto + TTS (admin por ADMIN_EMAILS).
src/auth.ts              Auth.js: providers, Prisma adapter, sesión en DB.
src/lib/admin.ts         isAdminEmail / requireAdmin (env ADMIN_EMAILS).
src/app/actions.ts       Server actions: saveReview, getReview, saveProfile,
                         getJournal, checkInMood, hasProfile.
src/lib/daily.ts         Rotación global determinista: el fallback eterno del
                         pick personalizado (usuarios sin señales o IA caída).
src/lib/recommend.ts     Motor (Fase 1 + 3.3 + 5.6 + 6.4): getPersonalizedPick (lee
                         el pick guardado), generarPickDelDia (FABRICA el disco
                         fresco del día), puedeGenerarPickFresco, borrarPickDeHoy,
                         applyMood, elegirCon/PorGusto (fallback de catálogo),
                         formatPerfil (incluye disco que te marcó + canción fav).
src/lib/discover.ts      Fase 6.4: la IA PROPONE un disco real de toda la música
                         para descubrir hoy (title+artist+reason) → pipeline.
src/lib/budget.ts        Fase 6.6: tope de discos nuevos/día (DAILY_GENERATION_BUDGET).
src/lib/reason-guard.ts  Fase 7.8: barrera anti-muletilla de la razón del día —
                         veta las palabras que ya usó en días recientes y, si
                         reincide, reescribe la razón (nunca rompe: deja la original).
src/lib/origin-guard.ts  Fase 7.9: barrera dura del ORIGEN del artista — si el pedido
                         nombra un país ("artistas venezolanos"), comprueba con
                         MusicBrainz que el artista lo sea; si no, se descarta la
                         propuesta y se pide otra (ante la duda, deja pasar).
src/lib/review.ts        Claves del comentario libre y canción favorita; escala
                         1-10 (RATING_MAX, LOVED_THRESHOLD, splitAnswers).
src/lib/musical-thread.ts Fase 5.4: conecta reseñas del diario entre sí (cacheada).
src/lib/duet.ts          Fase 5.5: invitación, pick semanal por intersección de gustos.
src/lib/rewind.ts        Fase 5.2: rebobinada mensual cacheada.
src/lib/album-chat.ts    Fase 5.3: chat en dossier con FactsPayload y límites diarios.
src/lib/caminos.ts       Fase 8: motor de los Caminos — proponerCamino (5 pasos con
                         su papel y su puente, UNA llamada al LLM), abrirPaso
                         (fabricación perezosa vía pipeline, respeta el tope 6.6),
                         marcarEscuchado (abre el siguiente) y reemplazarPaso.
src/lib/caminos-pasos.ts Fase 8: la parte PURA (tipos, etiquetas de papel,
                         pasoAbierto/pasoActual). Existe aparte porque la UI de
                         cliente no puede importar caminos.ts (arrastra el
                         pipeline → jimp → `fs` y rompe el build).
src/lib/return-ritual.ts Fase 5.6: detecta ausencia y personaliza el pick de regreso.
src/lib/identity.ts      Fase 3.3: userId + deviceId y filtros de consulta.
src/lib/user-data.ts     Fase 3.4: exportación y borrado de datos del oyente.
src/lib/curator.ts       Curador IA (Fase 2): propone álbumes → GenerationQueue;
                         bootstrapCatalogQueue si el curador falla.
src/lib/db.ts            Singleton de PrismaClient.
src/lib/dossier/         Pipeline anti-alucinación:
  facts.ts                 reúne hechos (MusicBrainz, Wikipedia, Last.fm, iTunes, Odesli)
  generate.ts              LLM narra SOLO sobre el FactsPayload (intro, artista,
                           whyItMatters, trackNotes, jumps, impactNote, difficulty, impact)
  verify.ts                LLM verificador caza inventos + validadores duros
  pipeline.ts              orquesta: facts → generate → verify → save (reused?)
  llm.ts                   adapter OpenAI/Anthropic + hayClaveIA() (env LLM_PROVIDER,
                           LLM_MODEL; plan 6.8: GENERATION_MODEL premium solo para escribir)
src/lib/sources/         Clientes de las APIs externas.
src/lib/types.ts         Tipos de dominio (FactsPayload, DossierContent, Palette…).
src/lib/merge-device.ts  Fusión Profile/Reviews/DailyPicks al iniciar sesión.
src/lib/device.ts        Identidad anónima por dispositivo (localStorage + cookie
                         musicart_device para personalizar en el servidor).
src/lib/theme.ts|palette.ts  Theming de la UI con la paleta de la portada.
src/components/          Onboarding (entrada por pasos, 6.7), CreandoDiscoHoy (carga
                         del disco fresco), RehacerDiscoAdmin, DailyReveal,
                         ImpactoCultural + DificultadEscucha (clicleables),
                         ReflectionForm (1-10 + comentario + canción favorita),
                         MoodCheckin, ShareAlbum, DeviceSync, Narrator, AlbumChat,
                         DuetPanel, PushToggle, ProfileForm, InstallPrompt…
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
npm run push                                     # envío Web Push del disco del día (cron Railway)
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
  recomendación Y la fabricación del disco fresco en runtime), `ADMIN_EMAILS`
  (correos admin separados por coma; gatean `/revision` y el botón "Rehacer mi
  disco de hoy"). Opcional `DAILY_GENERATION_BUDGET` (tope de discos nuevos/día
  para oyentes, default 15; ver `src/lib/budget.ts`). LLM: `LLM_PROVIDER`,
  `LLM_MODEL` (default `gpt-4o-mini`). Resto de variables: ver README.
- **Disco fresco del día (Fase 6.4):** la home no fabrica en SSR (tarda 1-3 min).
  Si no hay pick guardado y el oyente tiene perfil, muestra `CreandoDiscoHoy` que
  hace POST a `/api/pick-hoy` (`maxDuration=300`); al terminar refresca. Si la IA
  falla o se acaba el tope → cae a catálogo/rotación (la app nunca se cae).
- **Worker del catálogo (Fase 2):** servicio cron en Railway (ya dado de alta
  y "Ready") que corre `npm run worker` cada día a las 06:00 UTC. Toda su
  configuración vive en `railway.json` (build no-op, start, cron). Sus
  variables: `DATABASE_URL` (ahí sí la URL **interna** `railway.internal`) y
  `OPENAI_API_KEY`.
- Flujo de trabajo: rama → PR → el dueño hace merge a `master` desde GitHub
  (normalmente desde el teléfono). No mergear sin su OK.

## Gotchas conocidos

- SQLite NO funciona en Vercel (ya se migró; no volver atrás).
- **Preview y Producción comparten `DATABASE_URL`** (misma base de Railway): el
  build del Preview de cada PR ya corre `prisma migrate deploy` sobre la base
  real, así que las migraciones se aplican al abrir el PR (Producción las salta
  por idempotencia). Tenlo en cuenta con migraciones que reescalan datos.
- **Escalas:** dificultad del álbum 1-5 (estrellas); impacto cultural 1-100
  (honesto, con leyenda + `impactNote` clicleable); puntaje del usuario 1-10
  (umbral "loved" = 8). Migraciones ya reescalaron datos viejos.
- **Entrada = onboarding (6.7):** sin perfil NO se muestra ningún disco; la home
  redirige a `Onboarding`. Si tocas ese gate, recuerda que `DeviceSync` refresca
  una vez al inicio (no rompe el onboarding porque ocurre antes de interactuar).
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
