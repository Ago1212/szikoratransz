import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { PiCaretLeftLight, PiCaretRightLight } from "react-icons/pi";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";
import { fetchAction } from "utils/fetchAction";

const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};
const ALLAPOT_TONE = {
  rogzitett: "neutral",
  szamlazasra_var: "warning",
  szamlazva: "info",
  fizetesre_var: "warning",
  teljesitve: "success",
};

function hetHetfoje(datum) {
  const d = new Date(datum);
  const nap = d.getDay(); // 0 = vasárnap
  const eltolas = nap === 0 ? -6 : 1 - nap;
  d.setDate(d.getDate() + eltolas);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDatum(d) {
  return d.toISOString().slice(0, 10);
}

function toCimke(d) {
  return d.toLocaleDateString("hu-HU", { month: "2-digit", day: "2-digit" });
}

// A Táblázat/Kanban nézettel ellentétben ez a nézet ÖNÁLLÓAN kérdez le
// (ugyanaz a minta, mint StatisztikaDashboard.js-nél) — nem a szülő már
// lapozott (PAGE_SIZE=10) `fuvarok` tömbjét rendezi át, mert a heti
// navigációnak egy adott hét ÖSSZES fuvarját kell látnia, nem csak az
// aktuális oldal néhány sorát.
export default function SoforCsoportositottLista() {
  const history = useHistory();
  const [hetKezdete, setHetKezdete] = useState(() => hetHetfoje(new Date()));
  const [fuvarok, setFuvarok] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const vasarnap = new Date(hetKezdete);
    vasarnap.setDate(vasarnap.getDate() + 6);
    const result = await fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      datumTol: toIsoDatum(hetKezdete),
      datumIg: toIsoDatum(vasarnap),
    });
    setFuvarok(result?.success ? result.fuvarok || [] : []);
    setLoading(false);
  }, [hetKezdete]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEditClick = (fuvar) => {
    history.push("/admin/fuvarForm", { data: fuvar });
  };

  const lepHetet = (iranyElojel) => {
    setHetKezdete((prev) => {
      const uj = new Date(prev);
      uj.setDate(uj.getDate() + iranyElojel * 7);
      return uj;
    });
  };

  const vasarnap = new Date(hetKezdete);
  vasarnap.setDate(vasarnap.getDate() + 6);

  const csoportok = {};
  fuvarok.forEach((f) => {
    const kulcs = f.sofor_id ? String(f.sofor_id) : "nincs";
    if (!csoportok[kulcs]) {
      csoportok[kulcs] = { nev: f.sofor_nev || "Nincs sofőrhöz rendelve", fuvarok: [], bevetel: 0 };
    }
    csoportok[kulcs].fuvarok.push(f);
    csoportok[kulcs].bevetel += Number(f.osszesen) || 0;
  });

  Object.values(csoportok).forEach((csoport) => {
    // Dátum szerint CSÖKKENŐ sorrend csoporton belül — a legutóbbi fuvar
    // legyen felül. Az üres teljesites_datuma-jú sorok a lista végére
    // esnek (üres string a legkisebb összehasonlítási érték).
    csoport.fuvarok.sort((a, b) => (b.teljesites_datuma || "").localeCompare(a.teljesites_datuma || ""));
  });

  const rendezettCsoportok = Object.entries(csoportok).sort(
    ([, a], [, b]) => b.fuvarok.length - a.fuvarok.length,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-3 py-2 shadow-soft dark:border-ink-800 dark:bg-ink-900">
        <button
          type="button"
          onClick={() => lepHetet(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
          aria-label="Előző hét"
        >
          <PiCaretLeftLight className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">
            {toCimke(hetKezdete)} – {toCimke(vasarnap)}
          </span>
          <button
            type="button"
            onClick={() => setHetKezdete(hetHetfoje(new Date()))}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          >
            Ma
          </button>
        </div>
        <button
          type="button"
          onClick={() => lepHetet(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
          aria-label="Következő hét"
        >
          <PiCaretRightLight className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-10" />
      ) : rendezettCsoportok.length === 0 ? (
        <p className="text-sm text-ink-400">Nincs fuvar ezen a héten.</p>
      ) : (
        rendezettCsoportok.map(([kulcs, csoport]) => (
          <div key={kulcs} className="rounded-2xl border border-ink-100 bg-white shadow-soft dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-brand-900 dark:text-ink-50">{csoport.nev}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                  {csoport.fuvarok.length} fuvar
                </span>
              </div>
              <span className="text-xs font-semibold text-ink-500 dark:text-ink-400">
                {csoport.bevetel.toLocaleString("hu-HU")} Ft
              </span>
            </div>
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {csoport.fuvarok.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleEditClick(f)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-ink-800"
                >
                  <span className="text-ink-600 dark:text-ink-300">
                    {f.teljesites_datuma || "—"} · {f.felrako || "—"} → {f.lerako || "—"}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-ink-500 dark:text-ink-400">
                      {f.osszesen != null ? `${Number(f.osszesen).toLocaleString("hu-HU")} Ft` : "—"}
                    </span>
                    <StatusBadge tone={ALLAPOT_TONE[f.allapot] || "neutral"}>{ALLAPOT_LABEL[f.allapot] || f.allapot}</StatusBadge>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
