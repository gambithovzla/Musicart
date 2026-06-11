// Perfil: onboarding + estado de cuenta. Los datos alimentan el motor de recomendación.

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DEVICE_COOKIE } from "@/lib/device";
import { ProfileForm, type ProfileAnswers } from "@/components/ProfileForm";
import { parseJson } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Perfil · Musicart" };

export default async function PerfilPage() {
  const [session, deviceId] = await Promise.all([
    auth(),
    cookies().then((c) => c.get(DEVICE_COOKIE)?.value ?? ""),
  ]);

  let initialAnswers: Partial<ProfileAnswers> | null = null;

  if (deviceId) {
    const profile = await prisma.profile.findUnique({ where: { deviceId } });
    if (profile) {
      initialAnswers = parseJson<Partial<ProfileAnswers>>(profile.answersJson, {});
    }
  }

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null;

  return <ProfileForm user={user} initialAnswers={initialAnswers} />;
}
