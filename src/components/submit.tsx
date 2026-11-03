"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { LiquidButton } from "./liquid-button";
import { buttonClass } from "./ui";

/** A form's submit button. The main (filled) one fills with liquid while saving, then shows ✓. */
export function Submit({
  children,
  variant = "filled",
  size = "md",
  doneLabel = "Saved",
  className,
}: {
  children: React.ReactNode;
  variant?: "filled" | "tinted" | "gray" | "plain" | "destructive";
  size?: "sm" | "md" | "lg";
  doneLabel?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [done, setDone] = useState(false);
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) {
      setDone(true);
      const t = window.setTimeout(() => setDone(false), 1600);
      was.current = pending;
      return () => window.clearTimeout(t);
    }
    was.current = pending;
  }, [pending]);
  if (variant === "filled") {
    return (
      <LiquidButton
        type="submit"
        disabled={pending}
        state={pending ? "busy" : done ? "done" : "idle"}
        label={children}
        busyLabel="Saving…"
        doneLabel={doneLabel}
        size={size}
        className={className}
      />
    );
  }
  return (
    <button type="submit" disabled={pending} className={clsx(buttonClass(variant, size), className)}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function ConfirmButton({
  children,
  message,
  className,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? buttonClass("destructive")}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** The delete (or archive) button at the bottom of an edit sheet, with a confirmation. */
export function DeleteFooter({ action, message, children }: { action: (fd: FormData) => void | Promise<void>; message: string; children: React.ReactNode }) {
  return (
    <form action={action} className="mt-3 border-t border-separator pt-3">
      <ConfirmButton message={message}>{children}</ConfirmButton>
    </form>
  );
}
