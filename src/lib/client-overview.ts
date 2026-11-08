// Pure: the tiles a client's Overview board can show, their sizes (12 columns, rows of 64px) and the starting
// arrangement. Tool tiles appear only for the tools this client has; own tabs can be pinned as tiles too.
import type { WidgetDef } from "./board.ts";

export type OverviewWidget = WidgetDef & { title: string; hint: string; group: string; tool?: string };

const TOOLS = "Their tools";
const WORK = "Work";

export const OVERVIEW_WIDGETS: OverviewWidget[] = [
  { id: "followers", title: "Followers", hint: "Their Instagram followers and reach", group: TOOLS, tool: "instagram", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 5 } },
  { id: "money", title: "Waiting to be paid", hint: "What they owe you and what came in", group: TOOLS, tool: "finance", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 5 } },
  { id: "content", title: "Content", hint: "Reels and carousels in progress", group: TOOLS, tool: "content", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 6 } },
  { id: "app", title: "App / website", hint: "Their latest version", group: TOOLS, tool: "app", size: { w: 4, h: 3 }, min: { w: 3, h: 3 }, max: { w: 8, h: 5 } },
  { id: "tasks", title: "Tasks", hint: "Open tasks for this client", group: WORK, size: { w: 8, h: 4 }, min: { w: 4, h: 3 }, max: { w: 12, h: 8 } },
  { id: "about", title: "About", hint: "What you do for them", group: WORK, size: { w: 4, h: 3 }, min: { w: 3, h: 2 }, max: { w: 8, h: 6 } },
  { id: "files", title: "Files", hint: "Their newest files in Drive", group: WORK, size: { w: 6, h: 3 }, min: { w: 3, h: 3 }, max: { w: 12, h: 8 } },
  { id: "dashboard", title: "Their dashboard", hint: "Who you share it with", group: WORK, size: { w: 6, h: 2 }, min: { w: 3, h: 2 }, max: { w: 12, h: 4 } },
];

/** One of the client's own tabs, as a tile that previews it. */
export const ownTabWidget = (pageId: number, title: string): OverviewWidget => ({
  id: `page:${pageId}`,
  title,
  hint: "One of your tabs for this client",
  group: "Your tabs",
  size: { w: 4, h: 4 },
  min: { w: 3, h: 3 },
  max: { w: 12, h: 8 },
});

/** The tiles this client can have: tool tiles for the tools it has, the work tiles, and its own tabs. */
export function overviewCatalogue(features: readonly string[], pages: readonly { id: number; title: string }[]): OverviewWidget[] {
  return [...OVERVIEW_WIDGETS.filter((w) => !w.tool || features.includes(w.tool)), ...pages.map((p) => ownTabWidget(p.id, p.title))];
}

/** The board before it's arranged: the tool tiles first, then tasks and about, files, their dashboard. */
export function overviewDefault(features: readonly string[]): string[] {
  const tools = OVERVIEW_WIDGETS.filter((w) => w.tool && features.includes(w.tool)).map((w) => w.id);
  const share = ["instagram", "content", "app"].some((f) => features.includes(f)) ? ["dashboard"] : [];
  return [...tools, "tasks", "about", "files", ...share];
}
