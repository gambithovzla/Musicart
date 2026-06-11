// Stripe Checkout + Portal (Fase 4.5). Sin SDK salvo verificación de webhooks.

import Stripe from "stripe";
import { prisma } from "./db";

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
  return new Stripe(key);
}

function appUrl(): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_ID?.trim(),
  );
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const stripe = stripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
): Promise<string> {
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) throw new Error("STRIPE_PRICE_ID no configurada");

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const base = appUrl();

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/perfil?subscription=success`,
    cancel_url: `${base}/perfil?subscription=canceled`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  });

  if (!session.url) throw new Error("Stripe no devolvió URL de checkout");
  return session.url;
}

export async function createPortalSession(customerId: string): Promise<string> {
  const stripe = stripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/perfil`,
  });
  return session.url;
}

export function constructWebhookEvent(
  payload: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET no configurada");
  const stripe = stripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata.userId;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const data = {
    subscriptionStatus: subscription.status,
    subscriptionEndsAt: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : null,
    stripeCustomerId: customerId,
  };

  if (userId) {
    await prisma.user.update({ where: { id: userId }, data });
    return;
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data });
  }
}
