type StateDescriptor = {
  label: string;
  terminal: boolean;
  tone: "neutral" | "positive" | "warning" | "negative";
  reviewable?: boolean;
  editable?: boolean;
  canSendApproval?: boolean;
};

function descriptor<const T extends Record<string, StateDescriptor>>(states: T, value: string, domain: string): StateDescriptor {
  if (!(value in states)) throw new Error(`Unsupported ${domain} state: ${value}`);
  return states[value as keyof T];
}

export const lessonProposalStates = {
  pending_teacher: { label: "Waiting for teacher", terminal: false, tone: "warning" },
  pending_owner: { label: "Waiting for school review", terminal: false, tone: "warning", reviewable: true },
  accepted: { label: "Accepted", terminal: true, tone: "positive" },
  declined: { label: "Declined", terminal: true, tone: "negative" },
  withdrawn: { label: "Withdrawn", terminal: true, tone: "neutral" },
  superseded: { label: "Replaced", terminal: true, tone: "neutral" },
  expired: { label: "Expired", terminal: true, tone: "neutral" },
  applied: { label: "Applied", terminal: true, tone: "positive" },
  failed: { label: "Failed", terminal: true, tone: "negative" },
} as const satisfies Record<string, StateDescriptor>;
export type LessonProposalState = keyof typeof lessonProposalStates;

export function isLessonProposalState(value: string): value is LessonProposalState {
  return value in lessonProposalStates;
}

export const lessonRequestStates = {
  pending: { label: "Waiting for review", terminal: false, tone: "warning", reviewable: true },
  in_progress: { label: "Review in progress", terminal: false, tone: "warning", reviewable: true },
  approved: { label: "Approved", terminal: true, tone: "positive" },
  declined: { label: "Declined", terminal: true, tone: "negative" },
  withdrawn: { label: "Withdrawn", terminal: true, tone: "neutral" },
  superseded: { label: "Replaced", terminal: true, tone: "neutral" },
} as const satisfies Record<string, StateDescriptor>;

export const billingPeriodStates = {
  draft: { label: "Draft", terminal: false, tone: "neutral", editable: true },
  review: { label: "In review", terminal: false, tone: "warning", editable: true },
  locked: { label: "Locked", terminal: false, tone: "neutral", canSendApproval: true },
  approval_pending: { label: "Waiting for payer", terminal: false, tone: "warning", canSendApproval: true },
  approved: { label: "Approved", terminal: false, tone: "positive", canSendApproval: true },
  collecting: { label: "Collecting", terminal: false, tone: "warning" },
  paid: { label: "Paid", terminal: true, tone: "positive" },
  payment_failed: { label: "Payment failed", terminal: false, tone: "negative" },
  void: { label: "Void", terminal: true, tone: "neutral" },
} as const satisfies Record<string, StateDescriptor>;

export const deliveryStates = {
  pending: { label: "Preparing", terminal: false, tone: "neutral" },
  accepted: { label: "Accepted by provider", terminal: false, tone: "neutral" },
  sent: { label: "Sent", terminal: false, tone: "neutral" },
  delivered: { label: "Delivered", terminal: true, tone: "positive" },
  delayed: { label: "Delayed", terminal: false, tone: "warning" },
  failed: { label: "Failed", terminal: true, tone: "negative" },
  bounced: { label: "Bounced", terminal: true, tone: "negative" },
  complained: { label: "Marked as spam", terminal: true, tone: "negative" },
  suppressed: { label: "Suppressed", terminal: true, tone: "negative" },
  reconciliation_required: { label: "Delivery uncertain", terminal: false, tone: "warning" },
} as const satisfies Record<string, StateDescriptor>;

export const lessonOutcomeStates = {
  completed: { label: "Completed", terminal: true, tone: "positive" },
  student_cancelled: { label: "Student cancelled", terminal: true, tone: "neutral" },
  teacher_cancelled: { label: "Teacher cancelled", terminal: true, tone: "neutral" },
  school_cancelled: { label: "School cancelled", terminal: true, tone: "neutral" },
  no_show: { label: "No show", terminal: true, tone: "warning" },
  partial: { label: "Partially completed", terminal: true, tone: "warning" },
} as const satisfies Record<string, StateDescriptor>;

export const lessonProposalDescriptor = (value: string) => descriptor(lessonProposalStates, value, "lesson proposal");
export const lessonRequestDescriptor = (value: string) => descriptor(lessonRequestStates, value, "lesson request");
export const billingPeriodDescriptor = (value: string) => descriptor(billingPeriodStates, value, "billing period");
export const deliveryDescriptor = (value: string) => descriptor(deliveryStates, value, "delivery");
export const lessonOutcomeDescriptor = (value: string) => descriptor(lessonOutcomeStates, value, "lesson outcome");
