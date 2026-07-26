import React from "react";
import StatusBadge from "components/UI/StatusBadge.js";

const STATUSZ_BADGE = {
  rendben: { tone: "success", label: "Rendben" },
  esedekes: { tone: "warning", label: "Esedékes" },
  lejart: { tone: "danger", label: "Lejárt" },
  nincs_adat: { tone: "neutral", label: "Nincs adat" },
};
// Sorrend-szempont: EXPORTÁLVA, mert a "Vezetési idő" panel (SoforHeatmapLista.js)
// ugyanabban a sorrendben kell mutassa a sofőröket, mint ez a lista — a két
// kártya egymás mellett, soronként párban olvasandó (N. név ⇄ N. sáv), ha a
// két komponens külön-külön rendezne, a sorok nem egy driverre vonatkoznának.
export const STATUSZ_SORREND = { lejart: 0, esedekes: 1, nincs_adat: 2, rendben: 3 };
export function rendezettSorok(sorok) {
  return [...(sorok || [])].sort((a, b) => STATUSZ_SORREND[a.statusz] - STATUSZ_SORREND[b.statusz]);
}

// A sorok fix magassága (`h-14`, 56px) szándékos — a "Vezetési idő" panel
// (SoforHeatmapLista.js) minden sofőr-sávjának pontosan ugyanekkora a
// magassága, hogy a két, egymás melletti kártya sorai vízszintesen
// egy vonalban legyenek (élő felhasználói visszajelzés alapján javítva —
// korábban a natural-flow sormagasság nem egyezett a heatmap-sávok jóval
// alacsonyabb sormagasságával).
export default function MegfelelosegiWidget({ sorok, onSoforClick }) {
  if (!sorok || sorok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs még rögzített sofőr.</p>;
  }

  return (
    <ul className="divide-y divide-ink-100 dark:divide-ink-800">
      {sorok.map((s) => {
        const badge = STATUSZ_BADGE[s.statusz] || STATUSZ_BADGE.nincs_adat;
        return (
          <li key={s.sofor_id} className="flex h-14 items-center justify-between gap-3">
            <button type="button" onClick={() => onSoforClick(s.sofor_id)} className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-brand-900 hover:underline dark:text-ink-50">{s.nev}</p>
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {s.utolsoDatum ? `utolsó letöltés: ${s.utolsoDatum} · ${s.napokOta} napja` : "még nincs letöltött kártya-adat"}
              </p>
            </button>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </li>
        );
      })}
    </ul>
  );
}
