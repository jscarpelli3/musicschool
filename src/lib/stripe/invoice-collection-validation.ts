export type InvoiceAttemptBinding = {
  attemptId: string;
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  amountCents: number;
  currency: string;
  stripeAccount: string | null;
  stripeCustomer: string;
  stripePaymentMethod: string;
};

export type InvoiceIntentBinding = {
  amount: number;
  currency: string;
  customer: string | null;
  paymentMethod: string | null;
  metadata: Record<string, string>;
};

export function assertInvoicePaymentIntentBinding(attempt: InvoiceAttemptBinding, stripeAccount: string, intent: InvoiceIntentBinding) {
  if (attempt.stripeAccount !== stripeAccount) throw new Error("PaymentIntent connected account does not match its reserved invoice attempt.");
  if (intent.amount !== attempt.amountCents || intent.currency.toUpperCase() !== attempt.currency) throw new Error("PaymentIntent amount does not match its reserved invoice attempt.");
  if (intent.customer !== attempt.stripeCustomer || intent.paymentMethod !== attempt.stripePaymentMethod) throw new Error("PaymentIntent payer method does not match its reserved invoice attempt.");
  if (intent.metadata.payment_attempt_id !== attempt.attemptId
    || intent.metadata.school_id !== attempt.schoolId
    || intent.metadata.billing_account_id !== attempt.billingAccountId
    || intent.metadata.billing_period_id !== attempt.billingPeriodId) throw new Error("PaymentIntent tenant binding does not match its reserved invoice attempt.");
}
