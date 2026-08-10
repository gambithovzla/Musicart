# Musicart — Roadmap

> **Cómo usar este documento (humanos e IA):** este es el plan maestro del producto.
> Cada fase tiene tareas con checkbox y criterios de aceptación. La fase marcada
> **🔨 EN CURSO** es la que se está construyendo; no saltes de fase sin confirmar
> con el dueño del producto. Al completar una tarea, marca su checkbox en el mismo
> commit que la implementa.

## La visión (norte del producto)

Musicart empaqueta la experiencia de caer en una madriguera musical con una IA:
ves una película de Michael Jackson, preguntas cómo se hizo *Thriller*, saltas a
su rivalidad con Prince, de ahí a The Beatles y descubres que duraron menos de
10 años juntos y ninguno llegaba a 30 al separarse. Ese "click" de descubrimiento,
**curado y verificado por IA, un disco al día, personalizado para ti**.

Principios:

1. **La IA hace todo el trabajo de curaduría.** El usuario no sube música ni
   discos; el catálogo crece solo y las recomendaciones se generan solas.
2. **Cada recomendación explica su porqué.** "Por qué este disco, para ti, hoy"
   — conectado a tu historial, tus gustos y tu ánimo de hoy.
3. **Nada de datos inventados.** Toda narrativa pasa por el pipeline
   anti-alucinación (hechos de MusicBrainz/Wikipedia → LLM narra solo sobre
   ellos → verificador caza inventos). Si no verifica, no se publica.
