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
Fase 8 casi cerrada (falta 8.6), Fase 9 EN CURSO y Fase 10 —el rediseño «La
imprenta»— completada** (ago 2026). La fase de trabajo sigue siendo la 9.

- **Fase 8 — Caminos**: "por dónde entrar a un género". Una secuencia de 5
  discos en orden pedagógico, en **pestaña aparte** (`/caminos`).
- **Fase 9 — El Salón de la Fama** (`/salon`): los discos del canon con un
  puntaje 1-100 **comparable entre sí**, y el dial "dame un disco de 95". El
  puntaje NO lo escribe ningún LLM (sale de datos duros y de calibrar por
  percentil contra todo el índice) y el índice tiene miles de discos **sin**
  fabricarles dossier: la historia se hace perezosa al tocarlos.
- **Fase 11 — «Conociendo a…», el atlas** (`/atlas`): entrar a la música por un
  LUGAR. Eliges un país y son cinco discos que cuentan algo de él (raíz · himno
  · cruce · grito · ahora). Los propone el curador y **a cada artista se le
  comprueba el origen** con la barrera de la 7.11; lo que no se puede confirmar
  se enseña diciéndolo. El retrato es global por país, no de cada oyente.

En las tres, el disco del día NO se toca. Ver las decisiones de diseño en el
ROADMAP antes de tocar nada de estas fases.

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

## El sistema visual: LA IMPRENTA (léelo antes de tocar UI)

Musicart **no se ve como una app: se ve como una publicación impresa**. Esto no
es decorativo — nace de una orden explícita del dueño: *"todas las apps se ven
iguales, se nota que las hizo una IA, quiero algo distinto"*. Tenía razón, y lo
que las iguala es un repertorio concreto de gestos. **Esos gestos están
prohibidos aquí.**

**Lo prohibido** (es literalmente la plantilla): esquinas redondeadas · tarjetas
flotando con `border-white/10` + `bg-white/[0.03]` · botones en pastilla ·
acentos con halo/glow difuminado · iconitos de línea de 24px · emojis como
iconos · todo centrado · Inter.

**Las siete reglas** (están al completo, con su porqué, en la cabecera de
`src/app/globals.css`, y en vivo con especímenes en la ruta **`/prensa`**):

1. Cero esquinas redondeadas (hay un barrido global; lo que de verdad es un
   círculo lleva `.circulo`).
2. Cero tarjetas: estructuran las **reglas** (`.regla`, `.filete`,
   `.cabecera-seccion`), el aire y la jerarquía. Para destacar se **enmarca**
   (`.recuadro`).
3. Dos **ediciones**, no dos "modos": la de noche (por defecto) y la de día
   (papel prensa). Cambian por cookie, igual que antes.
4. La tipografía es la interfaz: **Fraunces** (display: titulares y cifras) ·
   **Archivo** (texto) · **IBM Plex Mono** (`.dato`: todo lo que es número o
   referencia). Rótulos con `.rotulo`, cifras con `.cifra`.
5. Los botones son sellos: `.sello` y `.sello-hueco`.
6. Nada de emojis: adornos tipográficos (`.calderon`, `.capitular`, números
   romanos, puntos conductores con `.puntos`).
7. Lo que se numera, se numera: folios `№ 03`, escalafones `01 02 03`, láminas
   con pie de figura.
8. **LA ERGONOMÍA MANDA, y gana a las siete de arriba.** Se añadió tras la
   primera tirada, cuando el dueño la vio en el teléfono: *"se ve tosca, no se
   ve interactiva"*. Tenía razón: llevé la lógica del papel al dedo. Un teléfono
   no se sostiene a 30 cm ni imprime a 1200 dpi, y **el `hover` no existe** —al
   quitar las tarjetas quité también los estados, y la interfaz quedó muerta al
   tacto. Las cuatro leyes: **(a)** nada tocable por debajo de 48px de alto
   (`.sello` 52 · `.fila` 60 · pestaña 60 · recuadro tocable 44); **(b)** todo
   responde al dedo en el acto (`:active`, nunca solo `:hover`); **(c)** ningún
   cuerpo por debajo de 11px —y los campos de texto a 16px o iOS hace zoom
   solo—; **(d)** lo pulsable parece pulsable (`.fila-avanza` pone su `›`, el
   sello lleva su relieve). Las clases táctiles son `.sello`, `.sello-hueco`,
   `.fila`, `.fila-avanza` y `.pulsable`: **úsalas en vez de inventar una fila
   nueva**. Y la barra de pestañas lleva iconos: su forma es convención de
   plataforma, no plantilla — pelearla costó usabilidad sin ganar identidad.

