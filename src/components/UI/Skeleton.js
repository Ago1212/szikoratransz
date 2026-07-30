import React from "react";

// R22 (fejlesztési audit, 2026-07-19): a DataTable.js betöltő állapota
// eddig egyetlen közös, generikus Spinner volt minden lista-oldalon — ez
// a táblázat/kártya-alakú "csontváz" a végleges tartalom durva geometriáját
// mutatja előre, ami kevesebb "villanás"-érzetet ad, főleg lassabb
// hálózaton. Egy helyen cserélve (DataTable.js), minden lista-oldalon
// automatikusan megjelenik.
export default function TableSkeleton({ columns = 4, rows = 6, selectable = false }) {
  return (
    <>
      <div className="w-full space-y-3 bg-slate-50 p-3 dark:bg-ink-950 md:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900"
          >
            <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-700" />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="h-3 w-full animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-700" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-700" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden w-full overflow-hidden md:block">
        <table className="w-full border-collapse">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                {selectable && (
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-4 animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-700" />
                  </td>
                )}
                {Array.from({ length: columns }).map((__, j) => (
                  <td key={j} className="px-6 py-3.5">
                    <div
                      className="h-3.5 animate-pulse rounded bg-ink-100 motion-reduce:animate-none dark:bg-ink-700"
                      style={{ width: `${55 + ((i + j) % 3) * 15}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// A RouteTimelineCard alakját előrevetítő betöltő-állapot a sofőr Fuvar
// részletező oldalán — ugyanaz a minta, mint a fenti TableSkeleton, csak
// a route-kártya geometriájára szabva. A sofőr-oldal nem dark-módosított
// (ld. CLAUDE.md), ezért itt szándékosan nincs `dark:` variáns.
export function RouteCardSkeleton() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-ink-100 motion-reduce:animate-none" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="ml-[18px] h-10 border-l-2 border-dashed border-ink-100" />
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-ink-100 motion-reduce:animate-none" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mt-4 h-14 w-full animate-pulse rounded-xl bg-ink-100 motion-reduce:animate-none" />
    </div>
  );
}
