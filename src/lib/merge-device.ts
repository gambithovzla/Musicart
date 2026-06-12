// Fase 3.2: al iniciar sesión, fusiona los datos anónimos del deviceId con la cuenta.

import { prisma } from "./db";
import { dedupeReviewsByAlbum } from "./identity";
import { parseJson } from "./types";

export async function mergeDeviceToUser(
  userId: string,
  deviceId: string,
): Promise<void> {
  if (!deviceId) return;

  const deviceProfile = await prisma.profile.findUnique({ where: { deviceId } });
  const userProfile = await prisma.profile.findUnique({ where: { userId } });

  if (deviceProfile && !deviceProfile.userId) {
    if (userProfile && userProfile.id !== deviceProfile.id) {
      const merged = mergeProfileAnswers(
        parseJson<Record<string, unknown>>(userProfile.answersJson, {}),
        parseJson<Record<string, unknown>>(deviceProfile.answersJson, {}),
      );
      await prisma.profile.update({
        where: { id: userProfile.id },
        data: { answersJson: JSON.stringify(merged) },
      });
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

/** Fusiona respuestas de perfil: conserva lo no vacío de ambos lados. */
function mergeProfileAnswers(
  account: Record<string, unknown>,
  device: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...account };
  for (const [key, val] of Object.entries(device)) {
    if (Array.isArray(val) && val.length > 0) {
      const prev = Array.isArray(out[key]) ? (out[key] as unknown[]) : [];
      out[key] = [...new Set([...prev, ...val])];
    } else if (typeof val === "string" && val.trim() && !String(out[key] ?? "").trim()) {
      out[key] = val;
    } else if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      Object.keys(val as object).length > 0
    ) {
      out[key] = { ...(out[key] as object), ...(val as object) };
    }
  }
  return out;
}
