// Perfil: onboarding + estado de cuenta. Los datos alimentan el motor de recomendación.

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import {
  countDossiersThisMonth,
  freemiumLimit,
  isProUser,
  listenerKey,
} from "@/lib/freemium";
import { getDuetSummary } from "@/lib/duet";
import { getListenerIdentity, profileWhere } from "@/lib/identity";
import { stripeConfigured } from "@/lib/stripe";
import { ProfileForm, type ProfileAnswers } from "@/components/ProfileForm";
import { parseJson } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Perfil · Musicart" };

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string }>;
}) {
  const { subscription: subscriptionStatus } = await searchParams;
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

  const isAdmin = isAdminEmail(session?.user?.email);
  const key = listenerKey(identity);
  const used = key ? await countDossiersThisMonth(key) : 0;
  const isPro =
    isAdmin || (session?.user?.id ? await isProUser(session.user.id) : false);
  const duet = session?.user?.id ? await getDuetSummary(session.user.id) : null;

  return (
    <ProfileForm
      user={user}
      isAdmin={isAdmin}
      initialAnswers={initialAnswers}
      duet={duet}
      subscription={{
        isPro,
        used,
        limit: freemiumLimit(),
        stripeReady: stripeConfigured(),
        status: subscriptionStatus ?? null,
      }}
    />
  );
}
