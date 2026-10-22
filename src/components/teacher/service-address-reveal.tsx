"use client";

import { useActionState } from "react";
import type { ServiceAddressState } from "@/app/schools/[schoolId]/teacher/actions";

const initialState: ServiceAddressState = { status: "idle", message: "" };

export function ServiceAddressReveal({ action }: { action: (state: ServiceAddressState) => Promise<ServiceAddressState> }) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  if (state.status === "success") return <div className="mt-3 rounded-control bg-brand/10 p-4 text-sm"><p className="font-medium">{state.message}</p>{state.address ? <address className="mt-2 not-italic leading-6">{state.address.map((line) => <span key={line} className="block">{line}</span>)}</address> : null}</div>;
  return <form action={dispatch} className="mt-3"><button disabled={pending} className="text-sm text-brand hover:text-brand-hover disabled:opacity-50">{pending ? "Checking…" : "Reveal address for this lesson"}</button>{state.status === "error" ? <p role="alert" className="mt-2 text-xs text-danger">{state.message}</p> : null}</form>;
}
