import React from "react";
import { PiMagnifyingGlassLight, PiXLight } from "react-icons/pi";

// Modern szűrő-sáv: keresés (rendszám/cím) + státusz chipek. A `sofőr`/
// `csoport`/`dátum` dimenziót szándékosan nem tartalmazza — a GPSmart-
// integráció jelenleg egyiket sem adja vissza (nincs sofőr-hozzárendelés,
// jármű-csoport vagy múltbeli dátum ezen a pozíció-lekérdezésen), egy
// üres/hatástalan szűrő pedig rosszabb UX, mint annak hiánya.
const STATUSZ_OPCIOK = [
  { kulcs: "mind", label: "Mind" },
  { kulcs: "mozgasban", label: "Mozgásban", dotClass: "bg-emerald-500" },
  { kulcs: "all", label: "Áll", dotClass: "bg-amber-500" },
  { kulcs: "offline", label: "Offline", dotClass: "bg-red-500" },
];

export default function FlottaSzurok({
  kereses,
  onKeresesChange,
  statuszSzuro,
  onStatuszSzuroChange,
  talalatSzam,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <PiMagnifyingGlassLight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          type="text"
          value={kereses}
          onChange={(e) => onKeresesChange(e.target.value)}
          placeholder="Keresés rendszám vagy cím szerint..."
          aria-label="Keresés rendszám vagy cím szerint"
          className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-8 text-sm text-ink-700 placeholder-ink-300 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {kereses && (
          <button
            type="button"
            onClick={() => onKeresesChange("")}
            aria-label="Keresés törlése"
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-300 hover:bg-slate-100 hover:text-ink-600"
          >
            <PiXLight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
          {STATUSZ_OPCIOK.map((opt) => (
            <button
              key={opt.kulcs}
              type="button"
              onClick={() => onStatuszSzuroChange(opt.kulcs)}
              aria-pressed={statuszSzuro === opt.kulcs}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                statuszSzuro === opt.kulcs
                  ? "bg-white text-brand-700 shadow-soft"
                  : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {opt.dotClass && (
                <span className={`h-1.5 w-1.5 rounded-full ${opt.dotClass}`} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
        <span className="whitespace-nowrap text-xs text-ink-400">
          {talalatSzam} találat
        </span>
      </div>
    </div>
  );
}
