export const SERVICE_ADDRESS_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
export const SERVICE_ADDRESS_TRAIL_MS = 48 * 60 * 60 * 1000;

export function canAssignedTeacherRevealServiceAddress(input: {
  nowMs: number;
  startsAt: string;
  endsAt: string;
  status: string;
}) {
  if (["cancelled", "rescheduled"].includes(input.status)) return false;
  const startsAtMs = new Date(input.startsAt).getTime();
  const endsAtMs = new Date(input.endsAt).getTime();
  return Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs)
    && input.nowMs >= startsAtMs - SERVICE_ADDRESS_LEAD_MS
    && input.nowMs <= endsAtMs + SERVICE_ADDRESS_TRAIL_MS;
}
