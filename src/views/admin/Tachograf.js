import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiIdentificationCardLight,
  PiUploadLight,
  PiWarningCircleLight,
  PiRoadHorizonLight,
  PiUsersLight,
  PiClockCountdownLight,
  PiEyeLight,
} from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import CardStats from "components/Cards/CardStats.js";
import Modal from "components/UI/Modal.js";
import MegfelelosegiWidget from "components/Tachograf/MegfelelosegiWidget.js";
import Heatmap from "components/Tachograf/Heatmap.js";
import SoforokLista from "components/Tachograf/SoforokLista.js";
import SoforDrawer from "components/Tachograf/SoforDrawer.js";
import ImportElozmenyek from "components/Tachograf/ImportElozmenyek.js";
import ImportWizard from "components/Tachograf/ImportWizard.js";
import NapiIdovonalSav from "components/Tachograf/NapiIdovonalSav.js";

// Tachográf modul — UX-újratervezés (2026-07-24). 4 fülre bontva
// (Áttekintés/Sofőrök/Napló/Import előzmények) a korábbi, mindent egy lapon
// mutató nézet helyett. A dekódolást változatlanul a backend `DddParser.php`-ja
// végzi. Szándékosan NINCS automatikus jogi (EU 561/2006) szabálysértés-
// minősítés — a "napi vezetés > 9 óra" KPI egy nyers küszöbérték, nem verdikt.
const FULEK = [
  { key: "attekintes", label: "Áttekintés" },
  { key: "soforok", label: "Sofőrök" },
  { key: "naplo", label: "Napló" },
  { key: "import", label: "Import előzmények" },
];

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  const ora = Math.floor(perc / 60);
  const p = perc % 60;
  return `${ora}:${String(p).padStart(2, "0")}`;
};

const formatEsemenyTipus = (tipus) => {
  const [kategoria, kod] = String(tipus || "").split("_");
  const label = kategoria === "hiba" ? "Hiba" : "Esemény";
  return kod ? `${label} (kód: ${kod})` : tipus;
};

