// Envío del recordatorio ritual diario (Fase 5.1).
// Pensado para un cron en Railway:  npm run push
// Manda una notificación a cada suscripción con el disco global de hoy.
// Las suscripciones caducadas (410/404) se limpian solas.

import webpush from "web-push";
import { prisma } from "../src/lib/db";
import { getTodayPick } from "../src/lib/daily";

async function main() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:hola@musicart.app";

  if (!publicKey || !privateKey) {
    console.error(
      "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el entorno.",
    );
    process.exit(1);
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) {
    console.log("No hay suscripciones push. Nada que enviar.");
    return;
  }

  const pick = await getTodayPick();
  const payload = JSON.stringify({
    title: "Tu disco de hoy te espera 🎵",
    body: pick
      ? `«${pick.album.title}» de ${pick.album.artist.name}. Descubre su historia.`
      : "Entra y descubre qué disco te tocó hoy.",
    url: "/",
  });

  let ok = 0;
  let limpiadas = 0;
  let fallidas = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 60 * 60 * 12 },
      );
      ok++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        limpiadas++;
      } else {
        fallidas++;
        console.error(`  ✗ ${sub.endpoint.slice(0, 60)}…: ${status ?? e}`);
      }
    }
  }

  console.log(
    `Push diario: ${ok} enviadas · ${limpiadas} caducadas limpiadas · ${fallidas} fallidas (de ${subs.length}).`,
  );
}

main()
  .catch((e) => {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
