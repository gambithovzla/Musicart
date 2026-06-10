// Identidad anónima por dispositivo (cliente). Fase 3: se migra a cuenta con auth.
// El id vive en localStorage y se espeja en una cookie para que el servidor
// pueda personalizar la home (el motor de recomendación lee la cookie).

const KEY = "musicart:device";
export const DEVICE_COOKIE = "musicart_device";

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
