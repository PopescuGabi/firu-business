import { eq } from "drizzle-orm";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { getDb, schema } from "@/lib/db";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/fx-math";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/time";
import { todayIn } from "@/lib/week";

export const maxDuration = 60;

const SYSTEM = `You look over one freelancer's money (income from clients, personal spending, monthly budgets) and say what to watch this month.
Write 4 to 6 short bullets, most useful first: categories over or near budget, overdue or waiting client payments worth chasing (by client), how this month compares with recent months, and one concrete saving or pricing idea.
Use only the numbers given; say when there's too little data. Plain English, no jargon. No investment, tax or legal advice.`;

/** Finance insights (Haiku). Totals only: no notes, no individual entries. Without a key, returns the prompt for the Claude app. */
export async function POST() {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  if (!user.modules.includes("clients")) return Response.json({ error: "Turn on the Clients section first" }, { status: 400 });
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const currency = settings.moneyCurrency;
  const db = await getDb();
  const [f, clients] = await Promise.all([
    loadFinance(user.id, today, currency),
    db.select({ id: schema.clients.id, name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.userId, user.id)),
  ]);
  if (!f.items.length && !f.waiting.length) return Response.json({ error: "Log some income or spending first." }, { status: 400 });
  const m = (c: number) => formatMoney(c, currency);
  const clientName = (id: number | null) => clients.find((c) => c.id === id)?.name ?? "No client";
  const last = f.months.slice(-4);
  const offset = f.months.length - last.length;

  const prompt = [
    `Today is ${today}. Amounts in ${currency}.`,
    `Month by month (paid income / spending):\n${last.map((mo, i) => `- ${fmtDate(`${mo}-01`, { month: "long", year: "numeric" })}: ${m(f.income[offset + i])} / ${m(f.spending[offset + i])}`).join("\n")}`,
    f.spendingByCategory.length ? `Spending by category, last 3 months:\n${f.spendingByCategory.map((c) => `- ${c.label}: ${m(c.value)}`).join("\n")}` : "",
    f.budgets.length ? `Budgets this month (spent / limit):\n${f.budgets.map((b) => `- ${b.category}: ${m(b.spent)} / ${m(b.limit)}`).join("\n")}` : "No budgets set.",
    `Paid income by client, last 12 months:\n${f.incomeByClient(clientName).map((c) => `- ${c.label}: ${m(c.value)}`).join("\n") || "- none"}`,
    f.waiting.length
      ? `Waiting payments (${m(f.waitingTotal)} in total):\n${f.waiting.map((w) => `- ${clientName(w.clientId)}: ${m(w.value)}${w.due ? `, due ${w.due}${w.due < today ? " (overdue)" : ""}` : ""}`).join("\n")}`
      : "No payments waiting.",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!(await claudeAvailable(user.id))) return Response.json({ prompt: `${SYSTEM}\n\n${prompt}` });
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor("quick");
    const final = await (await claude(user.id)).beta.messages
      .stream({ ...ai, max_tokens: 2000, output_config: { effort: "low" }, system: SYSTEM, messages: [{ role: "user", content: prompt }] })
      .finalMessage();
    await recordUsage(user.id, "finance", final.usage, ai.model);
    if (final.stop_reason === "refusal") throw new Error("Claude declined this one.");
    return Response.json({ text: final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim() });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
