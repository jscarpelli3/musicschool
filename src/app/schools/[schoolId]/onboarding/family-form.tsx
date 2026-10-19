"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FocusedModal } from "@/components/ui/focused-modal";
import { AppSelect } from "@/components/ui/app-select";
import { MdCheckCircle } from "react-icons/md";
import { addStudentAndPayer, type AddFamilyState } from "../families/actions";

export type OnboardingFamily = {
  id: string;
  name: string;
  payer: { firstName: string; lastName: string; email: string } | null;
  students: Array<{ id: string; name: string }>;
};

const initialState: AddFamilyState = { ok: false, message: "" };
const field = "w-full rounded-control border border-line bg-canvas px-4 py-3 outline-none transition focus:border-brand read-only:bg-surface-raised read-only:text-muted";

export function FamilyForm({ schoolId, families }: { schoolId: string; families: OnboardingFamily[] }) {
  const router = useRouter();
  const [activePayerId, setActivePayerId] = useState<string | "new" | null>(families.length ? null : "new");
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const operationId = useRef<string | null>(null);
  const activePayer = activePayerId && activePayerId !== "new"
    ? families.find((family) => family.id === activePayerId)?.payer ?? null
    : null;

  function openForm(payerId: string | "new") {
    operationId.current = null;
    setState(initialState);
    setActivePayerId(payerId);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      operationId.current ??= crypto.randomUUID();
      formData.set("operation_id", operationId.current);
      const next = await addStudentAndPayer(schoolId, initialState, formData);
      setState(next);
      if (!next.ok) return;
      operationId.current = null;
      setActivePayerId(null);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto mt-7 max-w-2xl text-left">
      {families.length ? <div className="rounded-control border border-line bg-surface p-6 text-center sm:p-8">
        <div className="flex min-h-52 flex-col items-center justify-center">
          <MdCheckCircle aria-hidden="true" className="h-8 w-8 text-brand" />
          <h3 className="mt-3 font-display text-3xl">You saved your first student and payer!</h3>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">{families.length === 1 ? `${families[0].students[0]?.name ?? "Your student"} and their payer are connected.` : `${families.reduce((total, family) => total + family.students.length, 0)} students are connected across ${families.length} payer accounts.`} You can change their details later.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            <button type="button" onClick={() => openForm("new")} className="rounded-control border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas">Add another student and payer</button>
            <Link href={`/schools/${schoolId}/families/${families[0].id}`} className="px-3 py-3 text-sm text-brand underline underline-offset-4">View saved family</Link>
          </div>
        </div>
      </div> : <button type="button" onClick={() => openForm("new")} className="rounded-control border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas">Add student and payer</button>}

      <FocusedModal
        triggerLabel="Add student and payer"
        eyebrow="Family setup"
        title={activePayer ? `Add a student for ${activePayer.firstName} ${activePayer.lastName}.` : "Add a student and payer."}
        description={activePayer ? "This student will use the existing payer and family billing account." : "This creates a student, payer, and connected family billing account."}
        open={activePayerId !== null}
        onOpenChange={(open) => { if (!open && !pending) setActivePayerId(null); }}
        hideTrigger
      >
        <form action={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs leading-5 text-muted">Complete the student details and confirm who is responsible for billing.</p>
          </div>
          <label><span className="mb-2 block text-sm text-muted">Student first name</span><input required name="student_first" autoComplete="off" className={field} /></label>
          <label><span className="mb-2 block text-sm text-muted">Student last name</span><input required name="student_last" autoComplete="off" className={field} /></label>
          <label><span className="mb-2 block text-sm text-muted">Payer first name</span><input required readOnly={Boolean(activePayer)} name="payer_first" defaultValue={activePayer?.firstName ?? ""} autoComplete="given-name" className={field} /></label>
          <label><span className="mb-2 block text-sm text-muted">Payer last name</span><input required readOnly={Boolean(activePayer)} name="payer_last" defaultValue={activePayer?.lastName ?? ""} autoComplete="family-name" className={field} /></label>
          <label className="sm:col-span-2"><span className="mb-2 block text-sm text-muted">Payer email</span><input required readOnly={Boolean(activePayer)} name="payer_email" type="email" defaultValue={activePayer?.email ?? ""} autoComplete="email" className={field} /><span className="mt-2 block text-xs leading-5 text-muted">Billing summaries, approvals, and portal access go to this address.</span></label>
          <label><span className="mb-2 block text-sm text-muted">Relationship to student</span><AppSelect name="relationship" className={field}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="self">Self</option><option value="other">Other</option></AppSelect></label>
          <div className="flex items-end"><button disabled={pending} className="w-full rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Adding…" : activePayer ? "Add student" : "Add student and payer"}</button></div>
          {state.message ? <p role="status" aria-live="polite" className={`sm:col-span-2 text-sm ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p> : null}
        </form>
      </FocusedModal>
    </div>
  );
}
