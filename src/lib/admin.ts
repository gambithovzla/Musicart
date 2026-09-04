import { auth } from "@/auth";

const DEFAULT_ADMIN = "cdrr1992@gmail.com";

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Sesión activa solo si el usuario es admin. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    throw new Error("Acceso denegado");
  }
  return session;
}
