// Currency maths for RON / EUR, kept pure (no database) so it can be tested.

export type Currency = "RON" | "EUR";
export const CURRENCIES: Currency[] = ["RON", "EUR"];

/** Cents in one currency → cents in another, with `ronPerEur` lei for one euro. */
export function convertCents(cents: number, from: Currency, to: Currency, ronPerEur: number) {
  if (from === to) return cents;
  return Math.round(from === "EUR" ? cents * ronPerEur : cents / ronPerEur);
}

/** ECB rates are published on working days; weekends and holidays use the last rate before them. */
export function rateOn(date: string, rates: Map<string, number>, sortedDates: string[]): number | undefined {
  const exact = rates.get(date);
  if (exact) return exact;
  let lo = 0;
  let hi = sortedDates.length - 1;
  let best: string | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= date) {
      best = sortedDates[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best ? rates.get(best) : sortedDates.length ? rates.get(sortedDates[0]) : undefined;
}

/** "1234.5" or "1.234,50" → 123450 cents (null when it isn't an amount). */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  const hasDecimals = decimalAt !== -1 && s.length - decimalAt - 1 <= 2;
  const whole = (hasDecimals ? s.slice(0, decimalAt) : s).replace(/[.,]/g, "");
  const frac = hasDecimals ? s.slice(decimalAt + 1).padEnd(2, "0") : "00";
  const cents = Number(whole) * 100 + Number(frac);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatMoney(cents: number, currency: Currency, { compact = false } = {}) {
  const value = cents / 100;
  if (compact && Math.abs(value) >= 10_000) {
    return `${(value / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}k ${currency === "RON" ? "lei" : "€"}`;
  }
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: compact ? 0 : 2 }).format(value);
}
