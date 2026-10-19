"use client";

import { useState, type ReactNode } from "react";

export function EditableSetupCard({
  saved,
  editLabel,
  completion,
  children,
}: {
  saved: boolean;
  editLabel: string;
  completion: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(!saved);

  if (saved && !editing) {
    return <div className="flex min-h-64 flex-col items-center justify-center text-center">
      {completion}
      <button type="button" onClick={() => setEditing(true)} className="mt-5 rounded-control border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas">
        {editLabel}
      </button>
    </div>;
  }

  return <div>
    {children}
    {saved ? <button type="button" onClick={() => setEditing(false)} className="mt-5 text-sm text-brand underline underline-offset-4">Back to saved view</button> : null}
  </div>;
}
