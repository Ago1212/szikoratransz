import React, { useCallback, useEffect, useState } from "react";

import { fetchAction } from "utils/fetchAction";
import Modal from "components/UI/Modal.js";
import DataTable from "components/UI/DataTable.js";

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  return `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;
};

// A sofőr-oldali SoforDrawer.js jármű-központú párja. Nincs átpárosítás
// (a jármű-egység adatnál nincs "rossz jármű"-jellegű hiba, amit korrigálni
// kellene, mint a sofőr-kártyánál) — csak a napi napló + a napi kártya-
// kereszthivatkozások (ki ült a járműben, mikor, milyen km-óraállással).
export default function JarmuDrawer({ jarmuTipus, jarmuId, rendszam, onClose }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reszletSor, setReszletSor] = useState(null);

  const betoltes = useCallback(() => {
    if (!jarmuTipus || !jarmuId) return;
    setLoading(true);
    fetchAction("getTachografVuNapiAktivitas", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      jarmuTipus,
      jarmuId,
    })
      .then((result) => setSorok(result?.success ? result.sorok || [] : []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jarmuTipus, jarmuId]);

  useEffect(() => {
    betoltes();
  }, [betoltes]);

  const columns = [
    { key: "datum", label: "Dátum", sortable: true },
    { key: "km_zaro", label: "Km-óraállás", render: (row) => (row.km_zaro != null ? `${row.km_zaro.toLocaleString("hu-HU")} km` : "—") },
    { key: "vezetes_perc", label: "Vezetés", render: (row) => `${percToOraPerc(row.vezetes_perc)} óra` },
    {
      key: "kartya_referenciak_json",
      label: "Kártya-események",
      render: (row) => {
        const refs = row.kartya_referenciak_json || [];
        return refs.length > 0 ? (
          <button type="button" onClick={() => setReszletSor(row)} className="text-brand-700 hover:underline dark:text-brand-300">
            {refs.length} esemény
          </button>
        ) : (
          "—"
        );
      },
    },
  ];

  if (!jarmuTipus || !jarmuId) return null;

  return (
    <Modal open={!!jarmuTipus} onClose={onClose} title={`Jármű — ${rendszam || ""}`} maxWidth="max-w-3xl">
      <DataTable
        columns={columns}
        rows={sorok}
        loading={loading}
        mobileTitleKey="datum"
        emptyLabel="Nincs importált jármű-egység adat erre a járműre"
        searchable={false}
      />

      <Modal open={!!reszletSor} onClose={() => setReszletSor(null)} title={reszletSor ? `Kártya-események — ${reszletSor.datum}` : ""} maxWidth="max-w-lg">
        {reszletSor && (
          <ul className="space-y-2 text-sm">
            {(reszletSor.kartya_referenciak_json || []).map((k, i) => (
              <li key={i} className="rounded-xl border border-ink-100 p-3 dark:border-ink-700">
                <p className="font-semibold text-brand-900 dark:text-ink-50">{k.nev}</p>
                <p className="text-xs text-ink-400 dark:text-ink-500">Kártyaszám: {k.kartyaszam}</p>
                <p className="mt-1 text-ink-600 dark:text-ink-300">
                  Behelyezve: {k.behelyezve || "—"} ({k.kmBehelyezeskor != null ? `${k.kmBehelyezeskor.toLocaleString("hu-HU")} km` : "—"})
                </p>
                <p className="text-ink-600 dark:text-ink-300">
                  Kivéve: {k.kivetel || "—"} ({k.kmKivetelkor != null ? `${k.kmKivetelkor.toLocaleString("hu-HU")} km` : "—"})
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Modal>
  );
}
