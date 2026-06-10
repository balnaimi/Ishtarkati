export function StatsGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2" aria-busy="true" aria-label="loading">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="sk-card animate-pulse space-y-3">
          <div className="h-4 w-2/5 rounded bg-cream-300/60" />
          <div className="h-8 w-3/5 rounded bg-cream-300/50" />
          <div className="h-3 w-1/3 rounded bg-cream-200/70" />
        </div>
      ))}
      <div className="md:col-span-2 sk-card animate-pulse space-y-2">
        <div className="h-4 w-1/4 rounded bg-cream-300/60" />
        <div className="h-4 w-1/6 rounded bg-cream-200/70" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      aria-busy="true"
      aria-label="loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-card animate-pulse space-y-2 p-3">
          <div className="h-8 w-8 rounded-xl bg-cream-300/60" />
          <div className="h-4 w-4/5 rounded bg-cream-300/50" />
          <div className="h-3 w-2/3 rounded bg-cream-200/70" />
        </div>
      ))}
    </div>
  );
}
