// Pure: dashboard filters from the URL, and links that change one of them.
import type { DashQuery } from "../../components/instagram/dashboard";
import { periodFor } from "./stats.ts";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function dashQuery(sp: Params, today: string): DashQuery {
  const p = periodFor(one(sp.range), today, one(sp.from), one(sp.to));
  const kind = one(sp.kind);
  const sort = one(sp.sort);
  return {
    range: p.range,
    from: p.from,
    to: p.to,
    kind: kind === "reel" || kind === "carousel" || kind === "photo" ? kind : "all",
    sort: sort === "reach" || sort === "views" || sort === "engagement" ? sort : "date",
  };
}

/** A link builder that keeps `keep` params (e.g. account, tab) and the current filters. */
export function dashHref(path: string, keep: Record<string, string | undefined>, q: DashQuery) {
  return (change: Partial<DashQuery>) => {
    const n = { ...q, ...change };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v);
    if (n.range !== "30") params.set("range", n.range);
    if (n.range === "custom") {
      params.set("from", n.from);
      params.set("to", n.to);
    }
    if (n.kind !== "all") params.set("kind", n.kind);
    if (n.sort !== "date") params.set("sort", n.sort);
    const s = params.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
}
