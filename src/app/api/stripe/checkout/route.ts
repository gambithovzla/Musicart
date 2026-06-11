import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";

export async function POST() {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Inicia sesión para suscribirte" }, { status: 401 });
  }

  try {
    const url = await createCheckoutSession(session.user.id, session.user.email);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
