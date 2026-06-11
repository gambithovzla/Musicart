import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createPortalSession, stripeConfigured } from "@/lib/stripe";

export async function POST() {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Aún no tienes suscripción activa" },
      { status: 400 },
    );
  }

  try {
    const url = await createPortalSession(user.stripeCustomerId);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
