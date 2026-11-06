"use client";
import { useActionState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { deleteMyAccount, inviteMember, removeMember, saveAiAllowance, saveAnthropicKey, withdrawInvite, type FormState } from "@/app/actions/account";
import { Submit } from "./submit";
import { buttonClass, Field } from "./ui";

const Message = ({ state }: { state: FormState }) =>
  state ? <p className={state.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{state.message}</p> : null;

export function InviteForm() {
  const [state, act] = useActionState(inviteMember, null);
  return (
    <form action={act} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input name="email" type="email" required placeholder="their.google.account@gmail.com" aria-label="Email to invite" className="field" />
        <Submit className="shrink-0">
          <UserPlus size={15} /> Invite
        </Submit>
      </div>
      <Message state={state} />
    </form>
  );
}

export function RemoveMember({ uid, email }: { uid: number; email: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("destructive", "sm")}
      onClick={() => confirm(`Remove ${email}? Everything they stored in Personal Hub is deleted. Their Google files stay in their Google account.`) && start(() => removeMember(uid))}
    >
      <Trash2 size={13} /> {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function WithdrawInvite({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={buttonClass("gray", "sm")} onClick={() => start(() => withdrawInvite(email))}>
      {pending ? "…" : "Cancel invite"}
    </button>
  );
}

export function AnthropicKeyForm({ isSet }: { isSet: boolean }) {
  const [state, act] = useActionState(saveAnthropicKey, null);
  return (
    <form action={act} className="flex flex-col gap-2">
      <Field label="Anthropic API key" hint={isSet ? "A key is saved (encrypted). Everyone in your hub uses it, within their monthly allowance. Paste a new one to replace it." : "From console.anthropic.com → API keys. Everyone in your hub uses it, billed to your Anthropic account; set a spend limit there too."}>
        <input name="key" type="password" autoComplete="off" placeholder={isSet ? "Paste a new key to replace it" : "sk-ant-…"} className="field font-mono" />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Message state={state} />
        {isSet && (
          <button name="remove" value="1" className={buttonClass("gray")}>
            Remove key
          </button>
        )}
        <Submit>Save key</Submit>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  return (
    <form
      action={deleteMyAccount}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!confirm("Delete your Personal Hub account and everything in it? This can't be undone.")) e.preventDefault();
      }}
    >
      <Field label={`Type ${email} to confirm`}>
        <input name="confirm" required autoComplete="off" className="field" />
      </Field>
      <button className={buttonClass("destructive") + " self-end"}>
        <Trash2 size={15} /> Delete my account
      </button>
    </form>
  );
}

/** Owner: how much AI each member may use per month on the hub's key. */
export function AllowanceForm({ usd }: { usd: number }) {
  const [state, act] = useActionState(saveAiAllowance, null);
  return (
    <form action={act} className="flex flex-wrap items-end gap-2">
      <Field label="AI allowance per member, per month ($)" hint="Estimated from list prices; resets on the 1st. You have no limit.">
        <input name="usd" inputMode="decimal" defaultValue={usd} required aria-label="AI allowance in dollars" className="field w-32" />
      </Field>
      <Submit variant="gray">Save</Submit>
      <Message state={state} />
    </form>
  );
}