export default function Tachograf() {
  const user = JSON.parse(localStorage.getItem("user"));
  const history = useHistory();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const kezdoSoforId = query.get("sofor");

  const [aktivFul, setAktivFul] = useState(kezdoSoforId ? "soforok" : "attekintes");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [reszletModalNap, setReszletModalNap] = useState(null);
  // A sofőr-részletek modalt a modul gyökere birtokolja (nem a Sofőrök fül),
  // hogy az Áttekintés fülről (megfelelőségi widget) is megnyitható legyen
  // fülváltás nélkül — csak a `?sofor=` mélylinken érkezés vált fület.
  const [nyitottSoforId, setNyitottSoforId] = useState(kezdoSoforId || null);

  const [sorok, setSorok] = useState([]);
  const [esemenyek, setEsemenyek] = useState([]);
  const [megfeleloseg, setMegfeleloseg] = useState([]);
  const [soforAttekintes, setSoforAttekintes] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [loading, setLoading] = useState(true);

  const betoltes = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchAction("getTachografNapiAktivitas", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografEsemenyek", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografMegfeleloseg", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografSoforOsszesito", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
    ])
      .then(([napiResult, esemenyResult, megfelResult, attekintesResult]) => {
        setSorok(napiResult?.success ? napiResult.sorok || [] : []);
        setEsemenyek(esemenyResult?.success ? esemenyResult.sorok || [] : []);
        setMegfeleloseg(megfelResult?.success ? megfelResult.sorok || [] : []);
        setSoforAttekintes(attekintesResult?.success ? attekintesResult.sorok || [] : []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    betoltes();
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betoltes]);

  // Az Áttekintés fül megfelelőségi widgetjéből induló kattintás a modalt
  // nyitja meg AZONNAL, a jelenlegi fülön maradva — nincs fülváltás, nincs
  // URL-módosítás (az csak a külső mélylink-belépésnél, ld. lentebb).
  const megySoforre = (soforId) => {
    setNyitottSoforId(soforId);
  };

  const soforNev = (id) => soforAttekintes.find((s) => String(s.sofor_id) === String(id))?.nev;

  const bezarSoforDrawer = () => {
    setNyitottSoforId(null);
    if (kezdoSoforId) history.replace("/admin/tachograf");
  };

  useEffect(() => {
    if (kezdoSoforId) {
      setAktivFul("soforok");
      setNyitottSoforId(kezdoSoforId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kezdoSoforId]);

  const hetKm = sorok
    .filter((s) => {
      const napja = new Date(s.datum);
      const most = new Date();
      const diffNapok = (most - napja) / (1000 * 60 * 60 * 24);
      return diffNapok >= 0 && diffNapok < 7;
    })
    .reduce((sum, s) => sum + (s.tavolsag_km || 0), 0);
  const tulOraSzam = sorok.filter((s) => s.vezetes_perc > 9 * 60).length;
  const lefedettSoforSzam = soforAttekintes.filter((s) => s.vanAdat).length;

  const naploColumns = [
    { key: "datum", label: "Dátum", sortable: true },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "tavolsag_km", label: "Táv", sortable: true, render: (row) => (row.tavolsag_km != null ? `${row.tavolsag_km} km` : "—") },
    { key: "vezetes_perc", label: "Vezetés", sortable: true, render: (row) => percToOraPerc(row.vezetes_perc) },
    { key: "munka_perc", label: "Munka", render: (row) => percToOraPerc(row.munka_perc), mobileHidden: true },
    { key: "piheno_perc", label: "Pihenő", render: (row) => percToOraPerc(row.piheno_perc), mobileHidden: true },
    {
      key: "jarmuvek_json",
      label: "Jármű",
      render: (row) => (row.jarmuvek_json || []).map((j) => j.rendszam).join(", ") || "—",
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiEyeLight />} onClick={() => setReszletModalNap(row)} title="Napi részletek" />
        </div>
      ),
    },
  ];

  const esemenyColumns = [
    { key: "kezdet", label: "Kezdet" },
    { key: "veg", label: "Vég", render: (row) => row.veg || "—" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "rendszam", label: "Rendszám", render: (row) => row.rendszam || "—" },
    { key: "tipus", label: "Típus", render: (row) => formatEsemenyTipus(row.tipus) },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
      <div className="flex-shrink-0">
        <PageHeader
          eyebrow="Csapat"
          title="Tachográf"
          action={
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              <PiUploadLight className="h-4 w-4" />
              Import
            </button>
          }
        />
      </div>

      <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-ink-100 dark:border-ink-800">
        {FULEK.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setAktivFul(f.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
              aktivFul === f.key
                ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-ink-400 hover:text-ink-600 dark:text-ink-500 dark:hover:text-ink-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {aktivFul === "attekintes" && (
        <>
          <div className="grid flex-shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CardStats statSubtitle="Vezetett km (elmúlt 7 nap)" statTitle={`${hetKm.toLocaleString("hu-HU")} km`} statIcon={PiRoadHorizonLight} tone="brand" layout="row" />
            <CardStats statSubtitle="Rögzített napok száma" statTitle={sorok.length} statIcon={PiIdentificationCardLight} tone="neutral" layout="row" />
            <CardStats statSubtitle="Sofőr lefedettség" statTitle={`${lefedettSoforSzam}/${soforAttekintes.length}`} statIcon={PiUsersLight} tone="neutral" layout="row" />
            <CardStats
              statSubtitle="Napok 9 óra feletti vezetéssel"
              statCaption="Napi 9 óra (EU 561/2006) — nyers küszöbérték, nem jogi minősítés"
              statTitle={tulOraSzam}
              statIcon={PiWarningCircleLight}
              tone={tulOraSzam > 0 ? "warning" : "neutral"}
              layout="row"
            />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900 xl:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-brand-900 dark:text-ink-50">
                <PiClockCountdownLight className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                Kártya-letöltés esedékessége
              </h3>
              <MegfelelosegiWidget sorok={megfeleloseg} onSoforClick={megySoforre} />
            </div>
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900">
              <h3 className="mb-3 font-display text-base font-semibold text-brand-900 dark:text-ink-50">Vezetési idő, elmúlt 4 hét</h3>
              <Heatmap sorok={sorok} napokSzama={28} />
            </div>
          </div>
        </>
      )}

      {aktivFul === "soforok" && (
        <div className="min-h-0 flex-1">
          <SoforokLista
            soforAttekintes={soforAttekintes}
            loading={loading}
            soforok={soforok}
            onSoforClick={setNyitottSoforId}
          />
        </div>
      )}

      {aktivFul === "naplo" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1">
            <DataTable
              icon={PiIdentificationCardLight}
              title="Napi vezetési/pihenő idő"
              columns={naploColumns}
              rows={sorok}
              loading={loading}
              exportFilename="tachograf-napi-aktivitas"
              mobileTitleKey="datum"
              emptyLabel="Nincs még importált tachográf-adat"
              fill
              searchable
              searchPlaceholder="Keresés dátum vagy sofőr szerint..."
            />
          </div>
          {esemenyek.length > 0 && (
            <div className="flex-shrink-0">
              <DataTable
                icon={PiWarningCircleLight}
                title="Rögzített események / hibák"
                columns={esemenyColumns}
                rows={esemenyek}
                loading={false}
                exportFilename="tachograf-esemenyek"
                mobileTitleKey="tipus"
                emptyLabel="Nincs rögzített esemény vagy hiba"
              />
            </div>
          )}
        </div>
      )}

      {aktivFul === "import" && (
        <div className="min-h-0 flex-1">
          <ImportElozmenyek />
        </div>
      )}

      <ImportWizard open={importModalOpen} onClose={() => setImportModalOpen(false)} soforok={soforok} onApplied={betoltes} />

      <SoforDrawer soforId={nyitottSoforId} soforNev={soforNev(nyitottSoforId)} soforok={soforok} onClose={bezarSoforDrawer} />

      <Modal open={!!reszletModalNap} onClose={() => setReszletModalNap(null)} title={reszletModalNap ? `Napi részletek — ${reszletModalNap.datum}` : ""} maxWidth="max-w-lg">
        {reszletModalNap && <NapiIdovonalSav valtozasok={reszletModalNap.aktivitas_json} />}
      </Modal>
    </div>
  );
}
