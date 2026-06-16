// Identidad anónima por dispositivo (cliente). Fase 3: se migra a cuenta con auth.
// El id vive en localStorage y se espeja en una cookie para que el servidor
// pueda personalizar la home (el motor de recomendación lee la cookie).

const KEY = "musicart:device";
export const DEVICE_COOKIE = "musicart_device";
export const TZ_COOKIE = "musicart_tz";
export const LANG_COOKIE = "musicart_lang"; // valor: "YYYY-MM-DD|idioma"
export const THEME_COOKIE = "musicart_theme"; // valor: "light" | "dark" (default dark)

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
