// Pure: what each client's business can have, so a client page shows only what that business needs.

export const CLIENT_TOOLS = [
  { key: "instagram", label: "Instagram analytics", description: "Their Instagram results: reach, followers, best posts, posting rhythm." },
  { key: "content", label: "Content production", description: "Reels and carousels you make for them, with Claude as editor." },
  { key: "app", label: "App / website work", description: "Versions and updates of an app or website you build for them." },
  { key: "finance", label: "Finance", description: "What they pay you and what's still waiting." },
] as const;
export type ClientTool = (typeof CLIENT_TOOLS)[number]["key"];
export const isClientTool = (k: string): k is ClientTool => CLIENT_TOOLS.some((t) => t.key === k);

/** Business types with the tools they usually need (a starting point; every tool can be switched on or off). */
export const BUSINESS_TYPES: { key: string; label: string; tools: ClientTool[] }[] = [
  { key: "shop", label: "Shop / e-commerce", tools: ["instagram", "content", "finance"] },
  { key: "restaurant", label: "Restaurant / café", tools: ["instagram", "content", "finance"] },
  { key: "services", label: "Local services (salon, clinic, studio…)", tools: ["instagram", "content", "finance"] },
  { key: "realestate", label: "Real estate", tools: ["instagram", "content", "finance"] },
  { key: "personal", label: "Personal brand / creator", tools: ["instagram", "content", "finance"] },
  { key: "b2b", label: "B2B / agency / consulting", tools: ["instagram", "content", "finance"] },
  { key: "tech", label: "App / website / software", tools: ["app", "finance"] },
  { key: "other", label: "Other", tools: ["instagram", "finance"] },
];

export const businessLabel = (key: string) => BUSINESS_TYPES.find((b) => b.key === key)?.label ?? "";
export const toolsFor = (key: string): ClientTool[] => BUSINESS_TYPES.find((b) => b.key === key)?.tools ?? ["instagram", "finance"];
export const has = (features: readonly string[], tool: ClientTool) => features.includes(tool);