**Color:** usa `--acento` / `text-album` (que ya apunta a él), **nunca**
`--album-vibrant` directo: el acento deriva de la portada del día pero se
entinta según la edición, y sin eso el dorado desaparece sobre papel claro.

**Estado de la migración:** hechas a mano `layout` + `Cabecera` (folio corrido)
· `BottomNav` (pie de imprenta) · home/`DailyReveal` · `/caminos` ·
`/salon` (+ `GaleriaCanon`, `SelloPuntaje`, `Dial`, la ficha
`/salon/disco/[id]` y `AbrirDisco`) · `/explorar` +
`PuertasExplorar` · `ThemeToggle` · `GenreTags` · `/prensa`. El resto de
pantallas (dossier, diario, perfil, onboarding, revisión, vitrina, rebobinada,
dueto) heredan paleta, tipografías y el barrido de esquinas, pero **conservan
estructura de la época de la plantilla**: si tocas una, aprovecha y compónla con
el sistema.

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
                         Camino (Fase 8: tema, titulo, intro, stepsJson, status),
                         RetratoPais (Fase 11: el retrato de un país — uno por
                         código ISO, global; status listo|vacio + nota),
                         CanonAlbum (Fase 9: el índice del canon — score 1-100
                         calibrado, raw, locked, signalsJson, evidenceJson).
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
                         viven en /api/caminos/crear (maxDuration 300) y
                         /api/caminos/paso (300), como el disco del día.
src/app/salon/           Fase 9: El Salón de la Fama. Muro de los 100/100, el
                         DIAL ("dame un disco de 95"), pisos, canon con acento
                         (país/género), /salon/lista con filtros y
                         /salon/disco/[id] con los recibos del puntaje. La
                         fabricación del dossier vive en /api/salon/abrir
                         (maxDuration 300), como el disco del día.
                         /api/salon/construir (9.10, maxDuration 300): levanta el
                         índice por tramos desde el panel, sin terminal.
                         admin-actions.ts + CuradorCanon (9.7): fijar/soltar un
                         puntaje a mano (locked), añadir al canon lo que el
                         índice no trajo, quitar lo que se coló. Vista de
                         conjunto en /revision (ClubDeLosCien).
                         Compartir (9.9): opengraph-image.tsx de la sección y de
                         cada disco ("soy un 96/100", con su recibo).
src/app/atlas/           Fase 11: el Atlas. /atlas es el ÍNDICE por regiones con
                         buscador (no un desplegable de 195 países: en un
                         teléfono es scroll infinito) y /atlas/[code] el retrato.
                         Las dos operaciones caras viven en /api/atlas/retrato
                         (maxDuration 300) y /api/atlas/disco (300), como el
                         disco del día. Sus opengraph-image comparten el retrato
                         (11.6). Si el perfil dice de dónde eres, tu país sale
                         primero (11.7).
src/lib/imprenta-og/     Las tipografías (.ttf) de TODAS las imágenes sociales:
                         ImageResponse no ve el next/font de la app y sin ellas
                         pinta con la grotesca de fábrica. Imagen social nueva =
                         añadirla al outputFileTracingIncludes de next.config.
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
src/lib/pedido-match.ts  Lee el pedido del oyente SIN IA (cruza sus palabras con
                         artista, título, etiquetas y década). Es la red de abajo:
                         el día que el LLM no responde o se acaba el tope, el
                         pedido seguía existiendo pero no lo leía nadie.
