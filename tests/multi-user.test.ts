import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const root = path.join(import.meta.dirname, "..");

// Tables that belong to one person: every query on them must say whose rows it means.
const PER_USER = [
  "settings",
  "clients",
  "appUpdates",
  "reels",
  "carousels",
  "clientFeedback",
  "prompts",
  "aiMessages",
  "tasks",
  "planBlocks",
  "schoolDays",
  "schoolClasses",
  "gymSets",
  "customPages",
  "customItems",
  "instagramAccounts",
  "igMedia",
  "igDaily",
  "clientInvites",
  "clientLinks",
  "tutoring",
  "gymDays",
  "portfolioItems",
  "calendarLinks",
  "aiUsage",
  "backgrounds",
  "places",
  "posts",
  "postStats",
  "goals",
  "shareViews",
  "money",
  "budgets",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

test("every query on a per-person table is scoped to a user", () => {
  const problems: string[] = [];
  const re = new RegExp(`\\.(from|update|delete|insert)\\(schema\\.(${PER_USER.join("|")})\\)`, "g");
  for (const file of sourceFiles(path.join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(re)) {
      // The rest of the statement (to the next semicolon), plus the line before for an explicit marker.
      const end = text.indexOf(";", m.index);
      const statement = text.slice(m.index, end === -1 ? undefined : end);
      const lineStart = text.lastIndexOf("\n", m.index);
      const before = text.slice(text.lastIndexOf("\n", lineStart - 1), lineStart);
      const scoped =
        /userId|\buid\b|user\.id|owner\.id|\bmine\b|\blinkKey\(|\bday\b|\bscope\b/.test(statement) || /scoped:/.test(before);
      if (!scoped) {
        const line = text.slice(0, m.index).split("\n").length;
        problems.push(`${path.relative(root, file)}:${line} ${m[0]}`);
      }
    }
  }
  assert.deepEqual(problems, [], `Unscoped queries:\n${problems.join("\n")}`);
});

test("two people's data stays apart in the database", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hub-test-"));
  const lite = new PGlite(dir);
  try {
    await migrate(drizzle(lite), { migrationsFolder: path.join(root, "drizzle") });

    // Every table is locked to the app's own connection (Supabase's public API sees nothing).
    // A new table needs `ALTER TABLE … ENABLE ROW LEVEL SECURITY` in its migration.
    const open = await lite.query<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    assert.deepEqual(open.rows.map((r) => r.relname), [], "tables without row-level security");
    await lite.exec(`
      update users set email = 'owner@example.com' where id = 1;
      insert into users (email, role) values ('member@example.com', 'member');
    `);
    const member = (await lite.query<{ id: number }>("select id from users where email = 'member@example.com'")).rows[0].id;
    assert.notEqual(member, 1);

    // Same weekday / settings key for both people: allowed now that keys include the user.
    await lite.exec(`
      insert into school_days (user_id, weekday, start_time) values (1, 1, '08:00'), (${member}, 1, '09:00');
      insert into gym_days (user_id, weekday, title) values (1, 3, 'Legs'), (${member}, 3, 'Arms');
      insert into settings (user_id, key, value) values (1, 'displayName', '"A"'), (${member}, 'displayName', '"B"');
      insert into clients (user_id, name) values (1, 'Owner client'), (${member}, 'Member client');
      insert into calendar_links (user_id, key, calendar_id, event_id, written) values (1, 'gym:3', 'c', 'e1', '{}'), (${member}, 'gym:3', 'c', 'e2', '{}');
    `);
    const names = (await lite.query<{ value: string }>(`select value from settings where user_id = ${member} and key = 'displayName'`)).rows;
    assert.deepEqual(names.map((r) => r.value), ["B"]);

    // Client dashboards: the owner (agency) shares one client with the member's account.
    const ownerClient = (await lite.query<{ id: number }>("select id from clients where user_id = 1")).rows[0].id;
    await lite.exec(`insert into client_links (user_id, client_id, client_user_id, shared) values (1, ${ownerClient}, ${member}, '["instagram"]')`);
    const seen = async (uid: number) => (await lite.query<{ id: number }>(`select l.id from client_links l join clients c on c.id = l.client_id where l.client_user_id = ${uid} and not c.archived`)).rows;
    assert.equal((await seen(member)).length, 1, "the client sees the dashboard shared with them");
    assert.equal((await seen(1)).length, 0, "the agency's own account is not a viewer");
    await assert.rejects(lite.exec(`insert into client_links (user_id, client_id, client_user_id) values (1, ${ownerClient}, 1)`), "one link per client");
    await lite.exec(`update clients set archived = true where id = ${ownerClient}`);
    assert.equal((await seen(member)).length, 0, "an archived client's dashboard disappears");
    await lite.exec(`update clients set archived = false where id = ${ownerClient}`);

    // Deleting the member removes only their rows.
    await lite.exec(`delete from users where id = ${member}`);
    for (const t of ["school_days", "gym_days", "settings", "clients", "calendar_links"]) {
      const { rows } = await lite.query<{ user_id: number }>(`select distinct user_id from ${t}`);
      assert.deepEqual(rows.map((r) => r.user_id), [1], t);
    }
    assert.equal((await lite.query("select id from client_links")).rows.length, 0, "a deleted person's dashboard links go with them");
  } finally {
    await lite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
