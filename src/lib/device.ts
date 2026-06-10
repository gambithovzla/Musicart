// Identidad anónima por dispositivo (cliente). Fase 2: se migra a cuenta con auth.

const KEY = "musicart:device";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