src/lib/origin-guard.ts  Fase 7.9 + 7.11: barrera dura del ORIGEN del artista — si el
                         pedido nombra un país ("artistas venezolanos"), comprueba
                         que el artista lo sea EN TRES FUENTES por orden de
                         fiabilidad (MusicBrainz → Wikidata → primera frase de la
                         Wikipedia; la primera que sabe gana, las de respaldo con
                         tope de 6 s). Si no lo es, se descarta la propuesta y se
                         pide otra; ante la duda, deja pasar. El orden vive en el
                         array FUENTES: añadir una cuarta es añadirla ahí.
                         diagnosticoDeOrigen() las prueba TODAS (lo usan el botón
                         de /revision y npm run probar:origen).
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
src/lib/paises.ts        Fase 11: LA GEOGRAFÍA, en un solo sitio — 192 países en
                         15 regiones, con gentilicios (es/en) y áreas de
                         MusicBrainz. La lee el Atlas (para ofrecer países) y
                         origin-guard (para detectar y verificar). Si añades un
                         país, va aquí y solo aquí.
src/lib/atlas.ts         Fase 11: motor del Atlas — retratoDePais() (propone con
                         UNA llamada, verifica el origen de los 5 artistas,
                         descarta a los que no son de ahí y guarda el retrato
                         GLOBAL por país), abrirDiscoDelAtlas() (dossier perezoso
                         con el tope 6.6). Guarda también el fracaso, con la
                         razón escrita por el CÓDIGO y sin reintentar en 24 h.
src/lib/atlas-tipos.ts   Fase 11: la parte PURA (papeles, tipos). Aparte por lo
                         mismo que caminos-pasos.ts: la UI de cliente no puede
                         importar el motor sin arrastrar el pipeline.
src/lib/caminos-pasos.ts Fase 8: la parte PURA (tipos, etiquetas de papel,
                         pasoAbierto/pasoActual). Existe aparte porque la UI de
                         cliente no puede importar caminos.ts (arrastra el
                         pipeline → jimp → `fs` y rompe el build).
src/lib/canon/           Fase 9: el Salón de la Fama. AQUÍ NO ENTRA NINGÚN LLM.
  score.ts                 PURO (sin red ni DB): prestigioBruto() pondera las
                           señales duras, calibrar() reparte el 1-100 por
                           percentil contra TODO el índice (la curva hace que el
                           100 sea ~0,4%), recibos() y pisoDe(). Es lo que arregla
                           el defecto de Album.impact: ese no es comparable entre
                           discos, este sí.
  ingest.ts                construirIndice() (Wikidata → señales → prestigio →
                           recalibrar), recalibrar(), enlazarConCatalogo(),
                           rellenarPortadas() y avanzarSalon() (9.10: un tramo
                           de construcción con presupuesto de tiempo, reanudable
                           — lo llaman el botón de /revision y el worker).
  consulta.ts              Lectura de la pestaña: muro, pisos, listarCanon con
                           filtros, discoDePuntaje() (el dial, personalizado sin
                           IA) y progresoDelOyente(). Sin import del pipeline.
  abrir.ts                 abrirDiscoDelCanon(): fabricación perezosa del dossier
                           con el tope 6.6. Va aparte de consulta.ts porque
                           importar el pipeline arrastra jimp → `fs` (mismo motivo
                           que caminos.ts vs caminos-pasos.ts).
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
src/lib/sources/         Clientes de las APIs externas (+ wikidata.ts en Fase 9:
                         SPARQL para el universo del canon y sus premios).
src/lib/types.ts         Tipos de dominio (FactsPayload, DossierContent, Palette…).
src/lib/merge-device.ts  Fusión Profile/Reviews/DailyPicks al iniciar sesión.
src/lib/device.ts        Identidad anónima por dispositivo (localStorage + cookie
                         musicart_device para personalizar en el servidor).
