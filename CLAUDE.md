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
prisma/schema.prisma     Modelos: Artist, Album, Dossier, TrackNote, Profile,
                         DailyPick (tiene campo `reason`!), Review.
                         Campos *Json son String (portabilidad).
prisma/seed.ts           Seed idempotente con 3 discos demo (corre en el build).
src/app/page.tsx         Home: el ritual diario (force-dynamic).
src/app/album/[id]/      Dossier completo del disco.
src/app/diario/          Historial de escuchas con racha (client + server actions).
src/app/perfil/          Onboarding ligero (client + server actions).
src/app/actions.ts       Server actions: saveReview, getReview, saveProfile, getJournal.
src/lib/daily.ts         Pick global del día (rotación determinista). La Fase 1
                         lo reemplaza por pick personalizado con fallback a esto.
src/lib/db.ts            Singleton de PrismaClient.
src/lib/dossier/         Pipeline anti-alucinación:
  facts.ts                 reúne hechos (MusicBrainz, Wikipedia, Last.fm, iTunes, Odesli)
  generate.ts              LLM narra SOLO sobre el FactsPayload
  verify.ts                LLM verificador caza inventos + validadores duros
  pipeline.ts              orquesta: facts → generate → verify → save (draft|published)
  llm.ts                   adapter OpenAI/Anthropic (env: LLM_PROVIDER, LLM_MODEL)
src/lib/sources/         Clientes de las APIs externas.
src/lib/types.ts         Tipos de dominio (FactsPayload, DossierContent, Palette…).
src/lib/device.ts        Identidad anónima por dispositivo (deviceId en localStorage).
src/lib/theme.ts|palette.ts  Theming de la UI con la paleta de la portada.
src/components/          DailyReveal, Narrator (voz), ReflectionForm, ListenLinks…
scripts/dossier.ts       CLI: npm run dossier -- "Álbum" "Artista" --publish
```

## Comandos

```bash
npm run dev          # desarrollo (requiere DATABASE_URL en .env)
npm run build        # prisma migrate deploy && prisma db seed && next build
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed idempotente
npm run dossier -- "Álbum" "Artista" --publish   # generar un dossier (CLI, requiere API key)
```

## Entornos y despliegue

- **Producción:** Vercel, rama **`master`** (configurada a mano en Vercel
  Settings; el repo usa `master`, NO `main`). Cada push a master despliega.
- **Base de datos:** PostgreSQL en **Railway**. Vercel se conecta con la URL
  **pública** (`...proxy.rlwy.net:PUERTO/railway`) en `DATABASE_URL`
  (Production + Preview). La URL interna `railway.internal` solo sirve para
  servicios dentro de Railway (útil para el futuro worker de la Fase 2).
- **El build siembra la base** (`prisma db seed`, idempotente). La tarea 1.5
  del roadmap es quitarlo cuando el catálogo sea real.
- **Variables en Vercel:** `DATABASE_URL`, `OPENAI_API_KEY` (la usará el motor
  de recomendación de la Fase 1 en runtime; hoy solo la usa el CLI local).
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
  esperando revisión.
