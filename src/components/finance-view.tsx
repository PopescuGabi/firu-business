import { ArrowDownLeft, ArrowUpRight, Check, PiggyBank, Pencil, Trash2, Wallet } from "lucide-react";
import clsx from "clsx";
import { addMoney, deleteMoney, markPaid, saveBudget, setMoneyCurrency, updateMoney } from "@/app/actions/finance";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, loadFinance, type MoneyRow } from "@/lib/finance";
import { CURRENCIES, formatMoney, type Currency } from "@/lib/fx-math";
import { loadPosts } from "@/lib/marketing";
import { fmtDate } from "@/lib/time";
import { Bars, Donut, Meter } from "./charts";
import { Sheet } from "./sheet";
import { DeleteFooter, Submit } from "./submit";
import { buttonClass, Card, Empty, Field, segmentClass, segmentGroupClass } from "./ui";

type Client = { id: number; name: string; color: string };

function MoneyForm({ kind, clients, action, row, clientId, today, currency }: { kind: "income" | "expense"; clients: Client[]; action: (fd: FormData) => Promise<void>; row?: MoneyRow; clientId?: number; today: string; currency: Currency }) {
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Amount">
          <input name="amount" required inputMode="decimal" defaultValue={row ? (row.amountCents / 100).toFixed(2) : ""} placeholder="e.g. 1.500" className="field text-[17px] font-semibold" autoFocus />
        </Field>
        <Field label="Currency">
          <select name="currency" defaultValue={row?.currency ?? currency} className="field">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === "RON" ? "lei" : "€"}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input name="date" type="date" required defaultValue={row?.date ?? today} className="field" />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={row?.category ?? cats[0]} className="field">
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      {kind === "income" && (
        <>
          <Field label="From client">
            <select name="clientId" defaultValue={row?.clientId ?? clientId ?? ""} className="field">
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select name="status" defaultValue={row?.status ?? "paid"} className="field">
                <option value="paid">Paid</option>
                <option value="waiting">Waiting for it</option>
              </select>
            </Field>
            <Field label="Due (if waiting)">
              <input name="due" type="date" defaultValue={row?.due ?? ""} className="field" />
            </Field>
          </div>
        </>
      )}
      <Field label="Note (optional)">
        <input name="note" maxLength={300} defaultValue={row?.note ?? ""} className="field" />
      </Field>
      <Submit className="self-end">{row ? "Save" : kind === "income" ? "Add income" : "Add spending"}</Submit>
    </form>
  );
}

function Tile({ label, value, sub, tone, icon }: { label: string; value: string; sub?: React.ReactNode; tone?: "green" | "red" | "orange"; icon?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-label-2">
        {icon}
        {label}
      </p>
      <p className={clsx("text-[26px] leading-tight font-bold tracking-tight tabular-nums", tone === "green" && "text-green", tone === "red" && "text-red", tone === "orange" && "text-orange")}>{value}</p>
      {sub && <p className="truncate text-[12px] text-label-2">{sub}</p>}
    </Card>
  );
}

