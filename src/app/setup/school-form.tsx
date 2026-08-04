"use client";

import { useActionState } from "react";
import { createSchool, type CreateSchoolState } from "./actions";

const initialState: CreateSchoolState = { error: null };

export function SchoolForm() {
  const [state, action, pending] = useActionState(createSchool, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm text-zinc-300">School name</span>
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="organization"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none transition focus:border-emerald-500"
          placeholder="My Music School"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm text-zinc-300">Timezone</span>
        <select
          name="timezone"
          defaultValue="America/Chicago"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none transition focus:border-emerald-500"
        >
          <option value="America/New_York">Eastern</option>
          <option value="America/Chicago">Central</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Phoenix">Arizona</option>
          <option value="America/Los_Angeles">Pacific</option>
          <option value="America/Anchorage">Alaska</option>
          <option value="Pacific/Honolulu">Hawaii</option>
        </select>
      </label>
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create school"}
      </button>
    </form>
  );
}
