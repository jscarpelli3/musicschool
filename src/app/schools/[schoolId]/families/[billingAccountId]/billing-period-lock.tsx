"use client";

import { useRouter } from "next/navigation";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { lockFamilyBillingPeriod } from "./actions";

export function BillingPeriodLock({ schoolId, billingAccountId, billingPeriodId }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
}) {
  const router = useRouter();
  return (
    <div className="mt-5 max-w-sm">
      <HoldToConfirm
        action={lockFamilyBillingPeriod.bind(null, schoolId, billingAccountId, billingPeriodId)}
        idleLabel="Hold to lock this amount"
        holdingLabel="Keep holding to freeze the ledger…"
        duration={1400}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
