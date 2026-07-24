import React, { useMemo } from "react";
import Heatmap, { SZINTEK } from "components/Tachograf/Heatmap.js";

// A "Vezetési idő, elmúlt 4 hét" panel — külön kártya marad a megfelelőségi
// listától (felhasználói visszajelzés: tetszett, hogy a kettő vizuálisan
// elkülönül), de a korábbi EGYETLEN, minden sofőrt összemosó sáv helyett
// soronként, sofőrönként külön sávot mutat.
export default function SoforHeatmapLista({ soforok, napiSorok }) {
  const soforSorokTerkep = useMemo(() => {
    const map = {};
    (napiSorok || []).forEach((s) => {
      if (!map[s.sofor_id]) map[s.sofor_id] = [];
      map[s.sofor_id].push(s);
    });
    return map;
  }, [napiSorok]);

  if (!soforok || soforok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs még rögzített sofőr.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] text-ink-400 dark:text-ink-500">
        <span>Kevesebb</span>
        {SZINTEK.map((sz) => (
          <span key={sz.cls} className={`h-2.5 w-2.5 flex-shrink-0 rounded-[3px] ${sz.cls}`} />
        ))}
        <span>Több</span>
      </div>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800">
        {soforok.map((s) => (
          <li key={s.sofor_id} className="py-2.5" title={s.nev}>
            <Heatmap sorok={soforSorokTerkep[s.sofor_id] || []} napokSzama={28} showLegend={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}
