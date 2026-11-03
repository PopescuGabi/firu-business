import { Bento, spanStyle, type Span } from "@/components/ui";

const TILES: Span[] = [
  { p: 2, t: 6, l: 6, d: 5, rl: 2, rd: 2 },
  { p: 1, t: 3, l: 3, d: 2 },
  { p: 1, t: 3, l: 3, d: 2 },
  { p: 2, t: 6, l: 6, d: 3, rd: 2 },
  { p: 1, t: 3, l: 3, d: 2 },
  { p: 1, t: 3, l: 3, d: 2 },
  { p: 2, t: 3, l: 6, d: 4 },
  { p: 2, t: 6, l: 6, d: 4 },
];

/** Shown the moment you tap a tab, while the page's data loads: frosted tiles in the bento grid. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="enter-up">
      <div className="skeleton mb-2 h-4 w-32" />
      <div className="skeleton mb-6 h-9 w-56" />
      <Bento>
        {TILES.map((span, i) => (
          <div key={i} className="glass min-h-36 rounded-[24px] p-4" style={spanStyle(span, i)}>
            <div className="skeleton h-4 w-24" style={{ animationDelay: `${i * 60}ms` }} />
          </div>
        ))}
      </Bento>
    </div>
  );
}
