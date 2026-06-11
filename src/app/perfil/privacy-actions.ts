"use server";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getListenerIdentity,
  hasListener,
} from "@/lib/identity";
import { buildUserDataExport, purgeListenerData } from "@/lib/user-data";

export async function exportMyData(): Promise<
  { ok: true; json: string; filename: string } | { ok: false; error: string }
> {
  const identity = await getListenerIdentity();
  if (!hasListener(identity)) {
    return { ok: false, error: "No hay datos que exportar en este dispositivo." };
  }

  const session = await auth();
  const account = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, name: true, createdAt: true },
      })
    : null;

  const payload = await buildUserDataExport(identity, account);
  const day = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    json: JSON.stringify(payload, null, 2),
    filename: `musicart-mis-datos-${day}.json`,
  };
}

export async function deleteMyData(): Promise<
  { ok: true; signedOut: boolean } | { ok: false; error: string }
> {
  const identity = await getListenerIdentity();
  if (!hasListener(identity)) {
    return { ok: false, error: "No hay datos que borrar." };
  }

  const hadAccount = Boolean(identity.userId);
  await purgeListenerData(identity, hadAccount);

  if (hadAccount) {
    await signOut({ redirect: false });
  }

  return { ok: true, signedOut: hadAccount };
}
