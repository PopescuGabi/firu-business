"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MapsError, placeDetails, routeMatrix, TRAVEL_MODES, type TravelMode } from "@/lib/google/maps";
import { deletePlace, listPlaces, savePlace } from "@/lib/places";
import { getSettings, saveSettings } from "@/lib/settings";
import { setMapsKey } from "@/lib/users";

export type MapsState = { ok: boolean; message: string } | null;

const fail = (err: unknown): MapsState => ({ ok: false, message: err instanceof MapsError || err instanceof Error ? err.message : "Something went wrong" });

export async function saveMapsKey(_prev: MapsState, fd: FormData): Promise<MapsState> {
  const user = await requireUser();
  if (fd.get("remove") === "1") {
    await setMapsKey(user.id, null);
    revalidatePath("/", "layout");
    return { ok: true, message: "Removed. Travel times stay as they are." };
  }
  const key = z.string().trim().regex(/^AIza[\w-]{30,}$/, "That doesn't look like a Google API key (AIza…)").safeParse(fd.get("key"));
  if (!key.success) return { ok: false, message: key.error.issues[0].message };
  await setMapsKey(user.id, key.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Add your addresses below." };
}

const placeName = z.string().trim().min(1).max(60).refine((n) => !n.includes(">") && n !== "online" && n !== "any", "That name can't have an address");

/** Saves the address picked from Google's suggestions for a place name (home, school, a tutoring place…). */
export async function setPlaceAddress(name: string, placeId: string, sessionToken?: string): Promise<MapsState> {
  const user = await requireUser();
  try {
    const n = placeName.parse(name);
    await savePlace(user.id, n, await placeDetails(user.id, placeId, sessionToken));
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function removePlaceAddress(name: string) {
  const user = await requireUser();
  await deletePlace(user.id, placeName.parse(name));
  revalidatePath("/", "layout");
}

export async function saveTravelPrefs(fd: FormData) {
  const user = await requireUser();
  const mode = String(fd.get("travelMode"));
  await saveSettings(user.id, {
    travelMode: (TRAVEL_MODES.some((m) => m.key === mode) ? mode : "transit") as TravelMode,
    gymExtraMinutes: z.coerce.number().int().min(0).max(120).catch(15).parse(fd.get("gymExtraMinutes")),
  });
  revalidatePath("/", "layout");
}

/**
 * Asks Google for the travel time between every pair of saved addresses and writes them into the
 * travel-times table (gym → anywhere adds your shower/changing minutes). Other rows stay.
 */
export async function fillTravelFromMaps(_prev: MapsState): Promise<MapsState> {
  const user = await requireUser();
  try {
    const places = await listPlaces(user.id);
    if (places.length < 2) return { ok: false, message: "Add at least two addresses first." };
    const settings = await getSettings(user.id);
    const matrix = await routeMatrix(user.id, places, settings.travelMode);
    const travel = { ...settings.travel };
    let filled = 0;
    places.forEach((a, i) =>
      places.forEach((b, j) => {
        const cell = matrix[i][j];
        if (i === j || !cell) return;
        travel[`${a.name}>${b.name}`] = cell.minutes + (a.name === "gym" ? settings.gymExtraMinutes : 0);
        filled++;
      }),
    );
    await saveSettings(user.id, { travel });
    revalidatePath("/", "layout");
    const missing = places.length * (places.length - 1) - filled;
    return { ok: true, message: `Filled ${filled} travel times from Google Maps${missing ? ` (${missing} had no route)` : ""}.` };
  } catch (err) {
    return fail(err);
  }
}
