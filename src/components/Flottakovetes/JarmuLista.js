import React, { useMemo, useState } from "react";
import {
  PiTruckLight,
  PiCaretUpLight,
  PiCaretDownLight,
  PiGasPumpLight,
} from "react-icons/pi";
import { GradientCardHeader } from "components/UI/PageCard.js";
import StatusBadge from "components/UI/StatusBadge.js";

const OSZLOPOK = [
  { kulcs: "rendszam", label: "Rendszám" },
  { kulcs: "_allapot", label: "Státusz" },
  { kulcs: "_sebessegSzam", label: "Sebesség" },
  { kulcs: "_datum", label: "Utolsó jelzés" },
];

function rendez(rows, rendezes) {
  if (!rendezes) return rows;
  const { kulcs, irany } = rendezes;
  const masolat = [...rows];
  masolat.sort((a, b) => {
    let av = a[kulcs];
    let bv = b[kulcs];
    if (kulcs === "_allapot") {
      av = a._allapot.label;
      bv = b._allapot.label;
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "object" && av instanceof Date) {
      return irany === "asc" ? av - bv : bv - av;
    }
    if (typeof av === "number") {
      return irany === "asc" ? av - bv : bv - av;
    }
    return irany === "asc"
      ? String(av).localeCompare(String(bv), "hu")
      : String(bv).localeCompare(String(av), "hu");
  });
  return masolat;
}

// Modern jármű-lista — asztalon rendezhető, sticky fejlécű, zebra-csíkos
// táblázat (a `DataTable.js`-ben már bevált vizuális nyelvvel, de saját
// egysoros-kijelölés + oszloprendezés interakcióval, amit az a megosztott
// komponens nem támogat), mobilon kártyalista. Kis (jellemzően <30 soros)
// flottánál nincs szükség virtualizációra — ha ez a jövőben nőne, a
// sor-renderelés itt, egyetlen `JarmuSor` függvényben van elkülönítve,
// könnyen cserélhető egy virtualizált motorra.
export default function JarmuLista({ rows, kivalasztott, onSelect }) {
  const [rendezes, setRendezes] = useState({ kulcs: "rendszam", irany: "asc" });

  const rendezettSorok = useMemo(() => rendez(rows, rendezes), [rows, rendezes]);

  const toggleRendezes = (kulcs) => {
    setRendezes((prev) =>
      prev.kulcs === kulcs
        ? { kulcs, irany: prev.irany === "asc" ? "desc" : "asc" }
        : { kulcs, irany: "asc" },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-100">
      <GradientCardHeader icon={PiTruckLight} title="Járművek" />

      {/* Mobil kártyalista */}
      <div className="flex-1 overflow-y-auto md:hidden">
        {rendezettSorok.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-400">
            Nincs a szűrésnek megfelelő jármű.
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {rendezettSorok.map((p) => (
              <button
                key={p.rendszam}
                type="button"
                onClick={() => onSelect(p.rendszam)}
                className={`flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors duration-150 ${
                  kivalasztott === p.rendszam
                    ? "border-brand-300 bg-brand-50"
                    : "border-ink-100 bg-white hover:border-brand-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-brand-900">
                    <PiTruckLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
                    {p.rendszam}
                  </span>
                  <StatusBadge tone={p._allapot.tone}>{p._allapot.label}</StatusBadge>
                </div>
                <span className="truncate text-xs text-ink-500">{p.cim || "—"}</span>
                <div className="flex items-center justify-between text-[11px] text-ink-400">
                  <span>{p.sebesseg}</span>
                  <span>{p._relativIdo}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Asztali táblázat — sticky fejléc, zebra, hover, oszloprendezés */}
      <div className="hidden flex-1 overflow-y-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {OSZLOPOK.map((col) => (
                <th
                  key={col.kulcs}
                  className="sticky top-0 z-10 whitespace-nowrap border-b border-ink-100 bg-white px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400"
                >
                  <button
                    type="button"
                    onClick={() => toggleRendezes(col.kulcs)}
                    className="flex items-center gap-1 hover:text-ink-700"
                  >
                    {col.label}
                    {rendezes.kulcs === col.kulcs &&
                      (rendezes.irany === "asc" ? (
                        <PiCaretUpLight className="h-3 w-3" />
                      ) : (
                        <PiCaretDownLight className="h-3 w-3" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rendezettSorok.length === 0 ? (
              <tr>
                <td colSpan={OSZLOPOK.length} className="px-4 py-8 text-center text-sm text-ink-400">
                  Nincs a szűrésnek megfelelő jármű.
                </td>
              </tr>
            ) : (
              rendezettSorok.map((p, idx) => (
                <tr
                  key={p.rendszam}
                  onClick={() => onSelect(p.rendszam)}
                  aria-selected={kivalasztott === p.rendszam}
                  className={`cursor-pointer border-b border-ink-50 transition-colors duration-150 ${
                    kivalasztott === p.rendszam
                      ? "bg-brand-50"
                      : idx % 2 === 1
                        ? "bg-slate-50/60 hover:bg-brand-50/40"
                        : "hover:bg-brand-50/40"
                  }`}
                >
                  <td className="px-4 py-2.5 font-semibold text-brand-900">
                    <span className="flex items-center gap-1.5">
                      <PiTruckLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
                      {p.rendszam}
                      {p._alacsonyUzemanyag && (
                        <PiGasPumpLight
                          className="h-3.5 w-3.5 flex-shrink-0 text-amber-500"
                          title="Alacsony üzemanyagszint"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge tone={p._allapot.tone}>{p._allapot.label}</StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-600">{p.sebesseg}</td>
                  <td className="px-4 py-2.5 text-ink-500">
                    <span title={p.idopont}>{p._relativIdo}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
