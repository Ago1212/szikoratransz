import React, { useMemo } from "react";

// Egysoros, időrendi (régi → mai) napi vezetési-idő sáv. Minden cella
// `flex-1` (nem fix szélesség) — a sáv mindig pontosan a rendelkezésre álló
// szélességet tölti ki, sosem tördelődik és sosem igényel vízszintes
// görgetést, akárhány napot (`napokSzama`) is mutat vagy akármilyen keskeny
// a befoglaló kártya.
const SZINTEK = [
  { max: 0, cls: "bg-ink-100 dark:bg-ink-800" },
  { max: 240, cls: "bg-brand-200 dark:bg-brand-900" },
  { max: 480, cls: "bg-brand-400 dark:bg-brand-700" },
  { max: 540, cls: "bg-brand-600 dark:bg-brand-500" },
  { max: Infinity, cls: "bg-amber-500 dark:bg-amber-400" },
];

function szintOsztaly(perc) {
  if (perc == null || perc === 0) return SZINTEK[0].cls;
  return (SZINTEK.find((sz) => perc <= sz.max) || SZINTEK[SZINTEK.length - 1]).cls;
}

export default function Heatmap({ sorok, napokSzama = 28 }) {
  const cellak = useMemo(() => {
    const map = {};
    (sorok || []).forEach((s) => {
      map[s.datum] = (map[s.datum] || 0) + (s.vezetes_perc || 0);
    });
    const ma = new Date();
    const eredmeny = [];
    for (let i = napokSzama - 1; i >= 0; i -= 1) {
      const nap = new Date(ma);
      nap.setDate(nap.getDate() - i);
      const datum = nap.toISOString().slice(0, 10);
      eredmeny.push({ datum, perc: map[datum] ?? null });
    }
    return eredmeny;
  }, [sorok, napokSzama]);

  const oraPerc = (perc) => `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")} óra vezetés`;

  return (
    <div>
      <div className="flex gap-[3px]">
        {cellak.map((c) => (
          <div
            key={c.datum}
            className={`h-3.5 min-w-0 flex-1 rounded-[3px] transition-shadow duration-100 ${szintOsztaly(c.perc)} hover:ring-2 hover:ring-brand-400 dark:hover:ring-brand-300`}
            title={`${c.datum} — ${c.perc != null ? oraPerc(c.perc) : "nincs adat"}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 text-[11px] text-ink-400 dark:text-ink-500">
        <span>Kevesebb</span>
        {SZINTEK.map((sz) => (
          <span key={sz.cls} className={`h-2.5 w-2.5 flex-shrink-0 rounded-[3px] ${sz.cls}`} />
        ))}
        <span>Több</span>
      </div>
    </div>
  );
}
