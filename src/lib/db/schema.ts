import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
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

/** One exercise in a gym day: sets, and the target reps per set (progression adds weight once every set reaches it). */
export type Exercise = { name: string; sets: number; reps?: number };

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

import type { ClientProfile, ReelPlan } from "../reels-brain/types";
import type { Spec as CustomSpec } from "../custom-pages";

export type Role = "owner" | "member";

// One row per person. The owner (ALLOWED_EMAIL) invites everyone else.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  picture: text("picture"),
  role: text("role").$type<Role>().notNull().default("member"),
  modules: jsonb("modules").$type<string[]>().notNull().default([]), // sections they use (lib/modules.ts)
  onboarded: boolean("onboarded").notNull().default(false),
  anthropicKey: text("anthropic_key"), // their own Claude key, encrypted
  mapsKey: text("maps_key"), // their own Google Maps key, encrypted
  shareToken: text("share_token").unique(), // public portfolio address
  shareEnabled: boolean("share_enabled").notNull().default(false),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

// Emails the owner has invited; only these (and the owner) can sign in.
export const invites = pgTable("invites", {
  email: text("email").primaryKey(),
  invitedAt: timestamp("invited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

/** Whose row this is. Every per-person table has it; deleting a user deletes their rows. */
const owner = () =>
  integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

// Each person's Google connection. `id` is their user id.
export const googleAccount = pgTable("google_account", {
  id: integer("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
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

export const settings = pgTable(
  "settings",
  {
    userId: owner(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// Each person's own background photo (shrunk in the browser before upload), as base64.
export const backgrounds = pgTable("backgrounds", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
  updatedAt: updatedAt(),
});

// Addresses for the places used in travel times (home, school, gym, tutoring places).
export const places = pgTable(
  "places",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(), // the travel-time place name, e.g. "home" or "Math tutoring"
    address: text("address").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    googlePlaceId: text("google_place_id"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("places_user_name").on(t.userId, t.name)],
);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#007AFF"),
    appName: text("app_name").notNull().default(""),
    driveFolderId: text("drive_folder_id"),
    archived: boolean("archived").notNull().default(false),
    // Reels Brain: who the content is for (audience, awareness, voice, brand, constraints, observed results)
    profile: jsonb("profile").$type<Partial<ClientProfile>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("clients_user_idx").on(t.userId)],
);

export const appUpdates = pgTable(
  "app_updates",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
    userId: owner(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("idea"), // idea | scripting | filming | editing | review | posted
    hook: text("hook").notNull().default(""),
    script: text("script").notNull().default(""),
    caption: text("caption").notNull().default(""),
    notes: text("notes").notNull().default(""),
    postDate: text("post_date"),
    files: jsonb("files").$type<DriveFile[]>().notNull().default([]),
    // Reels Brain: diagnosis, caption plan, one experiment and the review checklist for this reel
    plan: jsonb("plan").$type<Partial<ReelPlan>>().notNull().default({}),
    // AI video maker: the brief Gabi gave and the last video spec Opus wrote (rendered in the browser)
    video: jsonb("video").$type<{ brief?: string; spec?: unknown }>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reels_client_idx").on(t.clientId)],
);

export const carousels = pgTable(
  "carousels",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
    userId: owner(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
  userId: owner(),
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
    userId: owner(),
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
  userId: owner(),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  clientId: integer("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
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
    userId: owner(),
    date: text("date").notNull(), // yyyy-mm-dd (local)
    start: text("start").notNull(), // HH:mm
    end: text("end").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(), // gym | study | project | task | break | post
    taskId: integer("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("proposed"), // proposed | accepted
    source: text("source").notNull().default("ai"), // ai | basic
    gcalEventId: text("gcal_event_id"),
    createdAt: createdAt(),
  },
  (t) => [index("plan_blocks_date_idx").on(t.userId, t.date)],
);

export const schoolDays = pgTable(
  "school_days",
  {
    userId: owner(),
    weekday: integer("weekday").notNull(), // 1 = Monday … 5 = Friday
    startTime: text("start_time").notNull(), // HH:mm
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekday] })],
);

export const schoolClasses = pgTable(
  "school_classes",
  {
    userId: owner(),
    weekday: integer("weekday").notNull(),
    period: integer("period").notNull(), // 0-based
    subject: text("subject").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekday, t.period] })],
);

// Fixed tutoring sessions (repeat weekly or every N weeks from startDate).
export const tutoring = pgTable("tutoring", {
  id: serial("id").primaryKey(),
  userId: owner(),
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

export const gymDays = pgTable(
  "gym_days",
  {
    userId: owner(),
    weekday: integer("weekday").notNull(), // 1 = Monday … 7 = Sunday
    title: text("title").notNull(),
    exercises: jsonb("exercises").$type<Exercise[]>().notNull().default([]),
    durationMin: integer("duration_min").notNull().default(75),
    // flexible = the planner picks a time; after_school = right after the last class; fixed = at startTime
    timing: text("timing").notNull().default("flexible"),
    startTime: text("start_time"), // HH:mm, when timing = fixed
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekday] })],
);

// Every set you log (weight × reps), one row per set; progression and the progress chart read these.
export const gymSets = pgTable(
  "gym_sets",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    date: text("date").notNull(), // yyyy-mm-dd, in the person's time zone
    exercise: text("exercise").notNull(),
    setNo: integer("set_no").notNull(), // 1-based
    weight: real("weight").notNull().default(0), // kg; 0 = bodyweight
    reps: integer("reps").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("gym_sets_one").on(t.userId, t.date, t.exercise, t.setNo), index("gym_sets_exercise").on(t.userId, t.exercise, t.date)],
);

// Pages each person builds for their own work (often with the AI setup): a JSON spec rendered from fixed blocks.
export const customPages = pgTable(
  "custom_pages",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    icon: text("icon").notNull().default("list"),
    color: text("color").notNull().default("#0A84FF"),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
    spec: jsonb("spec").$type<CustomSpec>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("custom_pages_slug").on(t.userId, t.slug)],
);

