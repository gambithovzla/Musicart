// Perfil: onboarding + estado de cuenta. Los datos alimentan el motor de recomendación.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getListenerIdentity, profileWhere } from "@/lib/identity";
import { ProfileForm, type ProfileAnswers } from "@/components/ProfileForm";
import { parseJson } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Perfil · Musicart" };

export default async function PerfilPage() {
  const [session, identity] = await Promise.all([auth(), getListenerIdentity()]);

  let initialAnswers: Partial<ProfileAnswers> | null = null;
  const profileFilter = profileWhere(identity);
  if (profileFilter) {
    const profile = await prisma.profile.findFirst({ where: profileFilter });
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
