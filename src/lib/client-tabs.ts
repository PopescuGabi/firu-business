// Pure: which tabs a client's page shows, in which order. Each client has its own list (clients.tabs); a client
// that was never customised gets tabs from its tools (features). Own tabs are pages tied to the client: "page:<id>".
import type { ClientTool } from "./client-tools.ts";

export type BuiltinTab = { key: string; label: string; icon: string; hint: string; tool?: ClientTool; needs?: ClientTool };

export const BUILTIN_TABS: BuiltinTab[] = [
  { key: "overview", label: "Overview", icon: "layout", hint: "What's going on with this client" },
  { key: "instagram", label: "Instagram", icon: "chart", hint: "Their Instagram results", tool: "instagram" },
  { key: "content", label: "Content", icon: "clapperboard", hint: "Reels and carousels you make for them", tool: "content" },
  { key: "app", label: "App / website", icon: "phone", hint: "Versions and updates of their app or site", tool: "app" },
  { key: "finance", label: "Finance", icon: "wallet", hint: "What they pay you and what's waiting", tool: "finance" },
  { key: "profile", label: "Brand profile", icon: "user", hint: "Audience, voice and brand for the AI editor", needs: "content" },
  { key: "tasks", label: "Tasks", icon: "list", hint: "This client's tasks and due dates" },
  { key: "files", label: "Files", icon: "folder", hint: "Their Drive folder and files" },
  { key: "dashboard", label: "Their dashboard", icon: "share", hint: "Invite them and choose what they see" },
];

const builtin = new Map(BUILTIN_TABS.map((t) => [t.key, t]));
export const builtinTab = (key: string) => builtin.get(key);
export const pageTabKey = (pageId: number) => `page:${pageId}`;
export const pageIdOf = (key: string) => (/^page:\d+$/.test(key) ? Number(key.slice(5)) : null);

/** Tabs a client starts with: Overview, then the tools it has, then its dashboard when there's something to share. */
export function defaultTabs(features: readonly string[]): string[] {
  const out = ["overview"];
  for (const t of BUILTIN_TABS) {
    if (t.tool && features.includes(t.tool)) out.push(t.key);
    if (t.needs && features.includes(t.needs)) out.push(t.key);
  }
  if (["instagram", "content", "app"].some((f) => features.includes(f))) out.push("dashboard");
  return out;
}

/**
 * The tabs to show: the saved list cleaned up (unknown keys, deleted pages, tools that are switched off and
 * duplicates dropped; Overview always first), plus any tool switched on elsewhere (the client form) that the list
 * doesn't have yet. Nothing saved: the default for its tools.
 */
export function tabsFor(saved: readonly string[] | null | undefined, features: readonly string[], pageIds: readonly number[]): string[] {
  if (!saved) return defaultTabs(features);
  const out = ["overview"];
  for (const key of saved) {
    if (out.includes(key)) continue;
    const id = pageIdOf(key);
    if (id !== null) {
      if (pageIds.includes(id)) out.push(key);
      continue;
    }
    const t = builtin.get(key);
    if (!t) continue;
    if (t.tool && !features.includes(t.tool)) continue;
    if (t.needs && !features.includes(t.needs)) continue;
    out.push(key);
  }
  for (const t of BUILTIN_TABS) if (t.tool && features.includes(t.tool) && !out.includes(t.key)) out.push(t.key);
  return out;
}

/** Turns a tab on (added at the end) or off. Overview can't be turned off. */
export function toggleTab(tabs: readonly string[], key: string, on: boolean): string[] {
  if (key === "overview") return [...tabs];
  const rest = tabs.filter((k) => k !== key);
  return on ? [...rest, key] : rest;
}

/** Moves a tab one place left (-1) or right (+1); Overview stays first. */
export function moveTab(tabs: readonly string[], key: string, dir: -1 | 1): string[] {
  const out = [...tabs];
  const i = out.indexOf(key);
  const j = i + dir;
  if (i <= 0 || j <= 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** The tools a tab list implies: a tool tab shown means the tool is on, and the other way round. */
export function featuresForTabs(tabs: readonly string[], features: readonly string[]): string[] {
  const tools = BUILTIN_TABS.filter((t) => t.tool).map((t) => t.tool!);
  const kept = features.filter((f) => !tools.includes(f as ClientTool));
  return [...kept, ...tools.filter((tool) => tabs.includes(BUILTIN_TABS.find((t) => t.tool === tool)!.key))];
}
