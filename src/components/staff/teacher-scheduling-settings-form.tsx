"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

type Result = { ok: boolean; message: string };

export function TeacherSchedulingSettingsForm({ initialAuthority, initialCanManageAvailability, action }: { initialAuthority: string; initialCanManageAvailability: boolean; action: (authority: string, canManage: boolean) => Promise<Result> }) {
  const [authority,setAuthority] = useState(initialAuthority);
  const [canManage,setCanManage] = useState(initialCanManageAvailability);
  return <div className="mt-5 border-t border-line pt-5">
    <label className="block"><span className="text-xs text-muted">Scheduling authority</span><select value={authority} onChange={(event) => setAuthority(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2 text-sm"><option value="propose_only">Can propose changes; owner approves</option><option value="manage_assigned_lessons">Can move assigned lessons directly</option></select></label>
    <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={canManage} onChange={(event) => setCanManage(event.target.checked)} className="mt-1 accent-brand" /><span>Can manage their own weekly availability</span></label>
    <div className="mt-4"><HoldToConfirm action={() => action(authority,canManage)} idleLabel="Hold to save scheduling settings" submittingLabel="Saving scheduling settings…" successLabel="Settings saved" /></div>
  </div>;
}
