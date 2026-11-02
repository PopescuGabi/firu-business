import type { Exercise } from "./db/schema.ts";

/** Exercises: one per line, "Name × sets" (or "Name x 3", "Name 3"). */
export function parseExercises(text: string): Exercise[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => {
      const m = line.match(/^(.*?)[\s×x*-]*(\d{1,2})\s*(sets?)?$/i);
      return m && m[1].trim() ? { name: m[1].trim(), sets: Number(m[2]) } : { name: line, sets: 3 };
    });
}


export const formatExercises = (list: Exercise[]) => list.map((e) => `${e.name} × ${e.sets}`).join("\n");
