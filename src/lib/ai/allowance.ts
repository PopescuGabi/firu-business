// Pure (no server imports): prices and the monthly AI allowance maths, shared by the server and tests.

/** List prices, USD per million tokens (input, output), for usage estimates and the allowance. */
export const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const FALLBACK_PRICE = PRICES["claude-opus-5-5"]; // unknown model: assume the most expensive

/** Each person's AI allowance per calendar month when the owner hasn't set one. */
export const DEFAULT_ALLOWANCE_USD = 10;

export type UsageRow = { model: string; input: number; output: number };

/** Estimated USD for usage rows (token counts per model). */
export function costUsd(rows: UsageRow[]) {
  return rows.reduce((sum, r) => {
    const [pin, pout] = PRICES[r.model] ?? FALLBACK_PRICE;
    return sum + (r.input * pin + r.output * pout) / 1_000_000;
  }, 0);
}

/** Start of the calendar month (UTC) that `now` falls in; the allowance resets then. */
export function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** "$1.20" */
export const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en-US")}`;
