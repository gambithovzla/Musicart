import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { constructWebhookEvent, syncSubscriptionFromStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Sin firma" }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(payload, signature);
  } catch (e) {
    return NextResponse.json(
      { error: `Webhook: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        if (checkout.mode === "subscription" && checkout.customer) {
          const customerId =
            typeof checkout.customer === "string"
              ? checkout.customer
              : checkout.customer.id;
          const userId = checkout.metadata?.userId;
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: { stripeCustomerId: customerId },
            });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
