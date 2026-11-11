"use client";
import { useActionState, useTransition } from "react";
import { Upload } from "lucide-react";
import { importLeads, setLeadStatus, type ImportState } from "@/app/actions/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/schema";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL } from "@/lib/leads";
import { GlassButton } from "./glass";

/** Upload the Business Brain's leads.csv; new leads are added and known ones updated. */
export function ImportLeads() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importLeads, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="leads-file">
        leads.csv
      </label>
      <input
        id="leads-file"
        name="file"
        type="file"
        accept=".csv,text/csv"
        required
        className="max-w-[220px] text-[13px] text-label-2 file:mr-2 file:rounded-full file:border-0 file:bg-fill file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-label"
      />
      <GlassButton type="submit" size="sm" loading={pending} icon={<Upload size={15} aria-hidden />}>
        Import leads.csv
      </GlassButton>
      {state && (
        <span role="status" className="text-[13px]" style={{ color: state.ok ? "var(--green)" : "var(--red)" }}>
          {state.message}
        </span>
      )}
    </form>
  );
}

/** Where a lead stands. Changing it only records what Gabi did; nothing is sent from here. */
export function LeadStatusSelect({ id, status, business }: { id: number; status: LeadStatus; business: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Status of ${business}`}
      value={status}
      disabled={pending}
      onChange={(e) => start(() => setLeadStatus(id, e.target.value))}
      className="h-8 rounded-full border-0 bg-fill px-3 text-[13px] font-medium outline-offset-2"
      style={{ color: LEAD_STATUS_COLOR[status] }}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {LEAD_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
