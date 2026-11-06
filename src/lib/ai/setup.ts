// The AI setup: questions for a profession, then a proposal (built-in sections + custom pages as specs).
import { z } from "zod";
import { FIELD_TYPES, LIMITS, PAGE_COLORS, PAGE_ICONS, parsePageDraft, type PageDraft } from "../custom-pages.ts";
import { MODULES, isModule, type ModuleKey } from "../modules.ts";

export const whoSchema = z.object({
  profession: z.string().trim().min(2).max(80),
  wish: z.string().trim().max(400).default(""),
});

export const answersSchema = z
  .array(z.object({ question: z.string().max(200), picked: z.array(z.string().max(120)).max(8), other: z.string().max(200).default("") }))
  .max(8);

export const QUESTIONS_SYSTEM = `You set up a personal organiser for someone new. They told you their profession (and maybe what they want help with).
Write 5 to 7 short multiple-choice questions that reveal how they actually work, so the app can build pages that fit them.
Ask about concrete workflows: what they track (projects, clients, shoots, patients, cases, orders…), how work moves (stages/status), money (per job, hourly, salary), deadlines and scheduling, documents or references they keep, and whether they study, train or show a portfolio.
Each question: 2–6 options, plain words, no jargon unless the profession uses it. Use "multi": true when several answers can apply.
Write in the language the profession is written in. Don't ask for personal data (names, addresses, income amounts).`;

export const QUESTIONS_FORMAT = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          multi: { type: "boolean" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["text", "multi", "options"],
      },
    },
  },
  required: ["questions"],
} as const;

export const questionsOut = z.object({
  questions: z.array(z.object({ text: z.string().min(3).max(200), multi: z.boolean(), options: z.array(z.string().min(1).max(80)).min(2) })).min(1),
});
export type SetupQuestion = { text: string; multi: boolean; options: string[] };

/** Trim what the model returned to the limits the UI expects. */
export const tidyQuestions = (q: z.infer<typeof questionsOut>): SetupQuestion[] =>
  q.questions.slice(0, 7).map((x) => ({ text: x.text, multi: x.multi, options: [...new Set(x.options)].slice(0, 6) }));

export const PROPOSE_SYSTEM = `You design someone's personal organiser from their profession and answers. Always answer by calling the propose_setup tool exactly once, with no text before it.

Built-in sections (turn on only those that clearly fit):
${MODULES.map((m) => `- ${m.key}: ${m.description}`).join("\n")}
Home, Today, Calendar and tasks always exist; don't rebuild them.

Custom pages are for the profession's own workflow. 1 to ${LIMITS.pagesPerSetup} pages, each with 2 to 6 blocks. A page has collections (lists of entries with typed fields) and blocks that show them:
- board: cards grouped by a select field (e.g. status: Inquiry, Booked, Shot, Editing, Delivered). Best for anything that moves through stages.
- table: rows with chosen columns, optional sort. cards: a grid of entries.
- checklist: needs a checkbox field ("done"). Good for gear, packing, recurring checks.
- stats: 1–4 numbers (count, or sum/avg of a number/money/rating field; period "month" uses the first date field; optional where {field, value} on a select).
- chart: count or sum by "month" (needs dateField) or by a select field.
- upcoming: next entries by a date/datetime field.
- notes: free text. links: quick links.
Field types: ${FIELD_TYPES.join(", ")}. Select fields need options. Money fields get a unit (e.g. "lei", "€", "$"). Every collection's titleField is a text field.
Mark 1 or 2 stats/upcoming blocks with home: true so they show on the Home screen.
Keys are short snake_case. Block ids are unique per page. Icons: ${PAGE_ICONS.join(", ")}. Colours: ${PAGE_COLORS.join(", ")}.
Example, wedding photographer: page "Shoots" (camera): collection shoots {couple (text), date (date), venue (text), package (select), price (money, lei), deposit_paid (checkbox), status (select: Inquiry, Booked, Shot, Editing, Delivered)}; blocks: board by status, upcoming by date (home), stats (shoots this month, income this month = sum price, month), chart sum price by month. Page "Gear" (package): checklist.
Example, civil engineer: page "Projects" (ruler): projects {name, client, phase (select), deadline (date), hours (number, h), budget (money)}; board by phase, upcoming deadlines (home), table; page "Time log": entries {task, project, date, hours}; chart sum hours by month, stats hours this month; page "References" with links and notes.
Keep names in the person's language. No personal data. Make it genuinely useful for this job, not generic.`;

