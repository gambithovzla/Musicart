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

## 🔨 Fase 2 — Catálogo que crece solo (EN CURSO)

**Objetivo:** que el catálogo pase de 3 discos demo a una biblioteca real sin
intervención humana. La IA decide qué generar; el pipeline existente genera y
verifica; solo lo verificado se publica.

### Tareas

- [x] **2.1 Curador IA** (`src/lib/curator.ts` o en el worker)
  - LLM propone los próximos álbumes a generar: clásicos imprescindibles +
    huecos del catálogo + afinidades con lo que los usuarios puntúan alto.
  - Lista priorizada persistida (nuevo modelo `GenerationQueue` o similar).
- [ ] **2.2 Worker de generación** — decisión de arquitectura:
  - **Opción A (recomendada): worker en Railway** (ya existe un sidecar de
    Python en la infraestructura del dueño; puede ser un servicio Node con
    `tsx` reutilizando el pipeline TS tal cual, corriendo como cron de Railway).
    Sin límites de timeout, mismo Postgres interno (URL privada, sin egress).
  - **Opción B: Vercel Cron** + route handler con `maxDuration` alto. Más
    simple de desplegar, pero limitado en tiempo de ejecución.
  - El worker toma N items de la cola por corrida nocturna, ejecuta
    `runDossierPipeline(..., { publish: true })`, registra resultados.
- [ ] **2.3 Control de calidad**
  - Los dossiers que no pasan verificación quedan `draft` (ya implementado);
    endpoint/listado simple para revisarlos y publicarlos a mano.
  - Alertas básicas: si una corrida falla todo, que quede registrado (log o
    notificación).
- [ ] **2.4 Hilos de descubrimiento** (la madriguera MJ → Prince → Beatles)
  - Cada dossier sugiere 2-3 "saltos": rivalidades, colaboraciones, influencias
    ("de aquí puedes saltar a…"), verificados contra los facts.
  - UI: al final del dossier, tarjetas de salto que llevan a otros álbumes del
    catálogo (o alimentan la cola de generación si aún no existen).

### Criterios de aceptación

- El catálogo crece solo (≥ N discos/semana sin tocar nada).
- Nada se publica sin pasar la verificación anti-alucinación.
- Los saltos de descubrimiento solo afirman relaciones respaldadas por facts.

---

## 👤 Fase 3 — Cuentas reales

**Objetivo:** el usuario inicia sesión y su historia lo sigue en cualquier
dispositivo.

- [ ] Auth.js (Google + email) sobre Next.js App Router
- [ ] Modelo `User`; migración de identidad: al iniciar sesión, fusionar el
  Profile/Reviews/DailyPicks del deviceId actual con la cuenta
- [ ] Sesión multi-dispositivo (el diario y la racha viajan contigo)
- [ ] Privacidad: export/borrado de datos del usuario

---

## 💎 Fase 4 — Producto pulido y monetización

- [ ] TTS calidad podcast pre-renderizado (`Dossier.audioJson` ya lo soporta)
- [ ] Modo conductor: audio continuo + Media Session API
- [ ] Tarjetas compartibles ("mi disco de hoy") para redes
- [ ] Rutas temáticas (semana del soul, historia del grunge…)
- [ ] Stripe freemium (límite de dossiers/mes gratis, ilimitado de pago)
- [ ] Analytics de producto y validación con usuarios reales

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
