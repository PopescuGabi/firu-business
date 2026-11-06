// Pure: ready-made pages by kind of job, for people who'd rather not use the AI setup.
// Built from the same blocks as AI pages; tests check every one passes parsePageDraft cleanly.
import type { ModuleKey } from "./modules.ts";

type Raw = Record<string, unknown>;
export type TemplateGroup = { key: string; label: string; description: string; icon: string; modules: ModuleKey[]; pages: Raw[] };

const money = (key: string, label: string) => ({ key, label, type: "money", unit: "lei" });
const select = (key: string, label: string, options: string[]) => ({ key, label, type: "select", options });

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    key: "creative",
    label: "Creative",
    description: "Photo, video and design: projects from inquiry to paid, deposits, income and gear.",
    icon: "camera",
    modules: ["clients", "portfolio", "email"],
    pages: [
      {
        title: "Projects",
        icon: "camera",
        color: "#FF9F0A",
        description: "Every job from first message to paid",
        spec: {
          collections: [
            {
              key: "projects",
              name: "Projects",
              singular: "Project",
              titleField: "project",
              fields: [
                { key: "project", label: "Project", type: "text" },
                { key: "client", label: "Client", type: "text" },
                select("kind", "Type", ["Wedding", "Portrait", "Event", "Commercial", "Video", "Design"]),
                { key: "date", label: "Shoot / start date", type: "date" },
                { key: "deadline", label: "Delivery deadline", type: "date" },
                money("price", "Price"),
                { key: "deposit_paid", label: "Deposit paid", type: "checkbox" },
                select("status", "Status", ["Inquiry", "Booked", "In progress", "Editing", "Delivered", "Paid"]),
                { key: "notes", label: "Notes", type: "longtext" },
              ],
            },
          ],
          blocks: [
            { type: "board", id: "pipeline", title: "Pipeline", collection: "projects", groupBy: "status" },
            { type: "upcoming", id: "next", title: "Coming up", collection: "projects", dateField: "date", limit: 5, home: true },
            { type: "upcoming", id: "deadlines", title: "Delivery deadlines", collection: "projects", dateField: "deadline", limit: 5 },
            {
              type: "stats",
              id: "month",
              title: "This month",
              collection: "projects",
              stats: [
                { label: "Projects", op: "count", period: "month" },
                { label: "Income", op: "sum", field: "price", period: "month" },
                { label: "Editing", op: "count", where: { field: "status", value: "Editing" } },
                { label: "Average price", op: "avg", field: "price" },
              ],
            },
            { type: "chart", id: "income", title: "Income by month", collection: "projects", op: "sum", field: "price", by: "month", dateField: "date" },
            { type: "table", id: "all", title: "All projects", collection: "projects", columns: ["project", "client", "kind", "date", "price", "status"], sortBy: "date", desc: true },
          ],
        },
      },
      {
        title: "Gear",
        icon: "package",
        color: "#64D2FF",
        description: "What you own and what to pack",
        spec: {
          collections: [
            {
              key: "gear",
              name: "Gear",
              singular: "Item",
              titleField: "item",
              fields: [
                { key: "item", label: "Item", type: "text" },
                select("category", "Category", ["Camera", "Lens", "Lighting", "Audio", "Storage", "Other"]),
                { key: "packed", label: "Packed", type: "checkbox" },
                { key: "serial", label: "Serial number", type: "text" },
                money("value", "Value"),
              ],
            },
          ],
          blocks: [
            { type: "checklist", id: "pack", title: "Packing list", collection: "gear", doneField: "packed" },
            { type: "stats", id: "totals", title: "Kit", collection: "gear", stats: [{ label: "Items", op: "count" }, { label: "Total value", op: "sum", field: "value" }] },
            { type: "table", id: "all", title: "All gear", collection: "gear", columns: ["item", "category", "serial", "value"], sortBy: "category" },
          ],
        },
      },
    ],
  },
  {
    key: "technical",
    label: "Engineer / IT",
    description: "Projects by phase, deadlines, an hours log and your references.",
    icon: "ruler",
    modules: ["email"],
    pages: [
      {
        title: "Projects",
        icon: "ruler",
        color: "#0A84FF",
        description: "Phases, deadlines and budgets",
        spec: {
          collections: [
            {
              key: "projects",
              name: "Projects",
              singular: "Project",
              titleField: "name",
              fields: [
                { key: "name", label: "Project", type: "text" },
                { key: "client", label: "Client / team", type: "text" },
                select("phase", "Phase", ["Planning", "Design", "Build", "Testing", "Done"]),
                select("priority", "Priority", ["Low", "Medium", "High"]),
                { key: "deadline", label: "Deadline", type: "date" },
                { key: "hours", label: "Estimated hours", type: "number", unit: "h" },
                money("budget", "Budget"),
                { key: "notes", label: "Notes", type: "longtext" },
              ],
            },
          ],
          blocks: [
            { type: "board", id: "phases", title: "By phase", collection: "projects", groupBy: "phase" },
            { type: "upcoming", id: "deadlines", title: "Deadlines", collection: "projects", dateField: "deadline", limit: 6, home: true },
            {
              type: "stats",
              id: "load",
              title: "Workload",
              collection: "projects",
              stats: [
                { label: "Open projects", op: "count" },
                { label: "High priority", op: "count", where: { field: "priority", value: "High" } },
                { label: "Estimated hours", op: "sum", field: "hours" },
              ],
            },
            { type: "table", id: "all", title: "All projects", collection: "projects", columns: ["name", "client", "phase", "priority", "deadline"], sortBy: "deadline" },
          ],
        },
      },
      {
        title: "Time log",
        icon: "clock",
        color: "#30D158",
        description: "Hours per task and project",
        spec: {
          collections: [
            {
              key: "entries",
              name: "Entries",
              singular: "Entry",
              titleField: "task",
              fields: [
                { key: "task", label: "Task", type: "text" },
                { key: "project", label: "Project", type: "text" },
                { key: "date", label: "Date", type: "date" },
                { key: "hours", label: "Hours", type: "number", unit: "h" },
                { key: "billable", label: "Billable", type: "checkbox" },
              ],
            },
          ],
          blocks: [
            { type: "stats", id: "month", title: "This month", collection: "entries", stats: [{ label: "Hours", op: "sum", field: "hours", period: "month" }, { label: "Entries", op: "count", period: "month" }], home: true },
            { type: "chart", id: "hours", title: "Hours by month", collection: "entries", op: "sum", field: "hours", by: "month", dateField: "date" },
            { type: "table", id: "all", title: "All entries", collection: "entries", columns: ["date", "task", "project", "hours", "billable"], sortBy: "date", desc: true },
          ],
        },
      },
      {
        title: "References",
        icon: "book",
        color: "#BF5AF2",
        description: "Standards, docs and notes",
        spec: { collections: [], blocks: [{ type: "links", id: "links", title: "Links" }, { type: "notes", id: "notes", title: "Notes" }] },
      },
    ],
  },
  {
    key: "health",
    label: "Health / shifts",
    description: "Shifts, hours and pay, certifications to renew and checklists. No patient data.",
    icon: "stethoscope",
    modules: [],
    pages: [
      {
        title: "Shifts",
        icon: "stethoscope",
        color: "#30D158",
        description: "Shifts, hours and pay",
        spec: {
          collections: [
            {
              key: "shifts",
              name: "Shifts",
              singular: "Shift",
              titleField: "shift",
              fields: [
                { key: "shift", label: "Shift", type: "text" },
                { key: "date", label: "Date", type: "date" },
                select("kind", "Type", ["Day", "Night", "Weekend", "On call"]),
                { key: "hours", label: "Hours", type: "number", unit: "h" },
                money("pay", "Pay"),
                { key: "place", label: "Place", type: "text" },
                { key: "paid", label: "Paid", type: "checkbox" },
              ],
            },
          ],
          blocks: [
            { type: "upcoming", id: "next", title: "Next shifts", collection: "shifts", dateField: "date", limit: 6, home: true },
            {
              type: "stats",
              id: "month",
              title: "This month",
              collection: "shifts",
              stats: [
                { label: "Shifts", op: "count", period: "month" },
                { label: "Hours", op: "sum", field: "hours", period: "month" },
                { label: "Pay", op: "sum", field: "pay", period: "month" },
                { label: "Night shifts", op: "count", period: "month", where: { field: "kind", value: "Night" } },
              ],
            },
            { type: "chart", id: "hours", title: "Hours by month", collection: "shifts", op: "sum", field: "hours", by: "month", dateField: "date" },
            { type: "table", id: "all", title: "All shifts", collection: "shifts", columns: ["date", "shift", "kind", "hours", "pay", "paid"], sortBy: "date", desc: true },
          ],
        },
      },
      {
        title: "Certifications",
        icon: "star",
        color: "#FF9F0A",
        description: "Licences and courses to renew",
        spec: {
          collections: [
            {
              key: "certs",
              name: "Certifications",
              singular: "Certification",
              titleField: "name",
              fields: [
                { key: "name", label: "Name", type: "text" },
                { key: "expires", label: "Expires", type: "date" },
                select("status", "Status", ["Valid", "Renew soon", "Expired"]),
                { key: "notes", label: "Notes", type: "longtext" },
              ],
            },
            {
              key: "checks",
              name: "Checklist",
              singular: "Task",
              titleField: "task",
              fields: [
                { key: "task", label: "Task", type: "text" },
                { key: "done", label: "Done", type: "checkbox" },
              ],
            },
          ],
          blocks: [
            { type: "upcoming", id: "renew", title: "Renew next", collection: "certs", dateField: "expires", limit: 5 },
            { type: "table", id: "all", title: "All certifications", collection: "certs", columns: ["name", "expires", "status"], sortBy: "expires" },
            { type: "checklist", id: "checks", title: "Checklist", collection: "checks", doneField: "done" },
          ],
        },
      },
    ],
  },
];

export const templateKey = (group: string, index: number) => `${group}:${index}`;

/** The raw template for a key like "creative:0", or null. */
export function templateFor(key: string): Raw | null {
  const [g, i] = key.split(":");
  return TEMPLATE_GROUPS.find((x) => x.key === g)?.pages[Number(i)] ?? null;
}
