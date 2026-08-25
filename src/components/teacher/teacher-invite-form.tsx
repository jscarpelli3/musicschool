"use client";

import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

type TeacherInviteFormProps = {
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
};

export function TeacherInviteForm({ action, children, className, disabled = false, onSuccess }: TeacherInviteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function submit() {
    const form = formRef.current;
    if (!form) return { ok: false, message: "The invitation form is unavailable. Reload the page and try again." };

    if (!form.reportValidity()) {
      return { ok: false, message: "Complete the highlighted teacher details before sending the invitation." };
    }
    if (!form.querySelector<HTMLInputElement>('input[name="instrument"]:checked')) {
      return { ok: false, message: "Choose at least one instrument this teacher teaches." };
    }

    const result = await action(new FormData(form));
    router.refresh();
    return result;
  }

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => event.preventDefault()}
    >
      {children}
      <div className="md:col-span-2">
        <HoldToConfirm
          action={submit}
          idleLabel="Hold to add and invite teacher"
          holdingLabel="Keep holding to send the invitation…"
          submittingLabel="Creating teacher and sending invitation…"
          successLabel="Teacher invited"
          failureMessage="The teacher invitation could not be sent. Please try again."
          disabled={disabled}
          disabledMessage="Choose and save at least one school instrument before adding a teacher."
          onSuccess={onSuccess}
        />
      </div>
    </form>
  );
}
