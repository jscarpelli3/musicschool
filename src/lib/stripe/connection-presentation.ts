export type StripeConnectionPresentation =
  | "not_connected"
  | "setup_in_progress"
  | "under_review"
  | "action_required"
  | "not_approved"
  | "ready";

export function stripeConnectionPresentation(input: {
  connected: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: string[];
  pendingVerification: string[];
  requirementErrors: unknown[];
  disabledReason: string | null;
}): StripeConnectionPresentation {
  if (input.chargesEnabled && input.payoutsEnabled) return "ready";

  if (input.disabledReason?.startsWith("rejected.")) return "not_approved";

  if (input.requirements.length > 0 || input.requirementErrors.length > 0) {
    return "action_required";
  }

  if (input.connected && input.detailsSubmitted && input.pendingVerification.length > 0) {
    return "under_review";
  }

  return input.connected ? "setup_in_progress" : "not_connected";
}
