/** Shown the moment you tap a tab, while the page's data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="enter-up">
      <div className="skeleton mb-2 h-4 w-32" />
      <div className="skeleton mb-6 h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-40 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}
