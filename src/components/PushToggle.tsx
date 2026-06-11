"use client";

// Recordatorio ritual diario: activar/desactivar Web Push desde el Perfil.

import { useEffect, useState } from "react";
import {
  savePushSubscription,
  deletePushSubscription,
} from "@/app/perfil/push-actions";
import { getDeviceId } from "@/lib/device";

type State = "unsupported" | "loading" | "off" | "on" | "denied";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (
      !vapidKey ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, [vapidKey]);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });
      const json = sub.toJSON();
      await savePushSubscription(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        },
        getDeviceId(),
      );
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "unsupported") return null;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-serif text-lg">Recordatorio diario</h2>
          <p className="mt-1 text-sm leading-relaxed text-dim">
            {state === "denied"
              ? "Las notificaciones están bloqueadas en tu navegador. Actívalas en los ajustes del sitio."
              : "Una notificación al día con tu disco. Nada más."}
          </p>
        </div>
        {state !== "denied" && (
          <button
            type="button"
            disabled={state === "loading"}
            onClick={() => void (state === "on" ? disable() : enable())}
            role="switch"
            aria-checked={state === "on"}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              state === "on" ? "bg-album" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] ${
                state === "on" ? "left-6" : "left-1"
              }`}
            />
          </button>
        )}
      </div>
    </section>
  );
}
