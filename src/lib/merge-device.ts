// Fase 3.2: al iniciar sesión, fusiona los datos anónimos del deviceId con la cuenta.

import { prisma } from "./db";
import { dedupeReviewsByAlbum } from "./identity";
import { mergeProfileAnswers, profileHasSignal, profileRichness } from "./profile-merge";
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

/**
 * Busca perfiles huérfanos (otros deviceId con datos) ligados a la cuenta vía
 * reseñas o picks, y los fusiona en el perfil canónico por userId.
 */
export async function mergeAllOrphanProfilesForUser(userId: string): Promise<void> {
  let account = await prisma.profile.findUnique({ where: { userId } });

  const deviceIds = new Set<string>();
  if (account) deviceIds.add(account.deviceId);

  const [reviews, picks] = await Promise.all([
    prisma.review.findMany({ where: { userId }, select: { deviceId: true } }),
    prisma.dailyPick.findMany({ where: { userId }, select: { deviceId: true } }),
  ]);
  for (const r of reviews) deviceIds.add(r.deviceId);
  for (const p of picks) deviceIds.add(p.deviceId);

  let accountAnswers = parseJson<Record<string, unknown>>(account?.answersJson ?? "{}", {});

  for (const deviceId of deviceIds) {
    const dev = await prisma.profile.findUnique({ where: { deviceId } });
    if (!dev || dev.id === account?.id) continue;
    if (dev.userId && dev.userId !== userId) continue;
    if (!profileHasSignal(dev.answersJson) && profileRichness(dev.answersJson) === 0) continue;

    if (!account) {
      await prisma.profile.update({ where: { id: dev.id }, data: { userId } });
      account = await prisma.profile.findUnique({ where: { userId } });
      accountAnswers = parseJson<Record<string, unknown>>(account!.answersJson, {});
      continue;
    }

    accountAnswers = mergeProfileAnswers(
      accountAnswers,
      parseJson<Record<string, unknown>>(dev.answersJson, {}),
    );
    await prisma.profile.update({
      where: { id: account.id },
      data: { answersJson: JSON.stringify(accountAnswers) },
    });
    await prisma.profile.delete({ where: { id: dev.id } });
  }
}

/** Con sesión: fusiona dispositivo + huérfanos y devuelve el perfil canónico. */
export async function resolveProfileForUser(
  userId: string,
  deviceId: string,
): Promise<Awaited<ReturnType<typeof prisma.profile.findUnique>>> {
  if (deviceId) await mergeDeviceToUser(userId, deviceId);

  const account = await prisma.profile.findUnique({ where: { userId } });
  if (account && profileHasSignal(account.answersJson)) return account;

  await mergeAllOrphanProfilesForUser(userId);
  return prisma.profile.findUnique({ where: { userId } });
}
