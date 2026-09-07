// Minimal shimmering placeholder blocks used while a page's data is still
// loading. Tailwind's built-in `animate-pulse` handles the pulse — these
// just supply shapes that echo the real layout, so pages don't pop from
// blank to full once the fetch resolves.

export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-stone-200/70 ${className}`} />;
}

// A quick generic stand-in for smaller pages/Suspense fallbacks that don't
// warrant a bespoke skeleton — a title bar plus a handful of varied-width
// lines.
export function SkeletonLines({ count = 4 }: { count?: number }) {
  const widths = ["w-2/3", "w-1/2", "w-5/6", "w-1/3", "w-3/4", "w-1/2"];
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${widths[i % widths.length]}`} />
        ))}
      </div>
    </div>
  );
}
