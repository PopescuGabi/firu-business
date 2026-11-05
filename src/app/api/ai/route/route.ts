import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { mapsAvailable, MapsError, routeMatrix, TRAVEL_MODES } from "@/lib/google/maps";
import { dayItems } from "@/lib/now-next";
import { listPlaces } from "@/lib/places";
import { getSettings } from "@/lib/settings";
import { fmtDate, toHHMM, WEEKDAYS } from "@/lib/time";
import { getWeek, todayIn } from "@/lib/week";

export const maxDuration = 120;

const SYSTEM = `You help one person plan how they get around during their week.
You get their fixed schedule (with the place of each item), the travel minutes between their places for
each way of travelling, and how they usually travel. Give practical route advice in plain English:
- the best way to travel each day (or each leg, if it differs), and when to leave,
- tight connections and how to fix them (leave earlier, another mode, or moving a flexible item such as gym or study next to a place they're already at),
- days that can be grouped to save travel.
Keep it short: at most 8 bullets, each one line, most useful first. Only use the places and times given; never invent addresses.`;

/** Route advice for the coming week. Without an Anthropic key, returns the prompt for the Claude app instead. */
export async function POST() {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  if (!(await mapsAvailable(user.id))) return Response.json({ error: "Add your Google Maps key in Settings first." }, { status: 400 });
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const [{ days }, places] = await Promise.all([getWeek(user.id, today, 7), listPlaces(user.id)]);
  if (places.length < 2) return Response.json({ error: "Add at least two addresses in Settings → Google Maps." }, { status: 400 });

  let matrices: { label: string; m: Awaited<ReturnType<typeof routeMatrix>> }[];
  try {
    // Only the place names go to Claude, never the addresses.
    matrices = await Promise.all(TRAVEL_MODES.filter((t) => t.key !== "bicycle").map(async (t) => ({ label: t.label, m: await routeMatrix(user.id, places, t.key) })));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Google Maps failed" }, { status: err instanceof MapsError ? err.status : 500 });
  }
  const travel = matrices
    .map(({ label, m }) => {
      const rows = places.flatMap((a, i) => places.flatMap((b, j) => (i !== j && m[i][j] ? [`  ${a.name} → ${b.name}: ${m[i][j]!.minutes} min`] : [])));
      return `${label}:\n${rows.join("\n")}`;
    })
    .join("\n");
  const week = days
    .map((d) => {
      const items = dayItems(d).filter((i) => i.place !== "any");
      const list = items.map((i) => `  ${toHHMM(i.start)}–${toHHMM(i.end)} ${i.title} @ ${i.place}`).join("\n");
      return `${WEEKDAYS[d.weekday - 1]} ${fmtDate(d.date, { day: "numeric", month: "short" })}:\n${list || "  nothing fixed"}`;
    })
    .join("\n");
  const mode = TRAVEL_MODES.find((t) => t.key === settings.travelMode)?.label ?? "Public transport";
  const prompt = `I usually travel by: ${mode}. After the gym I need ${settings.gymExtraMinutes} min to shower and change.
Places: ${places.map((p) => p.name).join(", ")}. Days start and end at home.

Travel times from Google Maps:
${travel}

My week:
${week}`;

  if (!(await claudeAvailable(user.id))) return Response.json({ prompt: `${SYSTEM}\n\n${prompt}` });
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor("quick");
    const final = await (await claude(user.id)).beta.messages
      .stream({
        ...ai,
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();
    await recordUsage(user.id, "route", final.usage, ai.model);
    if (final.stop_reason === "refusal") throw new Error("Claude declined to give route advice.");
    return Response.json({ advice: final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim() });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
