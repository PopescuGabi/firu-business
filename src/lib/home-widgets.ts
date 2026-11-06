// Pure: every widget that can go on Home, its sizes (computer layout: 12 columns, rows of 64px) and what it needs.
import type { WidgetDef } from "./board.ts";
import type { ModuleKey } from "./modules.ts";

export type HomeWidget = WidgetDef & { title: string; hint: string; group: string; needs?: ModuleKey; needsMaps?: boolean };

const DAY = "Your day";
const WORK = "Clients and content";
const BIZ = "Money and results";

const stat = (id: string, title: string, hint: string, group: string, needs?: ModuleKey): HomeWidget => ({
  id,
  title,
  hint,
  group,
  needs,
  size: { w: 3, h: 2 },
  min: { w: 2, h: 2 },
  max: { w: 4, h: 3 },
  phoneW: 1,
});

export const HOME_WIDGETS: HomeWidget[] = [
  { id: "hero", title: "Now and next", hint: "What's on now, what's next, when to leave", group: DAY, size: { w: 6, h: 4 }, min: { w: 4, h: 3 }, max: { w: 12, h: 7 }, phoneH: 6 },
  stat("stat-tasks", "Open tasks", "How many, and what's due today", DAY),
  stat("stat-suggestions", "Suggestions", "Blocks from Plan my week waiting for you", DAY),
  { id: "week", title: "This week", hint: "The next seven days at a glance", group: DAY, size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 12, h: 4 } },
  { id: "tasks", title: "Tasks due soon", hint: "Tick them off from here", group: DAY, size: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 8 } },
  { id: "today", title: "Today", hint: "Today's timeline", group: DAY, size: { w: 6, h: 6 }, min: { w: 4, h: 4 }, max: { w: 12, h: 10 }, phoneH: 7 },
  { id: "busy", title: "Busy this week", hint: "Hours of meetings and planned work per day", group: DAY, size: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 5 }, phoneH: 5 },
  { id: "recommended", title: "Recommended today", hint: "Project time Plan my week suggests", group: DAY, size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 4 } },
  { id: "shortcuts", title: "Shortcuts", hint: "Plan my week, Today, Calendar", group: DAY, size: { w: 3, h: 3 }, min: { w: 3, h: 3 }, max: { w: 6, h: 4 } },
  { id: "route", title: "Today's route", hint: "The map of where you go today", group: DAY, needsMaps: true, size: { w: 4, h: 5 }, min: { w: 3, h: 4 }, max: { w: 12, h: 8 }, phoneH: 6 },
  { id: "inbox", title: "Inbox", hint: "Unread mail; turn one into a task", group: DAY, needs: "email", size: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 8 } },

  stat("stat-work", "In progress", "Reels, carousels and app updates being made", WORK, "clients"),
  stat("stat-review", "Waiting on review", "Sent to clients, not answered yet", WORK, "clients"),
  stat("stat-feedback", "Feedback to fix", "Open client notes", WORK, "clients"),
  stat("stat-clients", "Active clients", "And how much content is open", WORK, "clients"),
  { id: "current-work", title: "Current work", hint: "Everything being scripted, filmed, edited or built", group: WORK, needs: "clients", size: { w: 6, h: 4 }, min: { w: 4, h: 3 }, max: { w: 12, h: 8 } },
  { id: "waiting", title: "Waiting on client review", hint: "With how long each has waited", group: WORK, needs: "clients", size: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 8 } },
  { id: "feedback", title: "Client feedback", hint: "Notes to change, ticked when done", group: WORK, needs: "clients", size: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 8 } },
  { id: "pipeline", title: "Content in progress", hint: "Per client, by status", group: WORK, needs: "clients", size: { w: 6, h: 4 }, min: { w: 3, h: 3 }, max: { w: 12, h: 8 } },
  { id: "app-updates", title: "Latest app updates", hint: "Each client app's newest version", group: WORK, needs: "clients", size: { w: 6, h: 4 }, min: { w: 3, h: 3 }, max: { w: 12, h: 8 } },
  { id: "quick-add", title: "Quick add", hint: "New task, reel, carousel, update or feedback", group: WORK, needs: "clients", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 6, h: 5 } },
  { id: "prompts", title: "Your style · prompts", hint: "Upload prompt files", group: WORK, needs: "clients", size: { w: 4, h: 4 }, min: { w: 3, h: 4 }, max: { w: 6, h: 6 } },

  { id: "views", title: "Views this month", hint: "Views and engagement vs last month", group: BIZ, needs: "clients", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 4 } },
  { id: "money", title: "Money this month", hint: "In, out and the last six months", group: BIZ, needs: "clients", size: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 5 } },
  { id: "waiting-money", title: "Waiting payments", hint: "Who still owes you, and when", group: BIZ, needs: "clients", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 6 } },
  { id: "goals", title: "Goals", hint: "Progress on your goals", group: BIZ, needs: "clients", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 5 } },
  { id: "needs-numbers", title: "Needs numbers", hint: "Posted content missing its stats", group: BIZ, needs: "clients", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 6 } },
];

/** A block of one of your own pages, as a Home widget. */
export const pageBlockWidget = (pageId: number, blockId: string, title: string): HomeWidget => ({
  id: `page:${pageId}:${blockId}`,
  title,
  hint: "From your page",
  group: "Your pages",
  size: { w: 4, h: 3 },
  min: { w: 3, h: 3 },
  max: { w: 12, h: 8 },
});

/** Home for someone who hasn't arranged it: close to the old Overview, built from the sections they use. */
export function homeDefault(o: { clients: boolean; email: boolean; maps: boolean; pageBlocks: string[] }): string[] {
  return o.clients
    ? ["hero", "stat-tasks", "stat-work", "stat-review", "stat-feedback", "week", "tasks", "waiting", "money", ...(o.email ? ["inbox"] : []), "views", "current-work", "quick-add", ...o.pageBlocks]
    : ["hero", "stat-tasks", "stat-suggestions", "week", "tasks", "busy", "recommended", "shortcuts", ...(o.email ? ["inbox"] : []), ...(o.maps ? ["route"] : []), ...o.pageBlocks];
}
