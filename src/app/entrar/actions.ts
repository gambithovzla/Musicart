"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/entrar/completado" });
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/entrar?error=email");
  await signIn("resend", { email, redirectTo: "/entrar/completado" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
