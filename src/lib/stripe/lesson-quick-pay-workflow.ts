export type HostedLessonCheckoutInput = {
  requestId: string;
  schoolId: string;
  lessonId: string;
  stripeAccount: string;
  stripePriceId: string;
  expiresAt: Date;
  applicationUrl: string;
};

type CheckoutSession = { id: string; url: string | null };

type HostedCheckoutPorts = {
  createSession: (
    parameters: {
      mode: "payment";
      payment_method_types: ["card"];
      line_items: [{ price: string; quantity: 1 }];
      client_reference_id: string;
      metadata: Record<string, string>;
      payment_intent_data: { metadata: Record<string, string> };
      success_url: string;
      cancel_url: string;
      expires_at: number;
    },
    options: { stripeAccount: string; idempotencyKey: string },
  ) => Promise<CheckoutSession>;
  persistSession: (session: { requestId: string; sessionId: string; checkoutUrl: string }) => Promise<void>;
};

export async function openHostedLessonCheckout(input: HostedLessonCheckoutInput, ports: HostedCheckoutPorts) {
  const metadata = {
    school_id: input.schoolId,
    lesson_event_id: input.lessonId,
    lesson_payment_request_id: input.requestId,
  };
  const session = await ports.createSession({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: input.stripePriceId, quantity: 1 }],
    client_reference_id: input.requestId,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${input.applicationUrl}/payment-complete`,
    cancel_url: `${input.applicationUrl}/payment-canceled`,
    expires_at: Math.floor(input.expiresAt.getTime() / 1000),
  }, {
    stripeAccount: input.stripeAccount,
    idempotencyKey: `lesson-quick-payment-${input.requestId}-v1`,
  });

  if (!session.url) throw new Error("Stripe did not return a hosted payment URL.");
  await ports.persistSession({ requestId: input.requestId, sessionId: session.id, checkoutUrl: session.url });
  return { id: input.requestId, checkout_url: session.url, expires_at: input.expiresAt.toISOString(), status: "open" as const };
}

type CompletedCheckoutInput = {
  request: { requestId: string; amountCents: number; currency: string };
  checkoutSessionId: string;
  stripeAccount: string;
  providerEventId: string;
  providerCreatedAt: string;
};

export async function completeHostedLessonCheckout<Session>(
  input: CompletedCheckoutInput,
  ports: {
    retrieveSession: (checkoutSessionId: string, stripeAccount: string) => Promise<Session>;
    validateSession: (request: CompletedCheckoutInput["request"], session: Session) => { paymentIntentId: string; chargeId: string };
    completeRequest: (completion: {
      requestId: string;
      checkoutSessionId: string;
      paymentIntentId: string;
      chargeId: string;
      providerEventId: string;
      providerCreatedAt: string;
    }) => Promise<void>;
  },
) {
  const session = await ports.retrieveSession(input.checkoutSessionId, input.stripeAccount);
  const providerPayment = ports.validateSession(input.request, session);
  await ports.completeRequest({
    requestId: input.request.requestId,
    checkoutSessionId: input.checkoutSessionId,
    paymentIntentId: providerPayment.paymentIntentId,
    chargeId: providerPayment.chargeId,
    providerEventId: input.providerEventId,
    providerCreatedAt: input.providerCreatedAt,
  });
  return providerPayment;
}
