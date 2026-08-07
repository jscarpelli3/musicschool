import "server-only";

import Stripe from "stripe";

export type StripeMode = "test" | "live";

let stripeClient: Stripe | undefined;

function requiredServerEnvironment(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getStripeMode(): StripeMode {
  const mode = requiredServerEnvironment("STRIPE_MODE");

  if (mode !== "test" && mode !== "live") {
    throw new Error("STRIPE_MODE must be either test or live.");
  }

  return mode;
}

export function getStripe() {
  if (stripeClient) return stripeClient;

  const mode = getStripeMode();
  const secretKey = requiredServerEnvironment("STRIPE_SECRET_KEY");
  const expectedPrefix = mode === "test" ? "sk_test_" : "sk_live_";

  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error(`STRIPE_SECRET_KEY does not match STRIPE_MODE=${mode}.`);
  }

  stripeClient = new Stripe(secretKey, {
    appInfo: {
      name: "MusicSchool",
      version: process.env.npm_package_version,
    },
  });

  return stripeClient;
}

export function getStripeWebhookSecrets() {
  const secrets = [
    requiredServerEnvironment("STRIPE_WEBHOOK_SECRET"),
    process.env.STRIPE_PLATFORM_WEBHOOK_SECRET?.trim(),
  ].filter((secret): secret is string => Boolean(secret));

  for (const secret of secrets) {
    if (!secret.startsWith("whsec_")) {
      throw new Error("Stripe webhook secrets must begin with whsec_.");
    }
  }

  return [...new Set(secrets)];
}
