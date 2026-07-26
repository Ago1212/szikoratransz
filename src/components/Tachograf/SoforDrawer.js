import React, { useCallback, useEffect, useState } from "react";
import { PiArrowsLeftRightLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import Modal from "components/UI/Modal.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Heatmap from "components/Tachograf/Heatmap.js";
import NapiIdovonalSav from "components/Tachograf/NapiIdovonalSav.js";
import FormField from "components/UI/FormField.js";

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  return `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;
};

export default function SoforDrawer({ soforId, soforNev, soforok, onClose }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [sorok, setSorok] = useState([]);
  const [esemenyek, setEsemenyek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reszletNap, setReszletNap] = useState(null);
  const [atparositasSor, setAtparositasSor] = useState(null);
  const [ujSoforId, setUjSoforId] = useState("");
  const [atparositasLoading, setAtparositasLoading] = useState(false);

  const betoltes = useCallback(() => {
    if (!soforId) return;
    setLoading(true);
    Promise.all([
      fetchAction("getTachografNapiAktivitas", { ceg_id: user.ceg_id, kerelmezo_id: user.id, sofor_id: soforId }),
      fetchAction("getTachografEsemenyek", { ceg_id: user.ceg_id, kerelmezo_id: user.id, sofor_id: soforId }),
    ])
      .then(([napiResult, esemenyResult]) => {
        setSorok(napiResult?.success ? napiResult.sorok || [] : []);
        setEsemenyek(esemenyResult?.success ? esemenyResult.sorok || [] : []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soforId]);

  useEffect(() => {
    betoltes();
  }, [betoltes]);

  const handleAtparositas = async () => {
    if (!ujSoforId) {
      toast.error("Válassz sofőrt.");
      return;
    }
    setAtparositasLoading(true);
    const result = await fetchAction("atparositTachografNap", {
      id: atparositasSor.id,
      ujSoforId,
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    });
    setAtparositasLoading(false);
    if (result?.success) {
      toast.success("A napló-bejegyzés átpárosítva.");
      setAtparositasSor(null);
      setUjSoforId("");
      betoltes();
    } else {
      toast.error(result?.message || "Az átpárosítás sikertelen.");
    }
  };

  const columns = [
    { key: "datum", label: "Dátum", sortable: true },
    { key: "tavolsag_km", label: "Táv", render: (row) => (row.tavolsag_km != null ? `${row.tavolsag_km} km` : "—") },
    { key: "vezetes_perc", label: "Vezetés", render: (row) => percToOraPerc(row.vezetes_perc) },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiArrowsLeftRightLight />} onClick={() => setAtparositasSor(row)} title="Átpárosítás másik sofőrre" />
        </div>
      ),
    },
  ];

  if (!soforId) return null;

  return (
    <Modal open={!!soforId} onClose={onClose} title={`Sofőr — ${soforNev || ""}`} maxWidth="max-w-3xl">
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Vezetési idő, elmúlt 4 hét</h4>
          <Heatmap sorok={sorok} napokSzama={28} />
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Napi napló</h4>
          <DataTable
            columns={columns}
            rows={sorok}
            loading={loading}
            mobileTitleKey="datum"
            emptyLabel="Nincs importált tachográf-adat erre a sofőrre"
            searchable={false}
          />
        </div>

        {esemenyek.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Események / hibák</h4>
            <ul className="space-y-1 text-sm">
              {esemenyek.map((e) => (
                <li key={e.id} className="text-ink-600 dark:text-ink-300">{e.kezdet} — {e.tipus}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Modal open={!!reszletNap} onClose={() => setReszletNap(null)} title={reszletNap ? `Napi részletek — ${reszletNap.datum}` : ""} maxWidth="max-w-lg">
        {reszletNap && <NapiIdovonalSav valtozasok={reszletNap.aktivitas_json} />}
      </Modal>

      <Modal open={!!atparositasSor} onClose={() => setAtparositasSor(null)} title="Napló-bejegyzés átpárosítása" maxWidth="max-w-md">
        {atparositasSor && (
          <div className="space-y-4">
            <p className="text-sm text-ink-500 dark:text-ink-400">
              A {atparositasSor.datum} napi bejegyzés jelenleg <b>{soforNev}</b> sofőrhöz van rendelve.
            </p>
            <FormField label="Új sofőr" as="select" required value={ujSoforId} onChange={(e) => setUjSoforId(e.target.value)}>
              <option value="">Válassz sofőrt...</option>
              {soforok.filter((s) => String(s.id) !== String(soforId)).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </FormField>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAtparositasSor(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
                Mégsem
              </button>
              <button
                type="button"
                disabled={atparositasLoading}
                onClick={handleAtparositas}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {atparositasLoading ? "Mentés..." : "Átpárosítás"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
}
