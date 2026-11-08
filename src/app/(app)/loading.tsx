import { Bento, spanStyle, type Span } from "@/components/ui";

const TILES: Span[] = [
  { p: 2, t: 6, l: 6, d: 6, rl: 2, rd: 2 },
  { p: 1, t: 3, l: 3, d: 3 },
  { p: 1, t: 3, l: 3, d: 3 },
  { p: 1, t: 3, l: 3, d: 3 },
  { p: 1, t: 3, l: 3, d: 3 },
  { p: 2, t: 6, l: 4, d: 4 },
  { p: 2, t: 3, l: 4, d: 4 },
  { p: 2, t: 3, l: 4, d: 4 },
];

/**
 * Shown the moment you tap a page, while its data loads: calm glass placeholders where tiles will be, with a soft
 * shimmer on the lines (no blur over the whole page).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-2 h-3.5 w-32" />
      <div className="skeleton mb-6 h-8 w-60" />
      <Bento>
        {TILES.map((span, i) => (
          <div key={i} className="glass flex min-h-40 flex-col gap-3 rounded-[22px] p-4" style={spanStyle(span, i)}>
            <div className="skeleton h-3.5 w-28" style={{ animationDelay: `${i * 60}ms` }} />
            <div className="skeleton mt-2 h-7 w-20" style={{ animationDelay: `${i * 60 + 40}ms` }} />
            <div className="skeleton h-3 w-3/4" style={{ animationDelay: `${i * 60 + 80}ms` }} />
            <div className="skeleton h-3 w-1/2" style={{ animationDelay: `${i * 60 + 120}ms` }} />
          </div>
        ))}
      </Bento>
    </div>
  );
}
