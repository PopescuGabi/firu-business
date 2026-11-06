"use client";
import { useActionState, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Copy, Mail, UserCheck } from "lucide-react";
import { cancelClientInvite, inviteClient, removeClientAccess, setShared } from "@/app/actions/client-dashboard";
import { buttonClass, Field } from "./ui";

type Access = {
  link: { email: string; name: string | null; shared: string[] } | null;
  invite: { email: string; sentAt: string | null } | null;
};

/**
 * "Their dashboard" on a client's page: invite the client's contact (email from your Gmail only when you press
 * Send), then choose what they see in their own hub under "From <you>".
 */
export function ClientAccess({
  clientId,
  clientName,
  access,
  gmailOn,
  appUrl,
  agencyName,
  shareable,
}: {
  clientId: number;
  clientName: string;
  access: Access;
  gmailOn: boolean;
  appUrl: string;
  agencyName: string;
  shareable: { key: string; label: string; description: string }[];
}) {
  const [state, act, pending] = useActionState(inviteClient.bind(null, clientId), null);
  const [email, setEmail] = useState(access.invite?.email ?? "");
  const [message, setMessage] = useState(
    `Hi!\n\nI've set up a dashboard for ${clientName} in FIRU Business, where you can see your Instagram results and the work we do together, any time.\n\nSign in with your Google account (this email address): ${appUrl}\n\n${agencyName}`,
  );
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  if (access.link) {
    const shared = access.link.shared;
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[14px]">
          <UserCheck size={16} className="text-green" />
          <span>
            Shared with <strong>{access.link.name || access.link.email}</strong> <span className="text-label-2">({access.link.email})</span>
          </span>
        </p>
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-[12px] font-semibold text-label-2 uppercase">What they see</p>
          {shareable.map((s) => {
            const on = shared.includes(s.key);
            return (
              <label key={s.key} className={clsx("flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2", on ? "bg-accent-soft" : "bg-well")}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{s.label}</span>
                  <span className="block text-[12px] text-label-2">{s.description}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={on}
                  disabled={busy}
                  onChange={() => start(() => setShared(clientId, on ? shared.filter((x) => x !== s.key) : [...shared, s.key]))}
                />
              </label>
            );
          })}
          <p className="px-1 text-[12px] text-label-3">Finance, your notes and the AI tools are never shared.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          className={clsx(buttonClass("plain", "sm"), "self-start text-red")}
          onClick={() => confirm(`Stop sharing ${clientName}'s dashboard with ${access.link!.email}? Their own hub stays.`) && start(() => removeClientAccess(clientId))}
        >
          Stop sharing
        </button>
      </div>
    );
  }

  return (
    <form action={act} className="flex flex-col gap-3">
      {access.invite && (
        <p className="rounded-[12px] bg-well px-3 py-2 text-[13px] text-label-2">
          Invited <strong className="text-label">{access.invite.email}</strong>
          {access.invite.sentAt ? `, emailed ${new Date(access.invite.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : " (not emailed)"}. It turns into their dashboard when they first sign in.{" "}
          <button type="button" className="font-semibold text-accent" onClick={() => start(() => cancelClientInvite(clientId))}>
            Cancel invite
          </button>
        </p>
      )}
      <Field label="Their email (the Google account they'll sign in with)">
        <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="name@business.com" />
      </Field>
      <Field label="Message" hint={gmailOn ? "It goes from your Gmail only when you press Send." : "Connect Gmail in Settings to send it from here, or copy it."}>
        <textarea name="message" rows={7} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} className="field text-[14px]" />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state && <span className={clsx("mr-auto text-[13px]", state.ok ? "text-green" : "text-red")}>{state.message}</span>}
        <button
          type="button"
          className={buttonClass("gray", "sm")}
          onClick={() => {
            navigator.clipboard.writeText(message).then(() => setCopied(true));
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy message"}
        </button>
        <button name="send" value="0" disabled={pending} className={buttonClass("gray", "sm")}>
          Save invite only
        </button>
        {gmailOn && (
          <button name="send" value="1" disabled={pending} className={buttonClass("filled", "sm")}>
            <Mail size={13} /> {pending ? "Sending…" : "Send from my Gmail"}
          </button>
        )}
      </div>
    </form>
  );
}