const blockProps = {
  type: { type: "string", enum: ["board", "table", "cards", "checklist", "stats", "chart", "upcoming", "notes", "links"] },
  id: { type: "string" },
  title: { type: "string" },
  collection: { type: "string" },
  groupBy: { type: "string", description: "board: select field key" },
  columns: { type: "array", items: { type: "string" }, description: "table: field keys" },
  sortBy: { type: "string" },
  desc: { type: "boolean" },
  doneField: { type: "string", description: "checklist: checkbox field key" },
  stats: {
    type: "array",
    maxItems: 4,
    items: {
      type: "object",
      properties: {
        label: { type: "string" },
        op: { type: "string", enum: ["count", "sum", "avg"] },
        field: { type: "string" },
        period: { type: "string", enum: ["all", "month"] },
        where: { type: "object", properties: { field: { type: "string" }, value: { type: "string" } }, required: ["field", "value"] },
      },
      required: ["label", "op"],
    },
  },
  op: { type: "string", enum: ["count", "sum"], description: "chart" },
  field: { type: "string", description: "chart: number field to sum" },
  by: { type: "string", description: 'chart: "month" or a select field key' },
  dateField: { type: "string" },
  limit: { type: "integer", minimum: 1, maximum: 10 },
  home: { type: "boolean", description: "stats/upcoming: also show on Home" },
};

const pageProps = {
  title: { type: "string" },
  icon: { type: "string", enum: [...PAGE_ICONS] },
  color: { type: "string", enum: [...PAGE_COLORS] },
  description: { type: "string", description: "One short line" },
  spec: {
    type: "object",
    properties: {
      collections: {
        type: "array",
        maxItems: LIMITS.collections,
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            name: { type: "string", description: "Plural" },
            singular: { type: "string" },
            titleField: { type: "string" },
            fields: {
              type: "array",
              maxItems: LIMITS.fields,
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  type: { type: "string", enum: [...FIELD_TYPES] },
                  options: { type: "array", items: { type: "string" } },
                  unit: { type: "string" },
                },
                required: ["key", "label", "type"],
              },
            },
          },
          required: ["key", "name", "titleField", "fields"],
        },
      },
      blocks: { type: "array", maxItems: LIMITS.blocks, items: { type: "object", properties: blockProps, required: ["type", "id", "title"] } },
    },
    required: ["collections", "blocks"],
  },
};

/** The page spec as a JSON schema, for tools that propose one page (setup and "Edit with AI"). */
export const PAGE_JSON_SCHEMA = { type: "object" as const, properties: pageProps, required: ["title", "icon", "color", "description", "spec"] };

export const proposeTool = {
  name: "propose_setup",
  description: "Propose which built-in sections to turn on and which custom pages to create for this person.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: { type: "string", description: "One or two sentences for the person: what you set up and why." },
      modules: { type: "array", items: { type: "string", enum: MODULES.map((m) => m.key) } },
      pages: { type: "array", maxItems: LIMITS.pagesPerSetup, items: PAGE_JSON_SCHEMA },
    },
    required: ["summary", "modules", "pages"],
  },
};

export type SetupProposal = { summary: string; modules: ModuleKey[]; pages: PageDraft[]; dropped: string[] };

/** Validates the model's proposal: unknown sections and broken pages are dropped (with reasons). */
export function tidyProposal(raw: unknown): SetupProposal {
  const r = z.object({ summary: z.string().max(600).catch(""), modules: z.array(z.string()).catch([]), pages: z.array(z.unknown()).catch([]) }).catch({ summary: "", modules: [], pages: [] }).parse(raw);
  const dropped: string[] = [];
  const pages: PageDraft[] = [];
  for (const p of r.pages.slice(0, LIMITS.pagesPerSetup)) {
    const { draft, problems } = parsePageDraft(p);
    if (draft) pages.push(draft);
    dropped.push(...problems.map((x) => `${draft?.title ?? (p as { title?: string })?.title ?? "A page"}: ${x}`));
  }
  return { summary: r.summary, modules: [...new Set(r.modules.filter(isModule))], pages, dropped };
}
