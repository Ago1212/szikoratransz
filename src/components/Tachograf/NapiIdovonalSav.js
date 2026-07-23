import React from "react";

const TONE_COLOR = {
  vezetes: "bg-brand-600 dark:bg-brand-500",
  munka: "bg-amber-500 dark:bg-amber-400",
  rendelkezesre_allas: "bg-ink-300 dark:bg-ink-600",
  piheno: "bg-emerald-500 dark:bg-emerald-400",
};
const TEVEKENYSEG_LABEL = {
  vezetes: "Vezetés",
  munka: "Munka",
  rendelkezesre_allas: "Rendelkezésre állás",
  piheno: "Pihenő",
};

const oraPerc = (perc) => `${String(Math.floor(perc / 60)).padStart(2, "0")}:${String(perc % 60).padStart(2, "0")}`;

export default function NapiIdovonalSav({ valtozasok }) {
  if (!valtozasok || valtozasok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs rögzített állapotváltás erre a napra.</p>;
  }

  const rendezett = [...valtozasok].sort((a, b) => a.perc - b.perc);
  const szegmensek = rendezett.map((v, i) => {
    const veg = i + 1 < rendezett.length ? rendezett[i + 1].perc : 1440;
    return { ...v, szazalek: Math.max(0, ((veg - v.perc) / 1440) * 100) };
  });

  return (
    <div>
      <div
        className="flex h-9 overflow-hidden rounded-lg"
        role="img"
        aria-label="A nap vezetési, munka, rendelkezésre állási és pihenő idejének beosztása"
      >
        {szegmensek.map((sz, i) => (
          <div
            key={i}
            className={`h-full ${TONE_COLOR[sz.tevekenyseg] || "bg-ink-200 dark:bg-ink-700"}`}
            style={{ width: `${sz.szazalek}%` }}
            title={`${oraPerc(sz.perc)} — ${TEVEKENYSEG_LABEL[sz.tevekenyseg] || sz.tevekenyseg}${sz.kartya_kivetel ? " (kártya kivéve)" : ""}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
        {Object.entries(TEVEKENYSEG_LABEL).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${TONE_COLOR[key]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
