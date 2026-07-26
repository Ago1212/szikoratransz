import React from "react";
import { useHistory } from "react-router-dom";
import StatusBadge from "components/UI/StatusBadge.js";

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

// Ugyanazt a `fuvarok` tömböt csoportosítja sofőr szerint, amit a Táblázat/
// Kanban nézet is használ (a jelenleg betöltött, lapozott oldal) — ugyanaz
// az elfogadott korlát, mint a Kanban nézetnél (ld. KanbanBoard.js): nem
// egy külön, lapozatlan lekérdezés, hanem a már betöltött adatot rendezi át.
export default function SoforCsoportositottLista({ fuvarok }) {
  const history = useHistory();

  const handleEditClick = (fuvar) => {
    history.push("/admin/fuvarForm", { data: fuvar });
  };

  const csoportok = {};
  fuvarok.forEach((f) => {
    const kulcs = f.sofor_id ? String(f.sofor_id) : "nincs";
    if (!csoportok[kulcs]) {
      csoportok[kulcs] = { nev: f.sofor_nev || "Nincs sofőrhöz rendelve", fuvarok: [], bevetel: 0 };
    }
    csoportok[kulcs].fuvarok.push(f);
    csoportok[kulcs].bevetel += Number(f.osszesen) || 0;
  });

  const rendezettCsoportok = Object.entries(csoportok).sort(
    ([, a], [, b]) => b.fuvarok.length - a.fuvarok.length,
  );

  if (rendezettCsoportok.length === 0) {
    return <p className="text-sm text-ink-400">Nincs megjeleníthető fuvar.</p>;
  }

  return (
    <div className="space-y-4">
      {rendezettCsoportok.map(([kulcs, csoport]) => (
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
      ))}
    </div>
  );
}
