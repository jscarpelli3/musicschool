export const CANONICAL_APP_ORIGIN = "https://app.commontime.studio";
export const PRODUCTION_EMAIL_SAFETY_SENTENCE = "We will only ever send you to app.commontime.studio. Never enter a card number from an email link.";
export const STAGING_EMAIL_SAFETY_SENTENCE = "This is a Common Time staging test. Use its staging link only if you expected this test message, and never enter a real card number.";

type DeliveryPolicyEnvironment = {
  deliveryMode?: string;
  allowedRecipients?: string;
  appUrl?: string;
  vercelEnvironment?: string;
  nodeEnvironment?: string;
};

function email(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 320 ? normalized : null;
}

export function resolveEmailDeliveryPolicy(environment: DeliveryPolicyEnvironment) {
  if (environment.deliveryMode?.trim() !== "allowlist") {
    return {
      allowedOrigins: new Set([CANONICAL_APP_ORIGIN]),
      allowedRecipients: null,
      safetySentence: PRODUCTION_EMAIL_SAFETY_SENTENCE,
    };
  }

  const isPreview = environment.vercelEnvironment === "preview";
  const isLocal = environment.nodeEnvironment !== "production" && !environment.vercelEnvironment;
  if (!isPreview && !isLocal) throw new Error("Email allowlist mode is permitted only in preview or local environments.");

  let stagingOrigin: string;
  try {
    const url = new URL(environment.appUrl ?? "");
    if (isPreview && url.protocol !== "https:") throw new Error("preview_requires_https");
    stagingOrigin = url.origin;
  } catch {
    throw new Error("Email allowlist mode requires a valid staging APP_URL.");
  }

  const recipients = new Set((environment.allowedRecipients ?? "").split(",").map(email).filter((value): value is string => Boolean(value)));
  if (recipients.size === 0) throw new Error("Email allowlist mode requires at least one valid recipient.");

  return {
    allowedOrigins: new Set([CANONICAL_APP_ORIGIN, stagingOrigin]),
    allowedRecipients: recipients,
    safetySentence: STAGING_EMAIL_SAFETY_SENTENCE,
  };
}
