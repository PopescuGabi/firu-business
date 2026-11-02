"use client";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { buttonClass } from "./ui";

export function Submit({
  children,
  variant = "filled",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  variant?: "filled" | "tinted" | "gray" | "plain" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
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
