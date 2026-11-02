/**
 * Pulls the JSON object out of a reply pasted from the Claude app:
 * the last ```json fenced block, or else the outermost {...} in the text.
 */
export function extractJson(reply: string): unknown | null {
  const fences = [...reply.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi)].map((m) => m[1].trim());
  const candidates = [...fences.reverse()];
  const first = reply.indexOf("{");
  const last = reply.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(reply.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
