// Identidad anónima por dispositivo (cliente). Fase 3: se migra a cuenta con auth.
// El id vive en localStorage y se espeja en una cookie para que el servidor
// pueda personalizar la home (el motor de recomendación lee la cookie).

const KEY = "musicart:device";
export const DEVICE_COOKIE = "musicart_device";
export const TZ_COOKIE = "musicart_tz";
export const LANG_COOKIE = "musicart_lang"; // valor: "YYYY-MM-DD|idioma"
// Lo que el oyente pidió escuchar hoy (texto libre: "rock con energía",
// "algo tranquilo", "pop en inglés"). Lo elige en el gate del día y manda al
// fabricar su disco fresco. Valor: "YYYY-MM-DD|texto". Se reinicia cada día.
export const PEDIDO_COOKIE = "musicart_pedido";
export const THEME_COOKIE = "musicart_theme"; // valor: "light" | "dark" (default dark)
// Discos que EL DIAL del Salón ya entregó (ids del canon, los más nuevos
// primero). Sin esta memoria el dial repite: su elección es determinista, así
// que el mismo puntaje devuelve el mismo disco una y otra vez. Valor: "id,id,…".
export const DIAL_COOKIE = "musicart_dial";
// Discos ya mostrados hoy (para que "Rehacer" no cicle entre los del día).
// Valor: "YYYY-MM-DD|albumId,albumId,…". Se reinicia cada día.
export const SEEN_TODAY_COOKIE = "musicart_seen_today";
// Diagnóstico del curador (solo admin): qué se intentó al fabricar el disco de
// hoy y por qué salió lo que salió. Vive en una cookie porque la fabricación
// normal la dispara la pantalla de carga y su respuesta se tira a la basura:
// sin esto, el único sitio donde se podía leer la bitácora era el botón de
// "Rehacer", y el día que el disco sale repetido sin haber tocado nada no había
// forma de saber qué pasó sin abrir los logs de Vercel desde el teléfono.
export const BITACORA_COOKIE = "musicart_bitacora"; // valor: "YYYY-MM-DD|línea¦línea"

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  document.cookie = `${DEVICE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  return id;
}

/** Extrae el idioma elegido si la cookie pertenece a hoy, o null. */
export function parseTodayLang(
  raw: string | undefined,
  dateKey: string,
): string | null {
  if (!raw) return null;
  const sep = raw.indexOf("|");
  if (sep === -1) return null;
  const date = raw.slice(0, sep);
  const lang = raw.slice(sep + 1);
  return date === dateKey && lang ? decodeURIComponent(lang) : null;
}

/** Texto que el oyente pidió escuchar hoy, si la cookie pertenece a hoy, o null. */
export function parseTodayPedido(
  raw: string | undefined,
  dateKey: string,
): string | null {
  if (!raw) return null;
  const sep = raw.indexOf("|");
  if (sep === -1) return null;
  const date = raw.slice(0, sep);
  const texto = raw.slice(sep + 1);
  if (date !== dateKey || !texto) return null;
  const decoded = decodeURIComponent(texto).trim();
  return decoded ? decoded.slice(0, 500) : null;
}

/** AlbumIds ya mostrados hoy (de la cookie); vacío si la cookie es de otro día. */
export function parseSeenToday(
  raw: string | undefined,
  dateKey: string,
): string[] {
  if (!raw) return [];
  const sep = raw.indexOf("|");
  if (sep === -1) return [];
  const date = raw.slice(0, sep);
  if (date !== dateKey) return [];
  return raw
    .slice(sep + 1)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Serializa la cookie de discos vistos hoy (con ids únicos). */
export function buildSeenToday(dateKey: string, albumIds: string[]): string {
  const unicos = [...new Set(albumIds.filter(Boolean))];
  return `${dateKey}|${unicos.join(",")}`;
}

/** Bitácora del curador guardada hoy (o vacío si la cookie es de otro día). */
export function parseBitacora(raw: string | undefined, dateKey: string): string[] {
  if (!raw) return [];
  const sep = raw.indexOf("|");
  if (sep === -1) return [];
  if (raw.slice(0, sep) !== dateKey) return [];
  try {
    return decodeURIComponent(raw.slice(sep + 1))
      .split("¦")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    // Cookie manoseada o a medias: el diagnóstico no puede tumbar la home.
    return [];
  }
}

/** Serializa la bitácora del día. Recortada: una cookie no aguanta 4 KB de prosa. */
export function buildBitacora(dateKey: string, lineas: string[]): string {
  const texto = lineas
    .filter(Boolean)
    .slice(-10)
    .map((l) => l.replace(/¦/g, " ").slice(0, 200))
    .join("¦")
    // Se recorta ANTES de codificar: cortar la cadena ya codificada puede
    // partir un %XX por la mitad y dejar la cookie ilegible.
    .slice(0, 1200);
  return `${dateKey}|${encodeURIComponent(texto)}`;
}
