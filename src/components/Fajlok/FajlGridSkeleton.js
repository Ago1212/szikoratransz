import React from "react";

// Ugyanaz a "csontváz, ne generikus spinner" elv, mint a megosztott
// `TableSkeleton`-nál (ld. components/UI/Skeleton.js) — csak kártya-rács
// alakra szabva.
export default function FajlGridSkeleton({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="mb-3 h-20 animate-pulse rounded-xl bg-ink-100 motion-reduce:animate-none dark:bg-ink-800" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-800" />
          <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-800" />
        </div>
      ))}
    </div>
  );
}
