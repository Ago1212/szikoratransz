import React, { useEffect, useState } from "react";
import {
  PiGasPumpLight,
  PiCaretDownLight,
  PiCaretUpLight,
  PiWarningCircleLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const formatHuf = (value) =>
  new Intl.NumberFormat("hu-HU").format(value ?? 0);

// Item 1: üzemanyag-fogyasztás anomália-detektálás — ld.
// backend/interface/tankolasInterface.php::getFogyasztasElemzes komment a
// számítási módszerért (két egymást követő tankolás km-különbsége alapján,
// medián-viszonyítással). Szándékosan összecsukható, alapból csukott kártya
// (mint a "Havi alakulás" Koltsegek.js-ben) — ez egy ritkábban nézett,
// elemző jellegű nézet, ne foglaljon helyet alapból a Pénzforgalom oldal
// tetején.
export default function CardUzemanyagElemzes() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [jarmuvek, setJarmuvek] = useState([]);
  const [kibontott, setKibontott] = useState(() => new Set());

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    const user = JSON.parse(sessionStorage.getItem("user"));
    fetchAction("getFogyasztasElemzes", { ceg_id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) {
        setJarmuvek(result.jarmuvek || []);
        setLoaded(true);
      }
      setLoading(false);
    });
  }, [open, loaded]);

  const toggleKibontva = (kamionId) => {
    setKibontott((prev) => {
      const uj = new Set(prev);
      if (uj.has(kamionId)) uj.delete(kamionId);
      else uj.add(kamionId);
      return uj;
    });
  };

  const vanAdat = jarmuvek.filter((j) => j.atlagFogyasztas !== null);
  const nincsAdat = jarmuvek.filter((j) => j.atlagFogyasztas === null);
  const osszesAnomalia = vanAdat.reduce(
    (osszeg, j) => osszeg + j.szakaszok.filter((s) => s.anomalia).length,
    0,
  );

  return (
    <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <PiGasPumpLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
        <h3 className="font-display text-base font-semibold text-brand-900">
          Üzemanyag-fogyasztás elemzés
        </h3>
        {osszesAnomalia > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
            <PiWarningCircleLight className="h-3.5 w-3.5" />
            {osszesAnomalia} anomália
          </span>
        )}
        {open ? (
          <PiCaretUpLight className="ml-auto h-4 w-4 flex-shrink-0 text-ink-400" />
        ) : (
          <PiCaretDownLight className="ml-auto h-4 w-4 flex-shrink-0 text-ink-400" />
        )}
      </button>

      {open && (
        <div className="mt-4">
          {loading && <p className="py-6 text-center text-sm text-ink-400">Betöltés…</p>}

          {!loading && vanAdat.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">
              Nincs elég tankolás-adat (legalább 2, km-óraállással rögzített tankolás kell
              járművenként) a fogyasztás kiszámításához.
            </p>
          )}

          {!loading && vanAdat.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-400">
                Becslés: két egymást követő tankolás km-óraállás-különbsége és a második
                tankolás literje alapján (L/100km), a jármű saját mediánjához viszonyítva —
                a {"20%-nál"} nagyobb eltérés lehet üzemanyag-lopás, kártyavisszaélés vagy
                hibás km-rögzítés jele, de nem bizonyíték, mindig érdemes utánanézni.
              </p>
              {vanAdat.map((jarmu) => {
                const anomaliaSzam = jarmu.szakaszok.filter((s) => s.anomalia).length;
                const kibontva = kibontott.has(jarmu.kamion_id);
                return (
                  <div key={jarmu.kamion_id} className="rounded-xl border border-ink-100">
                    <button
                      type="button"
                      onClick={() => toggleKibontva(jarmu.kamion_id)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span className="font-semibold text-ink-800">{jarmu.rendszam || `#${jarmu.kamion_id}`}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm tabular-nums text-ink-600">
                          {formatHuf(jarmu.atlagFogyasztas)} L/100km (tipikus)
                        </span>
                        {anomaliaSzam > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                            {anomaliaSzam} anomália
                          </span>
                        )}
                        {kibontva ? (
                          <PiCaretUpLight className="h-4 w-4 text-ink-400" />
                        ) : (
                          <PiCaretDownLight className="h-4 w-4 text-ink-400" />
                        )}
                      </span>
                    </button>
                    {kibontva && (
                      <div className="border-t border-ink-100">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-[11px] uppercase text-ink-400">
                            <tr>
                              <th className="px-3 py-2 text-left">Dátum</th>
                              <th className="px-3 py-2 text-right">Km-szakasz</th>
                              <th className="px-3 py-2 text-right">Liter</th>
                              <th className="px-3 py-2 text-right">L/100km</th>
                              <th className="px-3 py-2 text-right">Eltérés</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jarmu.szakaszok.map((sz) => (
                              <tr
                                key={sz.tankolas_id}
                                className={`border-t border-ink-100 ${sz.anomalia ? "bg-red-50" : ""}`}
                              >
                                <td className="px-3 py-1.5 text-ink-600">{(sz.datum || "").slice(0, 10)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-ink-600">
                                  {formatHuf(sz.km_tol)} → {formatHuf(sz.km_ig)}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-ink-600">{sz.liter}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${sz.anomalia ? "text-red-600" : "text-ink-800"}`}>
                                  {sz.fogyasztas_100km}
                                </td>
                                <td className={`px-3 py-1.5 text-right tabular-nums ${sz.anomalia ? "font-bold text-red-600" : "text-ink-400"}`}>
                                  {sz.elteres_szazalek > 0 ? "+" : ""}
                                  {sz.elteres_szazalek}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {nincsAdat.length > 0 && (
                <p className="mt-1 text-xs text-ink-400">
                  {nincsAdat.length} jármű ({nincsAdat.map((j) => j.rendszam).filter(Boolean).join(", ")})
                  esetén nincs elég adat a fogyasztás kiszámításához.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
