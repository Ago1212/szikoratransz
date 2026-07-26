import React from "react";
import StatusBadge from "components/UI/StatusBadge.js";

// A sofőr-oldali MegfelelosegiWidget.js jármű-központú párja — a küszöb itt
// 90 nap (EU 165/2014, jármű-egység memóriája), nem 28, mint a
// sofőrkártyánál (ld. tachografVuInterface.php::MEGFELELOSEG_* konstansok).
const STATUSZ_BADGE = {
  rendben: { tone: "success", label: "Rendben" },
  esedekes: { tone: "warning", label: "Esedékes" },
  lejart: { tone: "danger", label: "Lejárt" },
  nincs_adat: { tone: "neutral", label: "Nincs adat" },
};
const STATUSZ_SORREND = { lejart: 0, esedekes: 1, nincs_adat: 2, rendben: 3 };

export default function VuMegfelelosegiWidget({ sorok, onJarmuClick }) {
  if (!sorok || sorok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs még rögzített jármű.</p>;
  }
  const rendezett = [...sorok].sort((a, b) => STATUSZ_SORREND[a.statusz] - STATUSZ_SORREND[b.statusz]);

  return (
    <ul className="divide-y divide-ink-100 dark:divide-ink-800">
      {rendezett.map((s) => {
        const badge = STATUSZ_BADGE[s.statusz] || STATUSZ_BADGE.nincs_adat;
        return (
          <li key={`${s.jarmu_tipus}:${s.jarmu_id}`} className="flex items-center justify-between gap-3 py-2.5">
            <button type="button" onClick={() => onJarmuClick(s.jarmu_tipus, s.jarmu_id)} className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-brand-900 hover:underline dark:text-ink-50">{s.rendszam}</p>
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {s.utolsoDatum ? `utolsó letöltés: ${s.utolsoDatum} · ${s.napokOta} napja` : "még nincs letöltött jármű-egység adat"}
              </p>
            </button>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </li>
        );
      })}
    </ul>
  );
}
