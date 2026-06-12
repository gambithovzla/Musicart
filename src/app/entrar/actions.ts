"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { spotifyPublicEnabled } from "@/lib/spotify-api";

function signInRedirect(next: string | null | undefined): string {
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return `/entrar/completado?next=${encodeURIComponent(next)}`;
  }
  return "/entrar/completado";
}

export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  await signIn("google", { redirectTo: signInRedirect(next) });
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/entrar?error=email");
  const next = String(formData.get("next") ?? "");
  await signIn("resend", { email, redirectTo: signInRedirect(next) });
}

export async function signInWithSpotify(formData: FormData) {
  if (!spotifyPublicEnabled()) redirect("/entrar");
  const next = String(formData.get("next") ?? "");
  await signIn("spotify", { redirectTo: signInRedirect(next) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
