// Fase 3.2: al iniciar sesión, fusiona los datos anónimos del deviceId con la cuenta.

import { prisma } from "./db";
import { dedupeReviewsByAlbum } from "./identity";

export async function mergeDeviceToUser(
  userId: string,
  deviceId: string,
): Promise<void> {
  if (!deviceId) return;

  const deviceProfile = await prisma.profile.findUnique({ where: { deviceId } });
  const userProfile = await prisma.profile.findUnique({ where: { userId } });

  if (deviceProfile && !deviceProfile.userId) {
    if (userProfile && userProfile.id !== deviceProfile.id) {
      await prisma.profile.delete({ where: { id: deviceProfile.id } });
    } else {
      await prisma.profile.update({
        where: { id: deviceProfile.id },
        data: { userId },
      });
    }
  } else if (!userProfile && !deviceProfile) {
    await prisma.profile.create({
      data: { deviceId, userId, answersJson: "{}" },
    });
  }

  await prisma.review.updateMany({
    where: { deviceId, userId: null },
    data: { userId },
  });

  await prisma.dailyPick.updateMany({
    where: { deviceId, userId: null },
    data: { userId },
  });

  // Si ya había reseñas de la cuenta en otro dispositivo, quita duplicados.
  const reviews = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const keep = dedupeReviewsByAlbum(reviews);
  const keepIds = new Set(keep.map((r) => r.id));
  const toDelete = reviews.filter((r) => !keepIds.has(r.id));
  if (toDelete.length > 0) {
    await prisma.review.deleteMany({
      where: { id: { in: toDelete.map((r) => r.id) } },
    });
  }

  // Un solo pick por día y cuenta (conserva el más reciente).
  const picks = await prisma.dailyPick.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const seenDates = new Set<string>();
  const pickDupes: string[] = [];
  for (const p of picks) {
    if (seenDates.has(p.date)) pickDupes.push(p.id);
    else seenDates.add(p.date);
  }
  if (pickDupes.length > 0) {
    await prisma.dailyPick.deleteMany({ where: { id: { in: pickDupes } } });
  }
}
