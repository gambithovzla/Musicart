"use client";

// Asegura que el deviceId exista y viaje en cookie. Si la cookie no existía
// (primera visita o usuario de antes de la Fase 1), refresca la home para que
// el servidor pueda personalizar de inmediato.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId, DEVICE_COOKIE } from "@/lib/device";

export function DeviceSync() {
  const router = useRouter();

  useEffect(() => {
    const teniaCookie = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${DEVICE_COOKIE}=`));
    getDeviceId();
    if (!teniaCookie) router.refresh();
  }, [router]);

  return null;
}