/** Clients → Finance (everything) or a client's Finance tab (what they paid and owe). */
export async function FinanceView({ uid, clients, clientId, today, currency }: { uid: number; clients: Client[]; clientId?: number; today: string; currency: Currency }) {
  const [f, posts] = await Promise.all([loadFinance(uid, today, currency, clientId), loadPosts(uid, clientId)]);
  const fmt = (c: number) => formatMoney(c, currency, { compact: true });
  const full = (c: number) => formatMoney(c, currency);
  const clientName = (cid: number | null) => clients.find((c) => c.id === cid)?.name ?? "No client";
  const monthLabels = f.months.map((m) => fmtDate(`${m}-01`, { month: "short" }));
  const net = f.incomeThisMonth - f.spendThisMonth;
  // Income per posted piece, per client, over the year.
  const perPost = clients
    .map((c) => {
      const income = f.items.filter((r) => r.kind === "income" && r.status === "paid" && r.clientId === c.id).reduce((n, r) => n + r.value, 0);
      const n = posts.filter((p) => p.clientId === c.id).length;
      return { name: c.name, income, posts: n, per: n ? income / n : 0 };
    })
    .filter((x) => x.income > 0 || x.posts > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Sheet title="Add income" trigger={<><ArrowDownLeft size={16} /> Income</>} triggerClassName={buttonClass("filled")}>
          <MoneyForm kind="income" clients={clients} action={addMoney} clientId={clientId} today={today} currency={currency} />
        </Sheet>
        {!clientId && (
          <>
            <Sheet title="Add spending" trigger={<><ArrowUpRight size={16} /> Spending</>} triggerClassName={buttonClass("gray")}>
              <MoneyForm kind="expense" clients={clients} action={addMoney} today={today} currency={currency} />
            </Sheet>
            <Sheet title="Monthly budgets" trigger={<><PiggyBank size={15} /> Budgets</>} triggerClassName={buttonClass("gray")}>
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-label-2">A monthly limit per category. Leave empty for none.</p>
                {EXPENSE_CATEGORIES.map((c) => {
                  const b = f.budgets.find((x) => x.category === c);
                  return (
                    <form key={c} action={saveBudget} data-keep-open className="grid grid-cols-[1fr_110px_76px_auto] items-center gap-2">
                      <input type="hidden" name="category" value={c} />
                      <span className="text-[14px] font-medium">{c}</span>
                      <input name="amount" inputMode="decimal" defaultValue={b ? (b.limitCents / 100).toFixed(0) : ""} aria-label={`${c} budget`} className="field" />
                      <select name="currency" defaultValue={b?.currency ?? currency} className="field" aria-label="Currency">
                        {CURRENCIES.map((x) => (
                          <option key={x} value={x}>
                            {x === "RON" ? "lei" : "€"}
                          </option>
                        ))}
                      </select>
                      <Submit size="sm" variant="gray" doneLabel="✓">
                        Set
                      </Submit>
                    </form>
                  );
                })}
              </div>
            </Sheet>
          </>
        )}
        <div role="radiogroup" aria-label="Show amounts in" className={clsx(segmentGroupClass, "ml-auto p-1")}>
          {CURRENCIES.map((c) => (
            <form key={c} action={setMoneyCurrency.bind(null, c)}>
              <button role="radio" aria-checked={currency === c} className={clsx("h-8 px-4 text-[14px]", segmentClass(currency === c))}>
                {c === "RON" ? "lei" : "€"}
              </button>
            </form>
          ))}
        </div>
      </div>

      {f.items.length === 0 && f.waiting.length === 0 ? (
        <Empty icon={<Wallet size={36} />} title="No money logged yet">
          Add what clients pay you{clientId ? "" : " and what you spend"}, in lei or euros. Charts convert everything with the European Central Bank&apos;s rate for each day.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Income this month" value={fmt(f.incomeThisMonth)} icon={<ArrowDownLeft size={14} />} sub={`${fmt(f.income.reduce((a, b) => a + b, 0))} in 12 months`} />
            {!clientId && <Tile label="Spent this month" value={fmt(f.spendThisMonth)} icon={<ArrowUpRight size={14} />} sub={`${fmt(f.spending.reduce((a, b) => a + b, 0))} in 12 months`} />}
            {!clientId && <Tile label="Left this month" value={fmt(net)} tone={net >= 0 ? "green" : "red"} sub="Income minus spending" />}
            <Tile label="Waiting for" value={fmt(f.waitingTotal)} tone={f.overdue.length ? "red" : f.waiting.length ? "orange" : undefined} sub={f.overdue.length ? `${f.overdue.length} overdue` : `${f.waiting.length} payment${f.waiting.length === 1 ? "" : "s"}`} />
          </div>

          <Card className="p-4">
            <p className="mb-3 text-[15px] font-semibold">{clientId ? "Paid per month" : "Income and spending per month"}</p>
            <Bars
              labels={monthLabels}
              highlight={monthLabels.length - 1}
              format={fmt}
              series={clientId ? [{ label: "Income", values: f.income, color: "var(--green)" }] : [{ label: "Income", values: f.income, color: "var(--green)" }, { label: "Spending", values: f.spending, color: "var(--accent)" }]}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {!clientId && (
              <Card className="p-4">
                <p className="mb-3 text-[15px] font-semibold">Income by client · 12 months</p>
                <Donut parts={f.incomeByClient(clientName)} center={fmt(f.income.reduce((a, b) => a + b, 0))} sub="paid" format={fmt} />
              </Card>
            )}
            {!clientId && (
              <Card className="p-4">
                <p className="mb-3 text-[15px] font-semibold">Spending by category · 3 months</p>
                <Donut parts={f.spendingByCategory} center={fmt(f.spendingByCategory.reduce((n, p) => n + p.value, 0))} sub="spent" format={fmt} />
              </Card>
            )}
            {f.budgets.length > 0 && (
              <Card className="flex flex-col gap-3 p-4">
                <p className="text-[15px] font-semibold">Budgets this month</p>
                {f.budgets.map((b) => (
                  <Meter key={b.category} budget label={b.category} value={b.spent} target={b.limit} display={`${fmt(b.spent)} of ${fmt(b.limit)}`} />
                ))}
              </Card>
            )}
            {perPost.length > 0 && (
              <Card className="p-4">
                <p className="mb-3 text-[15px] font-semibold">Income per posted piece · 12 months</p>
                <ul className="flex flex-col gap-2 text-[14px]">
                  {perPost.map((x) => (
                    <li key={x.name} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">{x.name}</span>
                      <span className="text-label-2 tabular-nums">
                        {fmt(x.income)} · {x.posts} posts
                      </span>
                      <strong className="w-24 text-right tabular-nums">{x.posts ? fmt(x.per) : "—"}</strong>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {f.waiting.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-[15px] font-semibold">Waiting for payment</p>
              <ul className="flex flex-col divide-y divide-separator">
                {f.waiting.map((r) => {
                  const late = r.due && r.due < today;
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2 text-[14px]">
                      <span className="min-w-0 flex-1 truncate">
                        {clientName(r.clientId)}
                        {r.note && <span className="text-label-2"> · {r.note}</span>}
                      </span>
                      <span className={clsx("text-[12px]", late ? "font-semibold text-red" : "text-label-2")}>{r.due ? `${late ? "Overdue since" : "Due"} ${fmtDate(r.due, { day: "numeric", month: "short" })}` : "No due date"}</span>
                      <strong className="tabular-nums">{formatMoney(r.amountCents, r.currency as Currency)}</strong>
                      <form action={markPaid.bind(null, r.id)}>
                        <button className={buttonClass("tinted", "sm")}>
                          <Check size={13} /> Paid
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card className="divide-y divide-separator">
            {f.items.slice(0, 40).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full", r.kind === "income" ? "bg-green/15 text-green" : "bg-fill text-label-2")}>
                  {r.kind === "income" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.kind === "income" ? clientName(r.clientId) : r.category}</p>
                  <p className="truncate text-[12px] text-label-2">
                    {fmtDate(r.date, { day: "numeric", month: "short", year: "numeric" })} · {r.category}
                    {r.status === "waiting" && " · waiting"}
                    {r.note && ` · ${r.note}`}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className={clsx("font-semibold", r.kind === "income" && "text-green")}>
                    {r.kind === "income" ? "+" : "−"}
                    {formatMoney(r.amountCents, r.currency as Currency)}
                  </p>
                  {r.currency !== currency && <p className="text-[11px] text-label-2">≈ {full(r.value)}</p>}
                </div>
                <Sheet title={r.kind === "income" ? "Edit income" : "Edit spending"} trigger={<Pencil size={15} />} triggerLabel="Edit" triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill">
                  <MoneyForm kind={r.kind as "income" | "expense"} clients={clients} action={updateMoney.bind(null, r.id)} row={r} today={today} currency={currency} />
                  <DeleteFooter action={deleteMoney.bind(null, r.id)} message="Delete this entry?">
                    <Trash2 size={15} /> Delete
                  </DeleteFooter>
                </Sheet>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
