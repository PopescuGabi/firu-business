import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "./db";
import { converter } from "./fx";
import type { Currency } from "./fx-math";
import { addDays } from "./time";

export const INCOME_CATEGORIES = ["Client payment", "Other income"];
export const EXPENSE_CATEGORIES = ["Rent", "Food", "Transport", "Gear", "Software", "Subscriptions", "Fun", "Other"];

export type MoneyRow = typeof schema.money.$inferSelect & { value: number }; // value: cents in the display currency

const monthOf = (d: string) => d.slice(0, 7);
/** The last `n` months as yyyy-mm, oldest first, ending with `today`'s month. */
export function lastMonths(today: string, n: number) {
  const out: string[] = [];
  let d = `${monthOf(today)}-15`;
  for (let i = 0; i < n; i++) {
    out.unshift(monthOf(d));
    d = addDays(`${monthOf(d)}-01`, -1);
  }
  return out;
}

/**
 * Money in and out for the last 12 months (one client's, or everything), converted to `currency` at each
 * entry's own date, plus the budgets and the totals the charts need.
 */
export async function loadFinance(uid: number, today: string, currency: Currency, clientId?: number) {
  const db = await getDb();
  const months = lastMonths(today, 12);
  const since = `${months[0]}-01`;
  const [rows, budgets, waitingAll, convert] = await Promise.all([
    db
      .select()
      .from(schema.money)
      .where(and(eq(schema.money.userId, uid), gte(schema.money.date, since), clientId ? eq(schema.money.clientId, clientId) : undefined))
      .orderBy(desc(schema.money.date), desc(schema.money.id)),
    clientId ? [] : db.select().from(schema.budgets).where(eq(schema.budgets.userId, uid)).orderBy(schema.budgets.category),
    // Waiting payments can be older than a year.
    db
      .select()
      .from(schema.money)
      .where(and(eq(schema.money.userId, uid), eq(schema.money.kind, "income"), eq(schema.money.status, "waiting"), clientId ? eq(schema.money.clientId, clientId) : undefined))
      .orderBy(schema.money.due),
    converter(since, currency),
  ]);
  const value = (r: typeof schema.money.$inferSelect) => convert(r.amountCents, r.currency as Currency, r.date);
  const items: MoneyRow[] = rows.map((r) => ({ ...r, value: value(r) }));
  const waiting: MoneyRow[] = waitingAll.map((r) => ({ ...r, value: value(r) }));
  const paidIncome = items.filter((r) => r.kind === "income" && r.status === "paid");
  const spending = items.filter((r) => r.kind === "expense");
  const perMonth = (list: MoneyRow[]) => months.map((m) => list.filter((r) => monthOf(r.date) === m).reduce((n, r) => n + r.value, 0));
  const thisMonth = monthOf(today);
  const sumBy = (list: MoneyRow[], key: (r: MoneyRow) => string) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(key(r), (m.get(key(r)) ?? 0) + r.value);
    return [...m].map(([label, v]) => ({ label, value: v }));
  };
  const monthSpend = spending.filter((r) => monthOf(r.date) === thisMonth);
  return {
    months,
    items,
    waiting,
    income: perMonth(paidIncome),
    spending: perMonth(spending),
    incomeThisMonth: paidIncome.filter((r) => monthOf(r.date) === thisMonth).reduce((n, r) => n + r.value, 0),
    spendThisMonth: monthSpend.reduce((n, r) => n + r.value, 0),
    incomeByClient: (clientIdOf: (id: number | null) => string) => sumBy(paidIncome, (r) => clientIdOf(r.clientId)),
    spendingByCategory: sumBy(spending.filter((r) => monthOf(r.date) >= months[9]), (r) => r.category), // last 3 months
    budgets: await Promise.all(
      budgets.map(async (b) => ({
        ...b,
        limit: convert(b.limitCents, b.currency as Currency, today),
        spent: monthSpend.filter((r) => r.category === b.category).reduce((n, r) => n + r.value, 0),
      })),
    ),
    waitingTotal: waiting.reduce((n, r) => n + r.value, 0),
    overdue: waiting.filter((r) => r.due && r.due < today),
  };
}
