// Pure (no server imports): the sections someone can turn on, used by onboarding, Settings, nav and Home.

export const MODULES = [
  { key: "clients", label: "Client work", description: "Clients, app updates, reels, carousels and their feedback, with an AI editor that follows your saved prompts." },
  { key: "portfolio", label: "Portfolio", description: "Your best work from Drive, with an optional public page." },
  { key: "instagram", label: "Instagram analytics", description: "Your Instagram professional account: reach, views, followers, best posts and formats, posting rhythm." },
  { key: "email", label: "Email", description: "Your Gmail inbox: important mail at a glance, reply, turn emails into tasks." },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export const ALL_MODULES = MODULES.map((m) => m.key) as ModuleKey[];

export const PRESETS: { key: string; label: string; description: string; modules: ModuleKey[] }[] = [
  { key: "freelancer", label: "Freelancer / creator", description: "Clients, content, portfolio and email.", modules: ["clients", "portfolio", "email"] },
  { key: "everything", label: "Everything", description: "Every section; turn off what you don't use later.", modules: ALL_MODULES },
];

export const isModule = (k: string): k is ModuleKey => (ALL_MODULES as string[]).includes(k);
export const has = (modules: readonly string[], k: ModuleKey) => modules.includes(k);
