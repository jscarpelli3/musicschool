"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
      {families.length ? (
        <div className="space-y-4">
          {families.map((family) => (
            <article key={family.id} className="rounded-control border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl">{family.name}</h3>
                  <p className="mt-2 text-sm text-ink">{family.payer ? `${family.payer.firstName} ${family.payer.lastName}` : "Payer unavailable"}</p>
                  {family.payer?.email ? <p className="mt-1 text-xs text-muted">{family.payer.email}</p> : null}
                </div>
                <Link href={`/schools/${schoolId}/families/${family.id}`} className="text-sm text-brand underline underline-offset-4">Edit payer</Link>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">Students</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {family.students.map((student) => <li key={student.id}>{student.name}</li>)}
                </ul>
                {family.payer?.email ? <button type="button" onClick={() => openForm(family.id)} className="mt-4 border-b border-brand text-sm text-brand">Add student to this payer</button> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {families.length ? <button type="button" onClick={() => openForm("new")} className="mt-5 rounded-control border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas">Add another student and payer</button> : null}

      {activePayerId ? (
        <form action={submit} className="mt-6 grid gap-4 rounded-control border border-line bg-surface p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h3 className="font-display text-2xl">{activePayer ? `Add a student for ${activePayer.firstName} ${activePayer.lastName}` : "Add a student and payer"}</h3>
            <p className="mt-2 text-xs leading-5 text-muted">{activePayer ? "This student will use the existing payer and family billing account." : "This creates a student, payer, and connected family billing account."}</p>
          </div>
          <label><span className="mb-2 block text-sm text-muted">Student first name</span><input required name="student_first" autoComplete="off" className={field} /></label>
          <label><span className="mb-2 block text-sm text-muted">Student last name</span><input required name="student_last" autoComplete="off" className={field} /></label>
          <label><span className="mb-2 block text-sm text-muted">Payer first name</span><input required readOnly={Boolean(activePayer)} name="payer_first" defaultValue={activePayer?.firstName ?? ""} autoComplete="given-name" className={field} /></label>
          <label><span className="mb-2 block text-sm text-muted">Payer last name</span><input required readOnly={Boolean(activePayer)} name="payer_last" defaultValue={activePayer?.lastName ?? ""} autoComplete="family-name" className={field} /></label>
          <label className="sm:col-span-2"><span className="mb-2 block text-sm text-muted">Payer email</span><input required readOnly={Boolean(activePayer)} name="payer_email" type="email" defaultValue={activePayer?.email ?? ""} autoComplete="email" className={field} /><span className="mt-2 block text-xs leading-5 text-muted">Billing summaries, approvals, and portal access go to this address.</span></label>
          <label><span className="mb-2 block text-sm text-muted">Relationship to student</span><select name="relationship" className={field}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="self">Self</option><option value="other">Other</option></select></label>
          <div className="flex items-end gap-3"><button disabled={pending} className="w-full rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Adding…" : activePayer ? "Add student" : "Add student and payer"}</button>{families.length ? <button type="button" disabled={pending} onClick={() => setActivePayerId(null)} className="px-2 py-3 text-sm text-muted">Cancel</button> : null}</div>
          {state.message ? <p role="status" aria-live="polite" className={`sm:col-span-2 text-sm ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
