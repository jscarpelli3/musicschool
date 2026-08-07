"use client";

import { useRouter } from "next/navigation";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { removeFamilyPaymentMethod } from "./actions";

export function PaymentMethodRemove({ schoolId, billingAccountId, paymentMethodId }: {
  schoolId: string;
  billingAccountId: string;
  paymentMethodId: string;
}) {
  const router = useRouter();
  const action = removeFamilyPaymentMethod.bind(null, schoolId, billingAccountId, paymentMethodId);
  return <HoldToConfirm action={action} idleLabel="Hold to remove" holdingLabel="Keep holding to revoke…" duration={1200} onSuccess={() => router.refresh()} />;
}
