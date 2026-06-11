"use server";

import { auth } from "@/auth";
import {
  acceptDuetInvite,
  createDuetInvite,
  leaveDuet,
} from "@/lib/duet";
import { revalidatePath } from "next/cache";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Necesitas iniciar sesión");
  return userId;
}

export async function createDuetInviteAction(): Promise<{ inviteCode: string }> {
  const userId = await requireUserId();
  const result = await createDuetInvite(userId);
  revalidatePath("/perfil");
  revalidatePath("/dueto");
  return result;
}

export async function acceptDuetInviteAction(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    await acceptDuetInvite(userId, code);
    revalidatePath("/perfil");
    revalidatePath("/dueto");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo unir al dueto",
    };
  }
}

export async function leaveDuetAction(): Promise<void> {
  const userId = await requireUserId();
  await leaveDuet(userId);
  revalidatePath("/perfil");
  revalidatePath("/dueto");
}