src/lib/theme.ts|palette.ts  Theming de la UI con la paleta de la portada.
src/components/          BottomNav (9.8: SOLO 4 pestañas — Hoy · Explorar ·
                         Diario · Perfil; Caminos/Salón/Atlas/Vitrina viven
                         dentro de /explorar vía PuertasExplorar, que explica en
                         qué se diferencian. No añadas pestañas sin quitar otra),
                         Onboarding (entrada por pasos, 6.7), CreandoDiscoHoy (carga
                         del disco fresco), RehacerDiscoAdmin, DailyReveal,
                         ImpactoCultural + DificultadEscucha (clicleables),
                         ReflectionForm (1-10 + comentario + canción favorita),
                         MoodCheckin, ShareAlbum, DeviceSync, Narrator, AlbumChat,
                         DuetPanel, PushToggle, ProfileForm (11.7: guarda country,
                         ISO-2, opcional), Compartir (el sello de compartir de
                         todas las secciones), InstallPrompt…
src/app/explorar/        Rutas temáticas (Fase 4.4) + PuertasExplorar (sumario).
src/app/prensa/          El libro de estilo EN VIVO: las siete reglas y sus
                         especímenes (sellos, cifras, escalafón, índice,
                         capitular). Sin datos ni base: siempre renderiza.
src/components/Cabecera.tsx  El folio corrido de la publicación (va en el layout).
scripts/dossier.ts       CLI: npm run dossier -- "Álbum" "Artista" --publish
scripts/worker.ts        Worker del catálogo (cron Railway): npm run worker.
                         Además mantiene el Salón (9.10): levanta/termina el
                         índice, lo refresca cada 7 días y busca portadas.
```

## Comandos

```bash
npm run dev          # desarrollo (requiere DATABASE_URL en .env)
npm run build        # prisma migrate deploy && next build
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed idempotente (manual; el build ya no siembra)
npm run dossier -- "Álbum" "Artista" --publish   # generar un dossier (CLI, requiere API key)
npm run worker -- --batch 2                      # corrida del worker de catálogo (curador + pipeline)
npm run probar:origen -- "Sentimiento Muerto" "rock venezolano"  # ¿saben las tres fuentes de dónde es? (7.11, sin IA)
npm run probar:paises                            # la tabla de países y cómo se lee (11.1; sin red, sin base)
npm run canon                                    # construye el índice del canon (Fase 9; sin IA, ~1000 discos)
npm run canon -- --limite 150                    # corrida corta de prueba
npm run canon -- --portadas 200                  # solo rellenar carátulas pendientes
npm run canon -- --recalibrar                    # solo recalcular puntajes (sin red)
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
- **Dos números de 1-100 que NO son lo mismo** (Fase 9): `Album.impact` es el
  impacto cultural que la IA escribe *dentro* de un dossier — sirve para contar
  ese disco, pero NO es comparable entre discos (se asigna sin ver a los demás).
  `CanonAlbum.score` es el puntaje del Salón: sale de datos duros y de calibrar
  por percentil contra todo el índice, así que ahí un 91 sí significa siempre lo
  mismo. No los mezcles ni los sincronices sin pensarlo: miden cosas distintas.
- **`npm run canon` no corre en Vercel ni en sandboxes sin red**: habla con
  Wikidata, Last.fm y Deezer, y tarda minutos. Es un script de mantenimiento
  (como el worker), no una ruta. Desde la app el índice se levanta **a tramos**
  (botón "Levantar el Salón" en `/revision` → `/api/salon/construir`, con
  presupuesto de tiempo) y el worker de Railway lo termina de noche: el Salón ya
  no depende de que alguien tenga una terminal delante.
- **La app nunca se cae por la IA, pero tampoco puede MENTIR**: si el disco no
  se pudo fabricar (sin clave, tope agotado, reloj agotado, no encontré nada),
  la razón del día abre diciéndolo — `CausaFallback` + `avisoPorCausa` en
  `recommend.ts`, escrito por el CÓDIGO (el verificador es LLM y suele ser justo
  lo que está caído). Sin eso, un fallo de IA se vive como "la app dejó de leer
  lo que le pido": disco de siempre, en tres segundos y sin explicación. Para
  saber si el curador está vivo hay un botón en `/revision` (no hace falta
  terminal ni logs de Vercel).
- **El tope diario (6.6) es compartido** entre el disco del día, el Salón, los
  Caminos y los saltos, con un 30% RESERVADO para el disco del día
  (`hayPresupuestoHoy(date, "extra" | "ritual")`). Curiosear el Salón ya no deja
  al ritual sin cupo.
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
