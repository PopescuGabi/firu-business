"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Route, Search, X } from "lucide-react";
import { fillTravelFromMaps, removePlaceAddress, saveMapsKey, saveTravelPrefs, setPlaceAddress, type MapsState } from "@/app/actions/maps";
import { LiquidButton } from "./liquid-button";
import { Submit } from "./submit";
import { buttonClass, Field } from "./ui";

const Message = ({ state }: { state: MapsState }) =>
  state ? <p className={state.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{state.message}</p> : null;

export function MapsKeyForm({ isSet }: { isSet: boolean }) {
  const [state, act] = useActionState(saveMapsKey, null);
  return (
    <form action={act} className="flex flex-col gap-3">
      {!isSet && (
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-label-2">
          <li>In Google Cloud (console.cloud.google.com), pick or create a project and turn on billing. Google gives a monthly free allowance; usage beyond it is billed to you.</li>
          <li>Enable <strong>Routes API</strong>, <strong>Places API (New)</strong> and <strong>Maps Static API</strong>.</li>
          <li>APIs &amp; Services → Credentials → Create credentials → API key. Restrict it to those three APIs, then paste it here.</li>
        </ol>
      )}
      <Field label="Google Maps API key" hint={isSet ? "A key is saved (encrypted). Paste a new one to replace it." : "It stays on the server and is never shown again."}>
        <input name="key" type="password" autoComplete="off" placeholder={isSet ? "Paste a new key to replace it" : "AIza…"} className="field font-mono" />
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

type Suggestion = { placeId: string; text: string };

/** Type an address; pick one of Google's suggestions to save it for this place. */
function AddressSearch({ name, onDone }: { name: string; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const session = useRef(crypto.randomUUID());
  useEffect(() => {
    if (q.trim().length < 3) return setItems([]);
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/maps/places?q=${encodeURIComponent(q)}&s=${session.current}`, { signal: ctl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setItems(data.suggestions);
        setError("");
      } catch (err) {
        if (!(err instanceof DOMException)) setError(err instanceof Error ? err.message : "Search failed");
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  return (
    <div className="relative">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Address for ${name}…`} aria-label={`Address for ${name}`} className="field !pl-8" autoFocus />
      </label>
      {items.length > 0 && (
        <ul className="chrome absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-[14px] !bg-[var(--bg-elevated)] p-1">
          {items.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                disabled={pending}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[14px] hover:bg-fill"
                onClick={() =>
                  start(async () => {
                    const r = await setPlaceAddress(name, s.placeId, session.current);
                    if (r?.ok) onDone();
                    else setError(r?.message ?? "Couldn't save");
                  })
                }
              >
                <MapPin size={14} className="shrink-0 text-accent" />
                <span className="truncate">{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-[13px] text-red">{error}</p>}
    </div>
  );
}

/** Each travel-time place with its address; "Fill from Google Maps" turns them into minutes. */
export function AddressList({
  names,
  saved,
  travelMode,
  modes,
}: {
  names: string[];
  saved: Record<string, string>;
  travelMode: string;
  modes: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [state, fill, filling] = useActionState(fillTravelFromMaps, null);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-separator rounded-[16px] bg-well">
        {names.map((n) => (
          <li key={n} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
            <span className="w-32 shrink-0 text-[14px] font-semibold capitalize">{n}</span>
            <div className="min-w-0 flex-1">
              {editing === n ? (
                <AddressSearch
                  name={n}
                  onDone={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              ) : (
                <p className={saved[n] ? "truncate text-[14px]" : "text-[14px] text-label-3"}>{saved[n] ?? "No address yet"}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {editing === n ? (
                <button type="button" className={buttonClass("gray", "sm")} onClick={() => setEditing(null)}>
                  Cancel
                </button>
              ) : (
                <button type="button" className={buttonClass("tinted", "sm")} onClick={() => setEditing(n)}>
                  {saved[n] ? "Change" : "Add address"}
                </button>
              )}
              {saved[n] && editing !== n && (
                <button type="button" aria-label={`Remove ${n}'s address`} className={buttonClass("destructive", "sm")} onClick={() => start(() => removePlaceAddress(n))}>
                  <X size={13} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form action={saveTravelPrefs} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="How you usually travel">
          <select name="travelMode" defaultValue={travelMode} className="field">
            {modes.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Submit variant="gray">Save</Submit>
      </form>

      <form action={fill} className="flex flex-wrap items-center justify-end gap-3">
        <Message state={state} />
        <LiquidButton
          disabled={filling}
          state={filling ? "busy" : state?.ok ? "done" : "idle"}
          label="Fill from Google Maps"
          busyLabel="Asking Google…"
          doneLabel="Filled"
          chip
          icon={<Route size={15} />}
        />
      </form>
    </div>
  );
}
