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

## 🔨 Fase 7 — "Un amigo que te conoce mejor cada día" (EN CURSO · jun 2026)

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

### Criterios de aceptación

- [ ] Usuarios con ≥3 reseñas y/o picks con mood reciben un bloque de patrones
  en el prompt; la recomendación refleja esa señal de forma notoria.
- [ ] El botón "Escuchar en Spotify/Apple/YouTube" funciona desde la home y
  el dossier en un toque, sin fricción.
- [ ] El usuario puede cambiar entre modo claro y oscuro desde el perfil y la
  preferencia persiste.

---

## Estado actual (junio 2026)

**Fases 0–6 completas; Fase 7 EN CURSO** (jun 2026).

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
