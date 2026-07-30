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
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
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
          className={`flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
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