// Entries on a custom page (a shoot, a project, a link, the notes text), keyed by collection inside the spec.
export const customItems = pgTable(
  "custom_items",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    pageId: integer("page_id")
      .notNull()
      .references(() => customPages.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    data: jsonb("data").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("custom_items_page").on(t.userId, t.pageId, t.collection)],
);

// Work you show off: files live in the "Portfolio" folder in Drive; public items appear on the share page.
export const portfolioItems = pgTable("portfolio_items", {
  id: serial("id").primaryKey(),
  userId: owner(),
  title: text("title").notNull(),
  clientId: integer("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  date: text("date"), // yyyy-mm-dd
  type: text("type").notNull().default("other"), // see PORTFOLIO_TYPES
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  files: jsonb("files").$type<DriveFile[]>().notNull().default([]),
  coverFileId: text("cover_file_id"),
  link: text("link"), // live website or app, shown as an Open button
  public: boolean("public").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Which Google Calendar event mirrors which hub item (see lib/calendar-sync).
export const calendarLinks = pgTable(
  "calendar_links",
  {
    userId: owner(),
    key: text("key").notNull(), // e.g. class:1:0, gym:6, tutoring:3, block:45, task:7
    calendarId: text("calendar_id").notNull(),
    eventId: text("event_id").notNull(),
    written: jsonb("written").notNull(), // signature of what the hub last wrote or accepted
    remoteUpdated: text("remote_updated"), // Google's "updated" timestamp after that write
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// Every Claude call, for rate limiting and spend visibility.
export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: owner(),
  kind: text("kind").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: createdAt(),
});

// ── Marketing ─────────────────────────────────────────────────

// A published post (reel, carousel, video…) on a platform, for a client or yourself.
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    reelId: integer("reel_id").references(() => reels.id, { onDelete: "set null" }),
    carouselId: integer("carousel_id").references(() => carousels.id, { onDelete: "set null" }),
    platform: text("platform").notNull(), // instagram | tiktok | youtube | facebook | linkedin | other
    kind: text("kind").notNull(), // reel | carousel | video | post | story
    title: text("title").notNull(),
    url: text("url").notNull().default(""),
    postedOn: text("posted_on").notNull(), // yyyy-mm-dd (local)
    postedAt: text("posted_at"), // HH:mm (local), for the best-time heatmap
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("posts_user").on(t.userId, t.postedOn)],
);

// The numbers for a post, one row per update (the latest is current; earlier ones show growth).
export const postStats = pgTable(
  "post_stats",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    recordedOn: text("recorded_on").notNull(), // yyyy-mm-dd
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    follows: integer("follows").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("post_stats_post").on(t.postId)],
);

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: owner(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }), // null = everything
  metric: text("metric").notNull(), // views | engagement | posts | follows | income
  target: integer("target").notNull(), // engagement: tenths of a percent; income: whole units of moneyCurrency
  period: text("period").notNull().default("month"), // week | month
  createdAt: createdAt(),
});

// Visits to a public portfolio page: no IP address, no cookies, only the day and the referring site.
export const shareViews = pgTable(
  "share_views",
  {
    id: serial("id").primaryKey(),
    userId: owner(), // the portfolio's owner
    itemId: integer("item_id").references(() => portfolioItems.id, { onDelete: "set null" }), // null = gallery
    day: text("day").notNull(), // yyyy-mm-dd (UTC)
    referrer: text("referrer").notNull().default(""), // host only, e.g. "instagram.com"
    createdAt: createdAt(),
  },
  (t) => [index("share_views_user").on(t.userId, t.day)],
);

// ── Finance ───────────────────────────────────────────────────

// Money in (client payments…) and out (spending), in RON or EUR.
export const money = pgTable(
  "money",
  {
    id: serial("id").primaryKey(),
    userId: owner(),
    kind: text("kind").notNull(), // income | expense
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(), // RON | EUR
    date: text("date").notNull(), // yyyy-mm-dd
    category: text("category").notNull(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    status: text("status").notNull().default("paid"), // paid | waiting (income not received yet)
    due: text("due"), // yyyy-mm-dd, for waiting income
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("money_user_date").on(t.userId, t.date)],
);

export const budgets = pgTable(
  "budgets",
  {
    userId: owner(),
    category: text("category").notNull(),
    limitCents: integer("limit_cents").notNull(), // per month
    currency: text("currency").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category] })],
);

// ECB reference rate: lei for one euro on a day (shared, not personal).
export const fxRates = pgTable("fx_rates", {
  date: text("date").primaryKey(),
  ronPerEur: doublePrecision("ron_per_eur").notNull(),
});
