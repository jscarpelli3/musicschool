"use client";

import { Children, forwardRef, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { MdExpandMore } from "react-icons/md";

type Option = { value: string; label: string; disabled: boolean };
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & { children: ReactNode };

function optionText(node: ReactNode): string {
  return Children.toArray(node).map((child) => typeof child === "string" || typeof child === "number" ? String(child) : "").join("");
}

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === "option") {
      const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
      return [{ value: String(props.value ?? optionText(props.children)), label: optionText(props.children), disabled: Boolean(props.disabled) }];
    }
    const props = child.props as { children?: ReactNode };
    return readOptions(props.children);
  });
}

export const AppSelect = forwardRef<HTMLSelectElement, Props>(function AppSelect({ children, className = "", value, defaultValue, onChange, disabled, autoFocus, "aria-label": ariaLabel, ...props }, forwardedRef) {
  const options = useMemo(() => readOptions(children), [children]);
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedValue = value === undefined ? internalValue : String(value);
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(next: Option) {
    if (next.disabled) return;
    if (value === undefined) setInternalValue(next.value);
    onChange?.({ target: { value: next.value }, currentTarget: { value: next.value } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(direction: -1 | 1) {
    const enabled = options.filter((option) => !option.disabled);
    const index = enabled.findIndex((option) => option.value === selectedValue);
    choose(enabled[Math.max(0, Math.min(enabled.length - 1, index + direction))] ?? enabled[0]);
  }

  return <div ref={rootRef} className="app-select-root">
    <select ref={forwardedRef} value={selectedValue} onChange={(event) => { if (value === undefined) setInternalValue(event.target.value); onChange?.(event); }} disabled={disabled} tabIndex={-1} aria-hidden="true" className="app-select-native" {...props}>{children}</select>
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (open) move(event.key === "ArrowDown" ? 1 : -1); else setOpen(true); }
        if (event.key === "Escape") setOpen(false);
      }}
      className={`app-select-trigger ${className}`}
    >
      <span className="min-w-0 flex-1 truncate text-left">{selected?.label || "Select"}</span>
      <MdExpandMore aria-hidden="true" className={`app-select-caret ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <div id={listId} role="listbox" aria-label={ariaLabel} className="app-select-menu">
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === selectedValue} disabled={option.disabled} onClick={() => choose(option)} className="app-select-option">{option.label}</button>)}
    </div> : null}
  </div>;
});
