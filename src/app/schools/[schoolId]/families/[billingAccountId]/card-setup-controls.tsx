"use client";

import { useActionState, useState } from "react";
import { generateFamilyCardSetupLink, type CardSetupLinkState } from "./actions";

const initialState: CardSetupLinkState = { url: null, error: null };

export function CardSetupControls({ schoolId, billingAccountId, disabled }: {
  schoolId: string;
  billingAccountId: string;
  disabled: boolean;
}) {
  const boundAction = generateFamilyCardSetupLink.bind(null, schoolId, billingAccountId);
  const [state, action, pending] = useActionState(boundAction, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.url) return;
    await navigator.clipboard.writeText(state.url);
    setCopied(true);
  }

  return (
    <div className="border-t border-line pt-5">
      <form action={action}>
        <button type="submit" disabled={disabled || pending} className="border border-brand px-5 py-3 text-sm text-ink transition-colors hover:bg-brand hover:text-canvas disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent">
          {pending ? "Creating secure link…" : "Create payer setup link"}
        </button>
      </form>
      <p className="mt-3 max-w-xl text-xs leading-5 text-muted">Send this Stripe-hosted link to the payer. They enter their own card and phone number; Common Time never receives the card details.</p>
      {state.error ? <p className="mt-3 border-l border-danger pl-3 text-xs text-danger">{state.error}</p> : null}
      {state.url ? <div className="mt-5 border-l border-brand pl-4"><p className="text-xs uppercase tracking-[0.14em] text-brand">Link ready for 24 hours</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={copyLink} className="border-b border-ink pb-1 text-sm hover:border-brand hover:text-brand">{copied ? "Copied" : "Copy payer link"}</button><a href={state.url} target="_blank" rel="noreferrer" className="border-b border-line pb-1 text-sm text-muted hover:border-brand hover:text-brand">Open assisted setup ↗</a></div></div> : null}
      {disabled ? <p className="mt-2 text-xs text-danger">The school’s Stripe connection must be enabled first.</p> : null}
    </div>
  );
}
