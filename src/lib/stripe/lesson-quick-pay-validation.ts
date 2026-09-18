type CheckoutPayment = {
  requestId: string;
  amountCents: number;
  currency: string;
};

type CheckoutSessionForValidation = {
  mode: string | null;
  payment_status: string;
  client_reference_id: string | null;
  amount_total: number | null;
  currency: string | null;
  payment_intent: string | null | {
    id: string;
    status: string;
    latest_charge: string | null | {
      id: string;
      paid: boolean;
      amount: number;
      currency: string;
    };
  };
};

export function validateCompletedLessonCheckout(request: CheckoutPayment, session: CheckoutSessionForValidation) {
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.client_reference_id !== request.requestId) {
    throw new Error("Lesson payment Checkout binding or status does not match.");
  }
  if (session.amount_total !== request.amountCents || session.currency?.toUpperCase() !== request.currency) {
    throw new Error("Lesson payment amount or currency does not match.");
  }
  const intent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  if (!intent || intent.status !== "succeeded") throw new Error("Lesson payment intent is not succeeded.");
  const charge = typeof intent.latest_charge === "string" ? null : intent.latest_charge;
  if (!charge || !charge.paid || charge.amount !== request.amountCents || charge.currency.toUpperCase() !== request.currency) {
    throw new Error("Lesson payment charge does not match.");
  }
  return { paymentIntentId: intent.id, chargeId: charge.id };
}

