"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance";
import { CURRENCIES, parseAmount } from "@/lib/fx-math";
import { saveSettings } from "@/lib/settings";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.coerce.number().int().positive();
const currency = z.enum(CURRENCIES as [string, ...string[]]);
const amount = z.string().transform((s, ctx) => {
  const c = parseAmount(s);
  if (c === null) ctx.addIssue({ code: "custom", message: "Enter an amount, e.g. 250 or 1.250,50" });
  return c ?? 0;
});

function read(fd: FormData) {
  const kind = z.enum(["income", "expense"]).parse(fd.get("kind"));
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const status = kind === "income" ? z.enum(["paid", "waiting"]).catch("paid").parse(fd.get("status")) : "paid";
  return {
    kind,
    amountCents: amount.parse(String(fd.get("amount") ?? "")),
    currency: currency.parse(fd.get("currency")),
    date: day.parse(fd.get("date")),
    category: z.string().refine((c) => categories.includes(c)).catch(categories[0]).parse(fd.get("category")),
    clientId: kind === "income" ? id.nullable().catch(null).parse(fd.get("clientId") || null) : null,
    status,
    due: status === "waiting" ? day.nullable().catch(null).parse(fd.get("due") || null) : null,
    note: z.string().trim().max(300).catch("").parse(fd.get("note") ?? ""),
  };
}

async function checkClient(uid: number, clientId: number | null) {
  if (clientId === null) return;
  const db = await getDb();
  const [c] = await db.select({ id: schema.clients.id }).from(schema.clients).where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
}

const refresh = () => revalidatePath("/", "layout");

export async function addMoney(fd: FormData) {
  const user = await requireUser();
  const v = read(fd);
  await checkClient(user.id, v.clientId);
  const db = await getDb();
  await db.insert(schema.money).values({ userId: user.id, ...v });
  refresh();
}

export async function updateMoney(moneyId: number, fd: FormData) {
  const user = await requireUser();
  const v = read(fd);
  await checkClient(user.id, v.clientId);
  const db = await getDb();
  await db.update(schema.money).set({ ...v, updatedAt: new Date() }).where(and(eq(schema.money.id, id.parse(moneyId)), eq(schema.money.userId, user.id)));
  refresh();
}

/** A waiting payment arrived. */
export async function markPaid(moneyId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(schema.money)
    .set({ status: "paid", due: null, updatedAt: new Date() })
    .where(and(eq(schema.money.id, id.parse(moneyId)), eq(schema.money.userId, user.id)));
  refresh();
}

export async function deleteMoney(moneyId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.money).where(and(eq(schema.money.id, id.parse(moneyId)), eq(schema.money.userId, user.id)));
  refresh();
}

/** A monthly limit for a spending category (an empty amount removes it). */
export async function saveBudget(fd: FormData) {
  const user = await requireUser();
  const category = z.string().refine((c) => EXPENSE_CATEGORIES.includes(c)).parse(fd.get("category"));
  const db = await getDb();
  const raw = String(fd.get("amount") ?? "").trim();
  if (!raw) {
    await db.delete(schema.budgets).where(and(eq(schema.budgets.userId, user.id), eq(schema.budgets.category, category)));
  } else {
    const v = { limitCents: amount.parse(raw), currency: currency.parse(fd.get("currency")) };
    await db
      .insert(schema.budgets)
      .values({ userId: user.id, category, ...v })
      .onConflictDoUpdate({ target: [schema.budgets.userId, schema.budgets.category], set: v });
  }
  refresh();
}

export async function setMoneyCurrency(c: string) {
  const user = await requireUser();
  await saveSettings(user.id, { moneyCurrency: currency.parse(c) as "RON" | "EUR" });
  refresh();
}
