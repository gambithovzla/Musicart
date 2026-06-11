// Fase 3.2: al iniciar sesión, fusiona los datos anónimos del deviceId con la cuenta.

import { prisma } from "./db";

export async function mergeDeviceToUser(
  userId: string,
  deviceId: string,
): Promise<void> {
  if (!deviceId) return;

  const deviceProfile = await prisma.profile.findUnique({ where: { deviceId } });
  const userProfile = await prisma.profile.findUnique({ where: { userId } });

  if (deviceProfile && !deviceProfile.userId) {
    if (userProfile && userProfile.id !== deviceProfile.id) {
      // Otro device ya tenía perfil en la cuenta: conservar el de la cuenta.
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
}
