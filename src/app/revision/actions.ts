"use server";

// Acciones del panel de revisión (Fase 2.3). Protegidas con ADMIN_SECRET.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function validar(clave: string) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || clave !== secret) throw new Error("Acceso denegado");
}

// Publica a mano un dossier que quedó en draft (no pasó la verificación
// automática pero un humano lo revisó y dio el visto bueno).
export async function publishDossier(dossierId: string, clave: string) {
  validar(clave);
  await prisma.dossier.update({
    where: { id: dossierId },
    data: { status: "published" },
  });
  revalidatePath("/revision");
}

// Descarta un draft que no vale la pena publicar (el álbum queda; el dossier
// se borra y podrá regenerarse en el futuro si hace falta).
export async function discardDossier(dossierId: string, clave: string) {
  validar(clave);
  await prisma.trackNote.deleteMany({ where: { dossierId } });
  await prisma.dossier.delete({ where: { id: dossierId } });
  revalidatePath("/revision");
}
