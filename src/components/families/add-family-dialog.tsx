"use client";

import { useRef, useState, useTransition } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { AppSelect } from "@/components/ui/app-select";
import { MdGroupAdd, MdPersonAdd } from "react-icons/md";
import type { AddFamilyState } from "@/app/schools/[schoolId]/families/actions";

const initialState: AddFamilyState = { ok: false, message: "" };
const field = "mt-2 w-full rounded-control border border-line bg-surface px-4 py-3 outline-none focus:border-brand";

type ExistingPayer = { id: string; label: string; firstName: string; lastName: string; email: string };
type ExistingStudent = { id: string; label: string };

export function AddFamilyDialog({ action, triggerLabel, largeKind, existingPayers = [], unconnectedStudents = [] }: { action: (state: AddFamilyState, formData: FormData) => Promise<AddFamilyState>; triggerLabel: string; largeKind?: "student" | "payer"; existingPayers?: ExistingPayer[]; unconnectedStudents?: ExistingStudent[] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const operationId = useRef<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<"existing" | "new">(largeKind === "student" ? (existingPayers.length ? "existing" : "new") : largeKind === "payer" ? (unconnectedStudents.length ? "existing" : "new") : "new");
  const [existingPayerId, setExistingPayerId] = useState(existingPayers[0]?.id ?? "");
  const [existingStudentId, setExistingStudentId] = useState(unconnectedStudents[0]?.id ?? "");
  const submit = (formData: FormData) => startTransition(async () => {
    operationId.current ??= crypto.randomUUID();
    formData.set("operation_id", operationId.current);
    const next = await action(initialState, formData);
    setState(next);
    if (!next.ok) return;
    setOpen(false);
    operationId.current = null;
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Family added", message: "The student, payer, and family account are ready." } }));
  });
  const Icon = largeKind === "payer" ? MdGroupAdd : MdPersonAdd;
  const title = largeKind === "payer" ? "Add a payer and their first student." : "Add a student and payer.";
  const description = largeKind === "payer" ? "A payer account begins with the first student connected to that family." : "This creates the student record and connects it to the person responsible for billing.";
  const triggerContent = largeKind ? <><Icon aria-hidden="true" className="mb-2 text-3xl text-brand" /><span className="font-display text-3xl font-normal tracking-[-0.03em]">{triggerLabel}</span><span className="mt-2 max-w-xs text-xs leading-5 text-muted">{largeKind === "payer" ? "Create a payer account and connect their first student." : "Create a student and connect the person responsible for billing."}</span></> : undefined;
  const existingPayer = existingPayers.find((payer) => payer.id === existingPayerId);
  const usesExistingPayer = largeKind === "student" && connectionMode === "existing" && Boolean(existingPayer);
  const usesExistingStudent = largeKind === "payer" && connectionMode === "existing" && Boolean(existingStudentId);
  return <FocusedModal triggerLabel={triggerLabel} title={title} description={description} open={open} onOpenChange={setOpen} triggerContent={triggerContent} triggerClassName={largeKind ? "flex h-full min-h-40 w-full flex-col items-center justify-center rounded-card border border-transparent bg-surface-raised/55 px-6 py-7 text-center shadow-[var(--ui-shadow-soft)] transition duration-200 hover:-translate-y-1 hover:scale-[1.025] hover:border-brand/50 hover:bg-surface-raised hover:text-brand hover:shadow-xl" : undefined}>
    <form action={submit} className="grid gap-5 sm:grid-cols-2">
      {largeKind ? <div className="sm:col-span-2 grid grid-cols-2 rounded-control bg-canvas/70 p-1">
        <button type="button" onClick={() => setConnectionMode("existing")} disabled={largeKind === "student" ? !existingPayers.length : !unconnectedStudents.length} className={`rounded-control px-3 py-2 text-sm ${connectionMode === "existing" ? "bg-surface-raised text-ink shadow-sm" : "text-muted"}`}>{largeKind === "student" ? "Existing payer" : "Existing student"}</button>
        <button type="button" onClick={() => setConnectionMode("new")} className={`rounded-control px-3 py-2 text-sm ${connectionMode === "new" ? "bg-surface-raised text-ink shadow-sm" : "text-muted"}`}>{largeKind === "student" ? "New payer" : "New student"}</button>
      </div> : null}
      {usesExistingStudent ? <label className="sm:col-span-2"><span className="text-xs text-muted">Student to connect</span><AppSelect required name="existing_student_id" value={existingStudentId} onChange={(event) => setExistingStudentId(event.target.value)} className={field}>{unconnectedStudents.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</AppSelect></label> : <>
        <label><span className="text-xs text-muted">Student first name</span><input required name="student_first" autoFocus className={field} /></label>
        <label><span className="text-xs text-muted">Student last name</span><input required name="student_last" className={field} /></label>
      </>}
      {usesExistingPayer ? <label className="sm:col-span-2"><span className="text-xs text-muted">Payer to connect</span><AppSelect required value={existingPayerId} onChange={(event) => setExistingPayerId(event.target.value)} className={field}>{existingPayers.map((payer) => <option key={payer.id} value={payer.id}>{payer.label}</option>)}</AppSelect><input type="hidden" name="payer_first" value={existingPayer?.firstName ?? ""} /><input type="hidden" name="payer_last" value={existingPayer?.lastName ?? ""} /><input type="hidden" name="payer_email" value={existingPayer?.email ?? ""} /></label> : <>
        <label><span className="text-xs text-muted">Payer first name</span><input required name="payer_first" autoComplete="given-name" className={field} /></label>
        <label><span className="text-xs text-muted">Payer last name</span><input required name="payer_last" autoComplete="family-name" className={field} /></label>
        <label className="sm:col-span-2"><span className="text-xs text-muted">Payer email</span><input required name="payer_email" type="email" autoComplete="email" className={field} /><span className="mt-2 block text-xs leading-5 text-muted">Billing summaries, approvals, and portal access go to this address.</span></label>
      </>}
      <label><span className="text-xs text-muted">Relationship to student</span><AppSelect name="relationship" className={field}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="self">Self</option><option value="other">Other</option></AppSelect></label>
      <div className="flex items-end"><button disabled={pending} className="w-full rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Adding…" : "Add student and payer"}</button></div>
      {state.message && !state.ok ? <p role="alert" className="text-sm text-danger sm:col-span-2">{state.message}</p> : null}
    </form>
  </FocusedModal>;
}