4. **El diario alimenta la máquina.** Lo que escuchas y puntúas ajusta lo que
   se te recomienda mañana ("escuchaste Confessions; Bruno Mars suena parecido,
   te podría gustar este disco por esto").
5. **El mood importa.** El usuario puede decir "hoy me siento así" y la
   recomendación se adapta.

---

## ✅ Fase 0 — MVP en producción (COMPLETADA · junio 2026)

La base: el ritual diario funciona en producción para todos los usuarios
(mismo disco global por día, rotación determinista).

- [x] App Next.js 15 (App Router, PWA móvil-first, Tailwind 4, Framer Motion)
- [x] Modelo de datos completo (Artist, Album, Dossier, TrackNote, Profile, DailyPick, Review)
- [x] Pipeline anti-alucinación por CLI (`npm run dossier`) con verificación y drafts
- [x] Ritual diario: reveal del disco con paleta de la portada, dossier, narración por voz, deep links
- [x] Reflexión post-escucha → Diario con racha; Perfil de onboarding (anónimos por deviceId)
- [x] Migración SQLite → PostgreSQL (Railway) para producción serverless
- [x] Deploy en Vercel: `master` = producción, `DATABASE_URL` configurada, migraciones + seed automáticos en el build
- [x] 3 dossiers de demostración sembrados (Continuum, Rumours, El Mal Querer)

---

## ✅ Fase 1 — El cerebro recomendador (COMPLETADA · junio 2026)

**Objetivo:** que al abrir la app, la recomendación sea *tuya*: la IA elige un
disco del catálogo según tu perfil + tu diario + tu ánimo de hoy, y escribe el
"por qué este disco, para ti, hoy". Sin login todavía: se apoya en la identidad
anónima por dispositivo que ya existe.

**Por qué primero:** es la magia del producto y todas las piezas de datos ya
existen (`Profile`, `Review`, `DailyPick.reason` ya anticipa esto). Es una
llamada corta de LLM en runtime — rápida y barata — porque los dossiers ya
están pre-generados.

### Tareas

- [x] **1.1 Motor de recomendación** (`src/lib/recommend.ts`)
  - Server-side. Input: perfil del device, últimas N reviews (con ratings),
    mood de hoy (opcional), catálogo de dossiers publicados (título, artista,
    año, tags/facts resumidos), historial de DailyPicks recientes (no repetir).
  - Una llamada al LLM (adapter existente `src/lib/dossier/llm.ts`, ya soporta
    OpenAI/Anthropic) que devuelve JSON: `{ albumId, reason }`.
  - El `reason` debe citar señales reales del usuario ("le diste 5★ a X",
    "dijiste que buscas la historia") — el prompt incluye solo datos reales.
  - Guardar en `DailyPick` (deviceId + date + albumId + reason). Cache: una
    recomendación por device por día; si ya existe, se devuelve la guardada.
- [x] **1.2 Check-in de mood** en la home
  - UI ligera antes/sobre el reveal: "¿Cómo te sientes hoy?" (chips: enérgico,
    nostálgico, relajado, curioso, melancólico… + skip).
  - El mood del día se guarda (campo en DailyPick o nuevo modelo MoodCheckin)
    y entra como señal al motor 1.1. Si el usuario cambia el mood, se puede
    regenerar el pick del día (máx. 1 regeneración para controlar costo).
- [x] **1.3 Home personalizada**
  - La home usa el pick personalizado del device (si hay perfil/historial) y
    muestra el `reason` destacado en el reveal.
  - Usuario nuevo sin señales → rotación global actual como fallback, con
    invitación a llenar el perfil ("dinos quién eres y mañana será para ti").
- [x] **1.4 Resiliencia y fallback**
  - Sin `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, timeout o error del LLM → cae a
    la rotación global sin romper la página (nunca un 500 por culpa de la IA).
  - `LLM_PROVIDER`/`LLM_MODEL` respetados; key leída en runtime de Vercel.
- [x] **1.5 Limpieza de build**
  - Quitar `prisma db seed` del comando `build` (ya no hará falta sembrar en
    cada deploy una vez el catálogo sea real).

### Criterios de aceptación

- Dos dispositivos con perfiles/historiales distintos reciben el mismo día
  discos distintos (o el mismo con razones distintas y coherentes).
- El `reason` menciona señales verificables del usuario, nunca datos inventados
  del álbum (solo lo que está en `factsJson`/dossier).
- Con la API key quitada, la app sigue funcionando (rotación global).
- Latencia del pick personalizado < 5 s en frío; instantáneo si ya existe el
  pick del día (cache en DailyPick).

### Variables de entorno (Vercel)

`OPENAI_API_KEY` (ya configurada) · opcional `LLM_PROVIDER=openai` ·
opcional `LLM_MODEL` (default `gpt-4o-mini`).

---

## ✅ Fase 2 — Catálogo que crece solo (COMPLETADA · junio 2026)

> **Estado (11-jun-2026):** primera corrida validada en producción. El worker
> encoló vía curador IA, generó y publicó *Abbey Road*, *The Dark Side of the
> Moon* y *La leyenda del tiempo* (catálogo: 3 → 6 publicados). Panel
> `/revision` operativo. Respaldo `bootstrapCatalogQueue` si el curador falla.
> Cron Railway 06:00 UTC + `npm run worker` manual con `DATABASE_URL` de Railway.

**Objetivo:** que el catálogo pase de 3 discos demo a una biblioteca real sin
intervención humana. La IA decide qué generar; el pipeline existente genera y
verifica; solo lo verificado se publica.

### Tareas

- [x] **2.1 Curador IA** (`src/lib/curator.ts` o en el worker)
  - LLM propone los próximos álbumes a generar: clásicos imprescindibles +
    huecos del catálogo + afinidades con lo que los usuarios puntúan alto.
  - Lista priorizada persistida (nuevo modelo `GenerationQueue` o similar).
  - Bootstrap de clásicos fijos si el curador falla (`bootstrapCatalogQueue`).
- [x] **2.2 Worker de generación** — decisión tomada: **Opción A (Railway)**.
  `scripts/worker.ts` (`npm run worker`) corre como cron en Railway:
  - **Opción A (recomendada): worker en Railway** (ya existe un sidecar de
    Python en la infraestructura del dueño; puede ser un servicio Node con
    `tsx` reutilizando el pipeline TS tal cual, corriendo como cron de Railway).
    Sin límites de timeout, mismo Postgres interno (URL privada, sin egress).
  - **Opción B: Vercel Cron** + route handler con `maxDuration` alto. Más
    simple de desplegar, pero limitado en tiempo de ejecución.
  - El worker toma N items de la cola por corrida nocturna, ejecuta
    `runDossierPipeline(..., { publish: true })`, registra resultados.
  - Validación de entorno al arrancar (`DATABASE_URL` Postgres + API key).
- [x] **2.3 Control de calidad**
  - Los dossiers que no pasan verificación quedan `draft` (ya implementado);
    endpoint/listado simple para revisarlos y publicarlos a mano.
  - Alertas básicas: si una corrida falla todo, que quede registrado (log o
    notificación).
  - **Generar a demanda desde el panel**: dos caminos en `/revision`.
    (a) Un botón "Que la IA elija y cree un disco": el curador decide qué falta
    (huecos, ratings, diversidad) y lo genera en vivo, sin que el dueño escriba
    nada (`generarDiscoSugerido` — una corrida del worker a mano).
    (b) Manual opcional: escribir disco + artista (`generarAlbumAhora`).
    Ambos publican si pasan la verificación; red de seguridad en la cola por si
    el live se corta (timeout). Aprovecha `maxDuration=300`.
- [x] **2.4 Hilos de descubrimiento** (la madriguera MJ → Prince → Beatles)
  - Cada dossier sugiere 2-3 "saltos": rivalidades, colaboraciones, influencias
    ("de aquí puedes saltar a…"), verificados contra los facts.
  - UI: al final del dossier, tarjetas de salto que llevan a otros álbumes del
    catálogo (o alimentan la cola de generación si aún no existen).

### Pendiente del dueño (infra, una sola vez)

- [x] Crear el servicio cron del worker en Railway (pasos exactos en el README,
  sección "El catálogo crece solo"). Hecho: servicio "Musicart" Ready, cron
  06:00 UTC, configurado por `railway.json`.
- [x] Definir `ADMIN_SECRET` en Vercel (protege el panel `/revision`).
- [x] Primera corrida real del worker (manual o cron) con catálogo creciendo.

### Criterios de aceptación

- [x] El catálogo crece solo (≥ N discos/semana sin tocar nada).
- [x] Nada se publica sin pasar la verificación anti-alucinación.
- [x] Los saltos de descubrimiento solo afirman relaciones respaldadas por facts.

---

## ✅ Fase 3 — Cuentas reales (COMPLETADA · junio 2026)

**Objetivo:** el usuario inicia sesión y su historia lo sigue en cualquier
dispositivo.

### Tareas

- [x] **3.1 Auth.js** (Google + email) sobre Next.js App Router
  - Modelos Prisma: `User`, `Account`, `Session`, `VerificationToken`.
  - Rutas `/api/auth/[...nextauth]` y pantalla `/entrar`.
  - Variables: `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`;
    email opcional: `AUTH_RESEND_KEY`, `EMAIL_FROM`.
- [x] **3.2 Fusión de identidad** al iniciar sesión
  - Fusionar `Profile`, `Review` y `DailyPick` del `deviceId` actual con el
    `User` (sin perder diario ni racha) — `/entrar/completado`.
- [x] **3.3 Sesión multi-dispositivo**
  - El motor de recomendación y el diario leen por `userId` cuando hay sesión;
    `deviceId` sigue como fallback anónimo. Mismo pick del día en todos los
    dispositivos de la cuenta.
- [x] **3.4 Privacidad**
  - Export (JSON descargable) y borrado de datos desde `/perfil` — cuenta o
    dispositivo anónimo.

### Criterios de aceptación

- [x] Iniciar sesión en el móvil y en el desktop muestra el mismo diario y pick coherente.
- [x] Usuario anónimo sigue funcionando igual si no entra.
- [x] Tras login, el perfil y las reseñas del device actual quedan ligados a la cuenta.
- [x] El usuario puede descargar y borrar sus datos desde el perfil.

---

## ✅ Fase 4 — Producto pulido y monetización (COMPLETADA · junio 2026)

### Tareas

- [x] **4.1 TTS calidad podcast** — `npm run tts` genera MP3s (OpenAI `tts-1-hd`)
  en `public/audio/` y actualiza `audioJson`; narrador híbrido MP3 + Web Speech
- [x] **4.2 Modo conductor** — narración continua + Media Session API (controles en
  pantalla de bloqueo, saltar secciones)
- [x] **4.3 Tarjetas compartibles** — botón compartir en home y dossier; OG image
  por álbum; Web Share API + copiar enlace
- [x] **4.4 Rutas temáticas** — `/explorar` con colecciones curadas (jazz, rock,
  español, calma…)
- [x] **4.5 Stripe freemium** — 5 dossiers/mes gratis; Pro ilimitado vía Stripe Checkout
- [x] **4.6 Analytics** — panel de métricas en `/revision` (usuarios, lecturas,
  reseñas, Pro, freemium, top álbumes, moods)

### Criterios de aceptación (parcial)

- [x] El usuario puede compartir su disco del día o un dossier con un enlace que
  se ve bien en redes (OG image).
- [x] La narración funciona en modo conductor con controles del sistema.
- [x] Hay al menos 3 rutas temáticas navegables con discos del catálogo.
- [x] Los dossiers publicados pueden narrarse con voz podcast (MP3 pre-renderizado)
  cuando existe `audioJson`; si no, cae a Web Speech del navegador.
- [x] Plan gratis con límite mensual de dossiers; el disco del día no cuenta; Pro
  desbloquea lecturas ilimitadas.
- [x] El admin ve métricas de producto agregadas en el panel de revisión.

---

## ✅ Fase 5 — La magia que retiene (completa)

**Objetivo:** convertir el ritual en hábito y el hábito en suscripción. Cada
feature usa los datos que ya guardamos y respeta el pipeline anti-alucinación.

### Tareas

- [x] **5.1 Notificación ritual** — Web Push diaria con tu disco del día
  (toggle en Perfil, `npm run push` para el cron, claves VAPID)
- [x] **5.2 Rebobinada mensual** — `/rebobinada`: carta IA del mes pasado
  (cacheada) o resumen vivo del mes en curso; enlace desde el diario
- [x] **5.3 Conversar con el disco** — chat en el dossier con FactsPayload,
  límites diarios (3/día gratis, 15 Pro), filtro anti-abuso sin LLM
- [x] **5.4 El hilo de tu vida musical** — la IA conecta tus reseñas entre sí
  en el diario ("este disco nace de la misma ruptura que aquel")
- [x] **5.5 Modo dueto** — cuenta vinculada con otra persona: un disco
  compartido a la semana elegido por la intersección de gustos
- [x] **5.6 Racha con alma** — si te alejas, el pick del regreso llega con
  cariño ("te guardé algo especial"); sin gamificación vacía
- [x] **5.7 La madriguera** — al terminar el disco del día, la home te ofrece
  2-3 discos conectados para seguir explorando el catálogo (sin tocar el ritual
  de UN pick al día). Reutiliza los saltos de descubrimiento del dossier (ya
  verificados); sin IA en runtime, determinista (`src/lib/madriguera.ts`)

### Criterios de aceptación

- [x] El diario muestra un hilo narrativo cuando hay ≥2 reseñas (cacheado; solo
  regenera si cambia el diario).
- [x] Dos cuentas pueden vincularse por código y ver un disco semanal en `/dueto`.
- [x] Tras ≥4 días sin pick (con ritual previo), la home saluda el regreso sin
  culpa ni gamificación vacía.
- [x] Al terminar el disco del día, la home muestra discos conectados para
  seguir explorando; si el dossier no tiene saltos publicados, completa por
  afinidad de etiquetas y, si no hay catálogo, se omite sin romper.

---

## ✅ Fase 6 — Que se sienta "un amigo que te conoce" (COMPLETADA · jun 2026)

**Objetivo:** matar la sensación de "precargado". Que desde el primer momento el
disco se sienta elegido para ti, no una rotación genérica.

### Tareas

- [x] **6.1 Onboarding de gustos** — el perfil pregunta géneros (chips) y
  artistas favoritos (autocompletado con foto vía Deezer, `/api/artists`).
  El motor los pondera con fuerza
  (regla 7 del prompt) y, si la IA se cae, `elegirPorGusto` elige por afinidad
  (géneros + artistas + diario 8/10) en vez de la rotación global: un rockero ya
  no recibe una balada.
- [x] **6.2 Conectar Spotify** — login con Spotify (Auth.js ya guarda tokens en
  Account) + leer top artists/tracks/géneros para alimentar el motor con gustos
  reales. Requiere app de Spotify del dueño (modo dev limitado a 25 usuarios
  hasta aprobación). **Oculto al público** hasta `SPOTIFY_PUBLIC=true` en Vercel
  (junto con `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`). YouTube Music no
  tiene API de historial; Apple Music posible después.
- [x] **6.3 Dossier más rico** — la IA siempre escribe nota canción-por-canción
  + un bloque de curiosidades verificadas contra el FactsPayload (`wowFactsJson`,
  sección "Lo que no sabías" en el dossier).
- [x] **6.4 Disco fresco cada día (no de los sembrados)** — el disco del día se
  FABRICA al momento para cada usuario: la IA propone un disco real de toda la
  música grabada (según gusto + diario + ánimo, evitando lo ya mostrado/reseñado)
  y el pipeline lo investiga, narra, verifica y publica —en vez de elegir de un
  catálogo cerrado de discos sembrados (`src/lib/discover.ts`,
  `generarPickDelDia` en `src/lib/recommend.ts`). Como tarda 1-3 min, corre en su
  propia route (`/api/pick-hoy`, `maxDuration=300`) con pantalla "Estamos creando
  tu disco de hoy" (`CreandoDiscoHoy`); al terminar, la home se refresca y lo
  muestra. Cae a catálogo/rotación si la IA falla (la app nunca se cae) y el
  disco recién hecho queda cacheado (el catálogo crece con discos personalizados).
  Solo se fabrica a quien tiene señales de gusto (perfil o diario); sin señales,
  rotación global. Botón solo-admin "Rehacer mi disco de hoy" (`RehacerDiscoAdmin`)
  para regenerar a voluntad — el control del dueño sobre el disco de cada día.
- [x] **6.5 Reseña más expresiva + rankings honestos** — el puntaje del usuario
  pasó de 1-5 a **1-10** (escala más amplia para puntuar mejor); el formulario de
  reseña gana una **caja de comentario libre** ("escribe lo que quieras del
  disco") y un **selector de canción favorita** del tracklist. Ambos se guardan en
  el diario y alimentan la memoria del curador (entran al prompt del motor con
  etiqueta legible; claves en `src/lib/review.ts`). El **Impacto cultural** ahora
  muestra su **leyenda** junto al número (90+ hito, 75+ clásico mayor, 60+ muy
  influyente, 40+ notable, <40 de nicho) tras pasar de estrellas 1-5 a 1-100
  honesto. Migraciones que reescalan datos existentes (reseñas ×2; impacto a
  1-100) para que nada se vea con la escala vieja. Además, **Impacto y Dificultad
  son clicleables** (`<details>` nativo, sin estorbar): el Impacto abre el *por
  qué* de ese disco —generado y **verificado** contra el FactsPayload, citando
  premios/certificaciones/listas reales (`Dossier.impactNote`)— y la Dificultad
  explica que mide cuánta atención pide el disco, no su calidad.
- [x] **6.6 Tope de gasto de IA** — límite diario de discos NUEVOS fabricados a
  los oyentes (`DAILY_GENERATION_BUDGET`, default 15). Al alcanzarlo, el pick del
  día cae al catálogo existente (sin costo de generación), sin romper la
  experiencia. Reutilizar un disco ya existente no consume presupuesto (el
  pipeline devuelve `reused`). No afecta lo que crea el admin ni el worker.
  Contador `GenerationBudget` por día; el panel `/revision` muestra "X/tope".
  Pensado para abrir la app a testers sin sustos (con gpt-4o-mini, ~$1-3/mes
  para 5 personas).

- [x] **6.7 Entrada = onboarding (sin disco hasta conocerte)** — quien entra sin
  perfil ya NO ve un disco genérico: va directo a un onboarding por pasos, bonito
  e interactivo (`Onboarding.tsx`), que pregunta géneros, artistas favoritos (con
  foto), un disco que te marcó, tu canción favorita, idiomas y qué buscas en un
  disco. Al terminar, guarda el perfil, fija el idioma de hoy y la home fabrica su
  PRIMER disco a su medida. Las nuevas señales (`markedAlbum`, `favoriteSong`…)
  entran al motor vía `formatPerfil` y se editan también en `/perfil`.

> **Plan acordado (jun 2026): profundidad narrativa + curiosidades "wow".**
> Diagnóstico: el texto se siente genérico por DOS causas que comparten raíz —
> (a) el modelo barato (`gpt-4o-mini`) escribe plano, y (b) a la IA solo le damos
> ~6000 chars del inicio del artículo de Wikipedia (el resumen), así que las
> anécdotas jugosas (rivalidad MJ–Prince, Jay-Z en Glastonbury tocando
> *Wonderwall*) NUNCA llegan al FactsPayload. Material pobre + modelo barato =
> texto plano. Las anécdotas SÍ son verificables; el problema es de sourcing, no
> de la regla anti-alucinación. Orden sugerido: 6.8 primero (valida la hipótesis
> del modelo, rápido), luego 6.9.

- [x] **6.8 Profundidad narrativa** — separar el modelo por tarea: un
  `GENERATION_MODEL` premium (Claude Sonnet/Opus o GPT-4o) **solo para ESCRIBIR
  el dossier** (`generate.ts`/`verify.ts` vía `llmGeneration`) — se hace una vez
  y queda cacheado, servido a todos; el `LLM_MODEL` barato sigue para lo
  frecuente (recomendar, chat). Prompt de redacción hacia narrativa vívida y
  anécdota concreta del payload. Costo acotado por el tope 6.6.
- [x] **6.9 Curiosidades y la madriguera viva** — Wikipedia profunda (secciones
  Recepción, Legado, Controversias, En vivo…) con nuggets citados en `facts[]`;
  sección "Lo que no sabías" (6.3); gancho en home tras reseñar el disco;
  saltos (`jumps`) con conexión más narrativa.

### Criterios de aceptación

- [x] El perfil captura géneros y artistas favoritos, y el primer disco tras
  el onboarding ya es personalizado (no la rotación global).
- [x] Un usuario nuevo no ve ningún disco hasta completar el onboarding; al
  terminarlo, su primer disco se fabrica a su medida.
- [x] El disco del día se genera fresco por usuario (no se saca de un catálogo
  sembrado); si la IA falla, cae a catálogo/rotación sin romper la app.

---

## ✅ Fase 7 — "Un amigo que te conoce mejor cada día" (COMPLETADA · ago 2026)

**Objetivo:** la app aprende de tu comportamiento a lo largo del tiempo y se
integra más profundamente con la escucha real.

### Tareas

- [x] **7.1 IA que aprende patrones** — el motor detecta correlaciones de tu
  historial real (mood → género, géneros en racha, estación del año) y las
  inyecta como bloque "PATRONES DE ESCUCHA" en el prompt de recomendación y
  descubrimiento. Sin queries extra: usa los datos ya cargados (últimas 10
  reseñas + 7 picks). Degrada sin romper si hay poca historia.

- [x] **7.2 Escucha integrada** — botones de plataforma (Spotify / Apple Music /
  YouTube Music) directamente en la home (`DailyReveal`), antes del CTA
  "Descubrir este disco". Usa los links guardados en `Album.linksJson` con
  fallback a búsqueda vía `searchLinks` (Odesli) si aún no están resueltos.
  El dossier ya tenía `ListenLinks` en la sección 05.

- [x] **7.3 Personalización visual** — modo claro/oscuro guardado en cookie
  `musicart_theme` (duración 1 año). `layout.tsx` lee la cookie en SSR y
  aplica clase `light` a `<html>` sin flash. Paleta editorial cálida en modo
  claro (`globals.css`: `html.light { ... }`). Toggle visual en `/perfil`
  junto al push (`ThemeToggle.tsx`), propagado al `ProfileForm` via prop
  `currentTheme` desde el servidor.

- [x] **7.4 Comunidad ligera** — "Tu disco de hoy" compartible como historia
  animada. Feed opcional: ver el disco del día de un amigo (nuevo modelo de
  seguimiento, requiere privacidad explícita).

- [x] **7.5 Amplía mi mundo + pido lo que quiero** — dos ajustes para que el
  disco fresco no orbite siempre los mismos 2-3 artistas y para dar voz al
  oyente: (a) el prompt de descubrimiento (`discover.ts`) pasó de "gusto ante
  todo" a "variedad ante todo" (ensanchar género/época/país) y ahora recibe los
  artistas de días recientes para NO repetir el mismo artista; (b) el gate del
  día (`LanguageGate`) suma un paso "¿qué te apetece hoy?" con chips de género/
  ánimo + texto libre para CUALQUIER oyente; ese pedido viaja en la cookie
  `musicart_pedido` y manda al fabricar (antes era solo-admin). El rehacer del
  admin sigue con su propio cuadro.

- [x] **7.6 Curaduría del dueño + Vitrina** — el admin busca un disco o artista
  (buscador visual con portadas vía Deezer, `/api/albums`), lo toca y la IA
  fabrica su dossier completo (`generarAlbumAhora`, reutilizado). Desde el panel
  puntúa cualquier disco (1-10) y lo marca ★ para exhibirlo. **La vitrina**
  (`/vitrina`, pública, en la nav) es una galería de las carátulas que el curador
  atesora, cada una con la paleta de su portada como halo y el sello con su
  puntaje. Favoritos en `Album.showcase`/`showcaseAt`; la vitrina lee la reseña
  del admin para mostrar puntaje y canción favorita (`src/lib/vitrina.ts`,
  `src/app/revision/BuscarYCrear.tsx` + `CuradorControls.tsx` + `CuradorAlbumes.tsx`).
  La vitrina suma tres pulidos de coleccionista: **estantes temáticos**
  (`Album.showcaseShelf`, agrupa por "Jazz nocturno", etc.; editor con datalist
  en el panel), **compartir** (Web Share + `opengraph-image` con colage de
  carátulas) y **dos vistas** con toggle: galería de carátulas y **estantería de
  lomos de vinilo** coloreados con la paleta de cada disco (`VitrinaVistas`,
  `Estanteria`, `ShareVitrina`). Descubribilidad: los controles de curador
  (puntaje + ★ vitrina + estante) viven ahora en la **propia página del disco**
  (`CuradorAlbumPanel`, solo admin) y el **buscador con lupa** está también en la
  Vitrina para el admin —no solo en `/revision`.

- [x] **7.7 Anti-muletilla + el hito del día** — dos ajustes de fondo pedidos
  por el dueño. (a) El prompt que arma la "reason" del disco fresco (y su
  respaldo del catálogo) no veía qué le había dicho en días recientes, así que
  una imagen vívida del perfil se repetía como muletilla sin que el modelo lo
  supiera; ahora `recientesATexto` incluye la razón de los últimos 3 días y
  ambos prompts (`discover.ts`, `elegirConLlm` en `recommend.ts`) prohíben
  reabrir con el mismo gancho. (b) La ruta `/explorar/hitos` ("Hitos que lo
  cambiaron todo") ya filtraba por impacto cultural pero solo mostraba
  portada/artista/año; ahora destaca **un "hito del día"** que rota solo
  (misma rotación determinista que el disco del día global, `pickForDate` en
  `src/lib/daily.ts`) mostrando el **por qué** ya verificado
  (`Dossier.impactNote`) — sin IA nueva, sin costo. Cada fila de la lista suma
  también un extracto de su nota. Si ningún disco tiene su nota todavía, la
  sección se omite sin romper la página.

- [x] **7.8 Anti-muletilla, ahora en código** — la 7.7 lo intentó solo con
  prompt y no bastó: el curador seguía abriendo cada día con la misma imagen
  del perfil ("tu amor por las montañas", día tras día). Nueva barrera dura en
  `src/lib/reason-guard.ts`, hermana de `discoCumplePedido`: `ganchosQuemados()`
  saca de las razones de los últimos 5 días las palabras con carga (fuera
  conectores, vocabulario musical genérico y nombres de género — repetir "rock"
  con un rockero no es pereza) y veta las que usó ayer o dos veces o más. Esa
  lista viaja a los dos prompts (`discover.ts` y `elegirConLlm`) como prohibición
  explícita —gratis, sin llamada extra— y, ya escrita la razón, `afinarRazon()`
  la revisa: si reincide, pide **una** reescritura barata con las palabras
  vetadas. Si la reescritura falla o no mejora, se queda la original (la app
  nunca se cae por la IA). Ambos prompts dejan claro además que un detalle
  REAL suyo repetido dos días seguidos ya es muletilla, aunque sea verdad.

- [x] **7.9 El pedido se cumple ENTERO (barrera de origen)** — el dueño pidió
  "artistas venezolanos, rock" y el curador le trajo Green Day y luego Van
  Halen: cumplía el género y se saltaba el país. La causa: en todos los prompts
  el pedido se enumeraba como "género, idioma, época, estilo o energía" — el
  PAÍS no estaba en ninguna lista, y `discoCumplePedido` daba el visto bueno
  porque juzgaba solo "¿es rock?". Tres arreglos: (a) nueva barrera dura
  `src/lib/origin-guard.ts` (hermana de `reason-guard.ts`): detecta país o
  gentilicio en el pedido —distinguiendo "en inglés" (idioma) de "artistas
  ingleses" (país)— y comprueba el origen del artista propuesto con DATOS DUROS
  de MusicBrainz (`searchArtistOrigin`) antes de gastar el pipeline; si no es de
  ahí, se rechaza y se pide otra propuesta explicando por qué. Ante la duda
  (artista no encontrado, sin dato) deja pasar: la app nunca deja al oyente sin
  disco. (b) Los prompts de `discover.ts` suman país/nacionalidad como requisito
  obligatorio, dejan claro que un pedido con varias partes se cumple ENTERO, que
  el pedido manda sobre las reglas de descubrimiento y variedad, y que el idioma
  del día no puede romper el país pedido; `discoCumplePedido` juzga ahora el
  origen y ahí la duda se resuelve al revés (si no le consta, no cumple).
  (c) El respaldo del catálogo (`elegirConLlm`) prioriza el origen sobre el
  género cuando no puede cumplir todo y está OBLIGADO a reconocerlo en la
  primera frase de la razón en vez de fingir que cumplió.

### Criterios de aceptación

- [x] Usuarios con ≥3 reseñas y/o picks con mood reciben un bloque de patrones
  en el prompt; la recomendación refleja esa señal de forma notoria.
  (`patronesDeEscucha` en `recommend.ts`: cruza tags de lo que puntuó ≥8, la
  correlación ánimo→género de los picks y la estación; devuelve `null` si solo
  hay estación, así que sin historial real no se inyecta ruido. Entra a los dos
  prompts: `discover.ts` y `elegirConLlm`.)
- [x] El botón "Escuchar en Spotify/Apple/YouTube" funciona desde la home y
  el dossier en un toque, sin fricción. (`DailyReveal` pinta los tres botones
  desde `Album.linksJson`; el dossier usa `ListenLinks` en la sección 05.)
- [x] El usuario puede cambiar entre modo claro y oscuro desde el perfil y la
  preferencia persiste. (`ThemeToggle` dentro de `ProfileForm`; cookie
  `musicart_theme` a un año, leída en SSR por `layout.tsx` para que no haya
  parpadeo.)

---

## 🔨 Fase 8 — Caminos: por dónde entrar a un género (EN CURSO · ago 2026)

**Objetivo:** que el oyente pueda decir *"quiero entender el heavy metal y no sé
por dónde empezar"* y Musicart le arme **un camino de 5 discos en orden**, donde
cada paso le deja el oído listo para el siguiente.

La analogía del dueño: a alguien que nunca ha leído no le das el Quijote de
entrada, le das un Harry Potter. Pero —y esto es clave para el tono— **el camino
no esconde el Quijote: te lleva hasta él y te lo dice desde el primer paso.**
"Al final de este camino está *Reign in Blood*, y vas a poder con él." Sin eso,
la sección se siente condescendiente, que es el peor riesgo de esta idea.

**Por qué ahora:** hoy Musicart es *vertical* (un disco al día, cada uno completo
en sí mismo, sin arco entre ellos). Esto es lo primero *horizontal*: una meta a
medio plazo ("quiero entender el metal") en vez de solo un antojo del día. Y es
algo que una playlist de "essential metal" no puede dar — cualquiera lista los
discos; lo valioso es **el porqué del orden**.

### Decisiones de diseño tomadas (no re-litigar)

1. **Pestaña aparte. El disco del día NO se toca.** Decisión explícita del dueño.
   El camino vive en `/caminos` y se consume a su ritmo; el ritual diario sigue
   siendo uno y sagrado, con su propio motor intacto (`recommend.ts` no cambia).
   Efecto secundario bueno: el feature no puede romper la home.
2. **El siguiente paso se abre al marcar el anterior como escuchado.** No es solo
   control de costo (evita que un solo oyente fabrique 5 dossiers en una tarde y
   se coma el `DAILY_GENERATION_BUDGET`): es honesto con la idea. Un camino que te
   tragas de una sentada es una playlist, y el puente pedagógico ("lo que ganaste
   en el paso anterior") solo funciona si de verdad pasaste por ahí. Basta un "ya
   lo escuché" — no obligamos a puntuar, eso sería fricción.
3. **Fabricación perezosa.** Proponer el camino entero es UNA llamada de LLM
   (barata). El dossier de cada disco se fabrica el día que el oyente llega a él,
   reutilizando `runDossierPipeline`. Muchos canónicos ya estarán en catálogo →
   `reused: true` → sale gratis y no consume presupuesto.
4. **El orden NO sale de `Album.difficulty`.** Ese 1-5 lo asigna la IA disco a
   disco y no está calibrado para comparar entre discos distintos. El orden lo
   razona el proponedor del camino; la dificultad se *muestra*, no manda.
5. **`/explorar` ≠ `/caminos`.** Rutas temáticas = filtros sobre el catálogo que
   ya existe. Caminos = secuencia con orden pedagógico. Son cosas distintas y el
   copy tiene que dejarlo claro ("explora" vs "empieza por aquí") o se canibalizan.

### Tareas

- [x] **8.1 Modelo del camino** — `Camino` (deviceId/userId, tema, título, intro,
  `stepsJson`, status) + migración. Cada paso guarda `{orden, title, artist, year,
  papel, puente, albumId?, escuchadoAt?}`; `albumId` se rellena al fabricarlo.
- [x] **8.2 Motor** (`src/lib/caminos.ts`) — `proponerCamino()`: una llamada al
  LLM que devuelve 5 pasos, cada uno con su **papel** (la puerta · el gancho ·
  el canon · el desvío · la cima) y su **puente** (qué te deja para el siguiente).
  Mismo rigor anti-alucinación que `discover.ts`: discos reales y canónicos, nada
  de recopilatorios, y la narrativa de cada disco sigue naciendo del pipeline
  verificado. Más `abrirPaso()` (fabricación perezosa con presupuesto) y
  `marcarEscuchado()` (desbloquea el siguiente; al último, cierra el camino).
- [x] **8.3 Pestaña `/caminos`** — crear camino (chips de género + texto libre),
  vista del camino con sus pasos abiertos/bloqueados, y `/api/caminos/paso`
  (`maxDuration=300`) con pantalla de carga al estilo `CreandoDiscoHoy`, porque
  fabricar un disco tarda 1-3 min. Enlace en `BottomNav`.
- [x] **8.4 Que no se olvide** — tira discreta en la home ("vas por el paso 3 de 5
  del camino al metal") que solo enlaza a la pestaña. Recupera el enganche que
  perdimos al no coserlo al ritual, sin invadirlo.
- [x] **8.5 "Eso ya lo conozco"** — botón por paso que lo salta y lo reemplaza por
  otro. Sin esto, la primera vez que le pongas *Paranoid* a alguien que lo tiene
  tatuado, pierdes su confianza.
- [ ] **8.6 Caminos del curador + compartir** — el dueño escribe sus propios
  caminos desde `/revision` (como la Vitrina de 7.6) y un camino se puede
  compartir con OG image. En su propia sección esto es natural; cosido al ritual
  no lo era.

### Criterios de aceptación

- [ ] El oyente pide un género y recibe 5 discos REALES en orden, cada uno con su
  papel y una frase que explica por qué va ahí y qué le deja para el siguiente.
- [ ] El paso 2 no se puede abrir sin marcar el 1 como escuchado.
- [ ] Abrir un paso fabrica su dossier completo (o reutiliza el del catálogo) y
  cae con elegancia si el LLM falla o se agotó el presupuesto — nunca un 500.
- [ ] El disco del día sigue funcionando exactamente igual que antes.

---

## 🔨 Fase 9 — El Salón de la Fama (EN CURSO · ago 2026)

**Objetivo:** que el oyente pueda ver **los discos 100 de 100** y pedir *"dame
un disco de 95"* y que la app sepa dárselo, con una lista de **miles de discos
que sea de verdad coherente**.

Idea del dueño, tras hablar con musicólogos y melómanos: hay discos que son
cien de cien (*The Dark Side of the Moon*, *Thriller*, *Abbey Road*…) y eso
merece su propio sitio en la app.

### El problema que había que resolver primero

Musicart YA tenía un número 1-100: el impacto cultural (`Album.impact`, 6.5).
**No servía para esto**, por dos razones:

1. Lo escribe la IA **disco a disco, sin ver a los demás**. Cuando narra
   *Thriller* no tiene delante a *Abbey Road*: un 88 de enero y un 91 de marzo
   no son comparables. Es el mismo defecto que el ROADMAP ya reconoce para
   `Album.difficulty` (decisión 4 de la Fase 8).
2. Solo existe para discos **que ya pasaron por el pipeline**. Para llegar a
   miles habría que fabricar miles de dossiers: meses de generación y una
   factura de IA imposible.

### Decisiones de diseño tomadas (no re-litigar)

1. **El ranking va separado del dossier.** Tabla nueva y ligera (`CanonAlbum`)
   con miles de discos: título, artista, año, portada, puntaje y sus recibos.
   Sin narrativa. La historia se fabrica perezosamente el día que alguien toca
   ese disco (`abrirDiscoDelCanon`), igual que un paso de un Camino, y como
   muchos canónicos ya están en catálogo suele salir gratis (`reused`).
2. **El puntaje NO lo escribe ningún LLM.** Sale de señales duras: en cuántas
   ediciones de Wikipedia tiene artículo propio (Wikidata), qué premios recibió
   y cuánta gente lo escucha (Last.fm, con poco peso: esto mide consagración,
   no popularidad). Aquí la regla anti-alucinación se cumple sola porque no hay
   nada escrito por un modelo.
3. **Coherencia por percentil, no por fórmula suelta.** El 1-100 final se asigna
   comparando cada disco con TODO el índice (`calibrar`), con una curva que hace
   el 100 rarísimo (~0,4% del índice: 4-7 discos entre mil). Así un 91 significa
   siempre lo mismo: "estás por encima del 91% del canon". Entrar discos nuevos
   recalibra a todos, y está bien — un canon es un ranking.
4. **El suelo del índice es 55, no 1.** Estar en el índice ya es una distinción
   (son los discos más documentados de la historia grabada). Un disco de nicho
   no saca mala nota: sencillamente no aparece.
5. **El club de los 100 se puede fijar a mano.** `CanonAlbum.locked` congela el
   puntaje de un disco y la ingesta no lo pisa. Es donde el criterio del curador
   vale más que la fórmula y donde un error se vería más.
6. **`/salon` ≠ `/vitrina`.** La vitrina es **mi gusto** (subjetivo, del
   curador); el Salón es **el veredicto de la historia** (objetivo, con
   recibos). El copy de ambas lo dice explícitamente o se canibalizan, igual que
   pasaba con `/explorar` vs `/caminos`.
7. **El disco del día no se toca.** Otra vez: pestaña aparte, motor aparte.

### Tareas

- [x] **9.1 Modelo del índice** — `CanonAlbum` (puntaje, prestigio bruto,
  señales, recibos, país, década, género, enlaces a Wikidata/MusicBrainz y al
  `Album` con dossier) + migración.
- [x] **9.2 Motor de puntaje** (`src/lib/canon/score.ts`) — PURO, sin red ni
  base de datos: `prestigioBruto()` pondera las señales, `calibrar()` reparte el
  1-100 por percentil con la curva del canon, `recibos()` traduce las señales a
  frases legibles y `pisoDe()` da la leyenda. Verificado: con 1.000 discos salen
  7 en el 100, 36 de 95 para arriba, 98 de 90 para arriba y **ningún hueco**
  entre 55 y 100 (el dial necesita que cada número exista).
- [x] **9.3 Ingesta** (`src/lib/sources/wikidata.ts`, `src/lib/canon/ingest.ts`,
  `scripts/canon.ts` → `npm run canon`) — Wikidata SPARQL da el universo y las
  señales fuertes; Last.fm añade oyentes y géneros; Deezer, las carátulas (paso
  aparte y con tope, por cortesía con una API pública). Idempotente, resiliente
  fuente a fuente, y termina recalibrando el índice entero.
- [x] **9.4 Capa de lectura** (`src/lib/canon/consulta.ts`) — muro, pisos,
  listado con filtros, progreso del oyente y el dial. Sin una sola llamada a un
  LLM: el Salón carga instantáneo y no consume presupuesto.
- [x] **9.5 Pestaña `/salon`** — muro de los inmortales, **el dial** ("dame un
  disco de 95", personalizado por afinidad y sin repetir lo ya escuchado), pisos
  navegables, canon con acento (país y género), `/salon/lista` con filtros y
  `/salon/disco/[id]` con los recibos del puntaje. Enlace en `BottomNav`.
- [ ] **9.6 Primera corrida real del índice** (pendiente del dueño) —
  `npm run canon` con la `DATABASE_URL` de Railway. Ver "Pendiente del dueño".
- [x] **9.7 Curaduría del club de los 100** — la fórmula ordena mil discos bien,
  pero la cima es donde un error se ve más y donde el criterio del dueño vale
  más que cualquier señal. Ahora puede **fijar un puntaje a mano** (`locked`: la
  ingesta deja de tocarlo), **soltarlo** (recalibra y vuelve a mandar la
  fórmula), **meter en el canon un disco que el índice no trajo** —hace falta de
  verdad: Wikipedia sobre-representa al mundo anglosajón y un clásico venezolano
  puede quedarse fuera— y **quitar** lo que se coló. Los controles finos viven
  en la ficha del disco (`CuradorCanon`, como los de la Vitrina en 7.6) y la
  vista de conjunto en `/revision` (`ClubDeLosCien`). Honestidad: si un puntaje
  está fijado, la ficha lo dice en vez de fingir que salió de los datos.
- [x] **9.8 La barra de abajo: de siete pestañas a cuatro** — con el Salón, la
  navegación llegó a siete pestañas y en un teléfono eso es ruido. Quedan
  **Hoy · Explorar · Diario · Perfil**, que son las cuatro cosas de verdad
  distintas (el ritual, todo lo demás, tu historia, tus ajustes). Caminos, Salón
  y Vitrina son hermanas —las cuatro maneras de explorar— y viven ahora juntas
  en `/explorar`, que las presenta con **una frase que dice en qué se
  diferencian** (`PuertasExplorar`): eso resuelve de paso la canibalización que
  el ROADMAP viene avisando desde la Fase 8, porque en una etiqueta de 11px esa
  diferencia no cabía. **Ninguna URL cambió**: `/caminos`, `/salon`, `/vitrina`,
  `/explorar/[slug]` y `/explorar/hitos` siguen igual, y la pestaña Explorar se
  queda encendida mientras estás dentro de cualquiera de ellas.
- [ ] **9.9 Compartir el Salón** — OG image del Salón y de cada disco del canon
  ("soy un 96/100"), al estilo de la de la Vitrina en 7.6.

### Pendiente del dueño (una sola vez)

- [ ] Correr `npm run canon` con la `DATABASE_URL` pública de Railway. Tarda
  bastante (habla con tres APIs con pausas de cortesía). Para probar primero:
  `npm run canon -- --limite 150`.
- [ ] Opcional: `LASTFM_API_KEY` para que el índice tenga oyentes y géneros. Sin
  ella el puntaje se calcula igual, solo con menos matices.

### Criterios de aceptación

- [ ] El oyente pide "un disco de 95" y recibe uno de exactamente esa altura,
  distinto del que ya escuchó y afín a su gusto.
- [ ] Cada puntaje se puede abrir y enseña las señales reales que lo produjeron.
- [ ] El índice llega a ~1.000 discos sin fabricar 1.000 dossiers.
- [ ] Tocar un disco del Salón fabrica su dossier (o reutiliza el del catálogo)
  y cae con elegancia si se agotó el presupuesto — nunca un 500.
- [ ] El disco del día sigue funcionando exactamente igual que antes.

---

## Estado actual (agosto 2026)

**Fases 0–7 completas; Fase 8 casi cerrada (falta 8.6) y Fase 9 EN CURSO**
(ago 2026). La 8.6 quedó pendiente por decisión del dueño, que priorizó el
Salón de la Fama.

---

## Decisiones técnicas tomadas (no re-litigar sin razón)

| Decisión | Por qué |
|---|---|
| PostgreSQL en Railway (URL pública `proxy.rlwy.net` desde Vercel) | SQLite no funciona en serverless; Railway ya era infraestructura del dueño |
| Campos `*Json` como `String` | Portabilidad total del schema entre motores |
| LLM por `fetch` directo, sin SDKs (`src/lib/dossier/llm.ts`) | Cero dependencias, intercambiable OpenAI/Anthropic por env var |
| Dossiers pre-generados + recomendación en runtime | Generar tarda minutos (no se hace esperar al usuario); recomendar es 1 llamada corta |
| Identidad anónima por deviceId antes que auth | Permite construir y validar la personalización ya, sin fricción de registro |
| `master` es la rama de producción en Vercel | Configurado manualmente en Vercel Settings (el repo usa `master`, no `main`) |
| Worker de generación como cron en Railway (`npm run worker`) | Generar tarda minutos: excede los timeouts de Vercel; Railway ya es infraestructura del dueño y usa la URL interna del Postgres |
