import React from "react";

const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};
const SORREND = ["rogzitett", "szamlazasra_var", "szamlazva", "fizetesre_var", "teljesitve"];

export default function AllapotOsszesitoChips({ osszesito, active, onSelect }) {
  if (!osszesito) return null;
  return (
    // Mobilon (UX-audit visszajelzés: a lista "az alján kezdődik") a
    // korábbi `flex-wrap` 2-3 sorra törte a chipeket, feleslegesen sok
    // függőleges helyet foglalva a tényleges lista fölött — most egy
    // vízszintesen görgethető, egysoros csík, ugyanúgy, mint a mobil
    // nézetváltó gomboknál (ld. Fuvarok.js). Desktopon (md:) egy sorban
    // úgyis kifér mind a 6 chip, ott a görgetés sosem aktiválódik.
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`flex min-h-11 flex-shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          !active
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
        }`}
      >
        Összes
      </button>
      {SORREND.map((kulcs) => (
        <button
          key={kulcs}
          type="button"
          onClick={() => onSelect(active === kulcs ? "" : kulcs)}
          className={`flex min-h-11 flex-shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === kulcs
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          }`}
        >
          {ALLAPOT_LABEL[kulcs]}: {osszesito[kulcs] ?? 0}
        </button>
      ))}
    </div>
  );
}
