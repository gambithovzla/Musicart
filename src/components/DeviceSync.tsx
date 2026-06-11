"use client";

// Asegura que el deviceId exista y viaje en cookie. Si la cookie no existía
// (primera visita o usuario de antes de la Fase 1), refresca la home para que
// el servidor pueda personalizar de inmediato.
// También sincroniza el timezone del navegador para mostrar el disco del día correcto.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId, DEVICE_COOKIE, TZ_COOKIE } from "@/lib/device";

export function DeviceSync() {
  const router = useRouter();

  useEffect(() => {
    const teniaCookieDevice = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${DEVICE_COOKIE}=`));
    getDeviceId();

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzEncoded = encodeURIComponent(tz);
    const teniaCookieTz = document.cookie
      .split("; ")
      .some((c) => c === `${TZ_COOKIE}=${tzEncoded}`);

    if (tz && !teniaCookieTz) {
      document.cookie = `${TZ_COOKIE}=${tzEncoded};path=/;max-age=31536000;SameSite=Lax`;
    }

    if (!teniaCookieDevice || (tz && !teniaCookieTz)) router.refresh();
  }, [router]);

  return null;
}
