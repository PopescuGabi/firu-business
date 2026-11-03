import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
};

export type Slide = {
  id: string;
  heading: string;
  body: string;
  note: string;
};

export type CarouselTheme = {
  background: string;
  foreground: string;
  accent: string;
  font: "sans" | "serif" | "rounded";
  align: "left" | "center";
};

export type Exercise = { name: string; sets: number };

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Single owner: the Google account the site is locked to.
export const googleAccount = pgTable("google_account", {
  id: integer("id").primaryKey().default(1),
  email: text("email").notNull(),
  name: text("name"),
  picture: text("picture"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"), // encrypted at rest
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  rootFolderId: text("root_folder_id"),
  updatedAt: updatedAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#007AFF"),
  appName: text("app_name").notNull().default(""),
  driveFolderId: text("drive_folder_id"),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const appUpdates = pgTable(
  "app_updates",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    version: text("version").notNull().default(""),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("planned"), // planned | in_progress | shipped
    date: text("date"), // yyyy-mm-dd
    files: jsonb("files").$type<DriveFile[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("app_updates_client_idx").on(t.clientId)],
);

export const reels = pgTable(
  "reels",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("idea"), // idea | scripting | filming | editing | review | posted
    hook: text("hook").notNull().default(""),
    script: text("script").notNull().default(""),
    caption: text("caption").notNull().default(""),
    notes: text("notes").notNull().default(""),
    postDate: text("post_date"),
    files: jsonb("files").$type<DriveFile[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reels_client_idx").on(t.clientId)],
);

export const carousels = pgTable(
  "carousels",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"), // draft | review | approved | posted
    caption: text("caption").notNull().default(""),
    slides: jsonb("slides").$type<Slide[]>().notNull().default([]),
    theme: jsonb("theme").$type<CarouselTheme>().notNull(),
    postDate: text("post_date"),
    files: jsonb("files").$type<DriveFile[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("carousels_client_idx").on(t.clientId)],
);

// What a client said about work you sent, and whether it's been handled.
export const clientFeedback = pgTable(
  "client_feedback",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    targetType: text("target_type"), // reel | carousel | appUpdate | null (general)
    targetId: integer("target_id"),
    note: text("note").notNull(),
    status: text("status").notNull().default("open"), // open | done
    createdAt: createdAt(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("client_feedback_client_idx").on(t.clientId)],
);

export const prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("reel"), // reel | carousel | general
  body: text("body").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Chat with the Opus editor, per reel / carousel.
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: serial("id").primaryKey(),
    targetType: text("target_type").notNull(), // reel | carousel
    targetId: integer("target_id").notNull(),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    proposal: jsonb("proposal"), // edits Claude proposed in this turn
    applied: boolean("applied").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_target_idx").on(t.targetType, t.targetId)],
);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  due: text("due"), // yyyy-mm-dd
  estimateMin: integer("estimate_min").notNull().default(30),
  priority: integer("priority").notNull().default(1), // 0 low, 1 normal, 2 high
  done: boolean("done").notNull().default(false),
  createdAt: createdAt(),
});

// Time blocks the planner (AI or basic) proposed; accepted ones go to Google Calendar.
export const planBlocks = pgTable(
  "plan_blocks",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(), // yyyy-mm-dd (local)
    start: text("start").notNull(), // HH:mm
    end: text("end").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(), // gym | study | project | task | break
    taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("proposed"), // proposed | accepted
    source: text("source").notNull().default("ai"), // ai | basic
    gcalEventId: text("gcal_event_id"),
    createdAt: createdAt(),
  },
  (t) => [index("plan_blocks_date_idx").on(t.date)],
);

export const schoolDays = pgTable("school_days", {
  weekday: integer("weekday").primaryKey(), // 1 = Monday … 5 = Friday
  startTime: text("start_time").notNull(), // HH:mm
});

export const schoolClasses = pgTable(
  "school_classes",
  {
    weekday: integer("weekday").notNull(),
    period: integer("period").notNull(), // 0-based
    subject: text("subject").notNull(),
  },
  (t) => [primaryKey({ columns: [t.weekday, t.period] })],
);

// Fixed tutoring sessions (repeat weekly or every N weeks from startDate).
export const tutoring = pgTable("tutoring", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  weekday: integer("weekday").notNull(), // 1 = Monday … 7 = Sunday
  start: text("start").notNull(), // HH:mm
  end: text("end").notNull(),
  everyWeeks: integer("every_weeks").notNull().default(1),
  startDate: text("start_date").notNull(), // yyyy-mm-dd of the first session
  place: text("place").notNull().default("online"), // "online" or a place name used in travel times
  gcalEventId: text("gcal_event_id"), // repeating event in Google Calendar
  createdAt: createdAt(),
});

export const gymDays = pgTable("gym_days", {
  weekday: integer("weekday").primaryKey(), // 1 = Monday … 7 = Sunday
  title: text("title").notNull(),
  exercises: jsonb("exercises").$type<Exercise[]>().notNull().default([]),
  durationMin: integer("duration_min").notNull().default(75),
  // flexible = the planner picks a time; after_school = right after the last class; fixed = at startTime
  timing: text("timing").notNull().default("flexible"),
  startTime: text("start_time"), // HH:mm, when timing = fixed
});

// Work you show off: files live in the "Portfolio" folder in Drive; public items appear on the share page.
export const portfolioItems = pgTable("portfolio_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  date: text("date"), // yyyy-mm-dd
  type: text("type").notNull().default("other"), // see PORTFOLIO_TYPES
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  files: jsonb("files").$type<DriveFile[]>().notNull().default([]),
  coverFileId: text("cover_file_id"),
  public: boolean("public").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Which Google Calendar event mirrors which hub item (see lib/calendar-sync).
export const calendarLinks = pgTable("calendar_links", {
  key: text("key").primaryKey(), // e.g. class:1:0, gym:6, tutoring:3, block:45, task:7
  calendarId: text("calendar_id").notNull(),
  eventId: text("event_id").notNull(),
  written: jsonb("written").notNull(), // signature of what the hub last wrote or accepted
  remoteUpdated: text("remote_updated"), // Google's "updated" timestamp after that write
  updatedAt: updatedAt(),
});

// Every Claude call, for rate limiting and spend visibility.
export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: createdAt(),
});
