export const payerReviewReasonLabels: Record<string, string> = {
  lesson_did_not_happen: "A lesson did not happen",
  wrong_lesson_or_date: "A lesson or date is wrong",
  wrong_amount: "An amount is wrong",
  missing_credit: "A credit or discount is missing",
  duplicate_charge: "A charge appears twice",
  other: "Other",
};

export function payerReviewReasonLabel(reason: string | null | undefined) {
  return payerReviewReasonLabels[reason ?? ""] ?? "The payer asked the school to review these charges.";
}
