import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiIdentificationCardLight,
  PiUploadLight,
  PiWarningCircleLight,
  PiRoadHorizonLight,
  PiUsersLight,
  PiTruckLight,
  PiClockCountdownLight,
  PiEyeLight,
} from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import CardStats from "components/Cards/CardStats.js";
import Modal from "components/UI/Modal.js";
import MegfelelosegiWidget from "components/Tachograf/MegfelelosegiWidget.js";
import SoforHeatmapLista from "components/Tachograf/SoforHeatmapLista.js";
import SoforokLista from "components/Tachograf/SoforokLista.js";
import SoforDrawer from "components/Tachograf/SoforDrawer.js";
import ImportElozmenyek from "components/Tachograf/ImportElozmenyek.js";
import ImportWizard from "components/Tachograf/ImportWizard.js";
import NapiIdovonalSav from "components/Tachograf/NapiIdovonalSav.js";
import VuMegfelelosegiWidget from "components/Tachograf/VuMegfelelosegiWidget.js";
import JarmuvekLista from "components/Tachograf/JarmuvekLista.js";
import VuImportWizard from "components/Tachograf/VuImportWizard.js";
import VuImportElozmenyek from "components/Tachograf/VuImportElozmenyek.js";

// Tachográf modul — UX-újratervezés (2026-07-24). Két párhuzamos adatforrás
// egy modulon belül, forrás-váltóval (nem külön nav-menüpont, hogy ne
// fragmentálódjon a "vezetési idő/megfelelőség" mentális modell): a
// "Sofőrkártya" (eredeti, driver-kártya .ddd) és a "Jármű-egység" (VU .ddd,
// jármű-központú — km-óraállás, kártya-be/kivétel napló, hosszabb
// visszamenőleges adat). Mindkettő 4, egymást tükröző fület kap
// (Áttekintés/Sofőrök↔Járművek/Napló/Import előzmények). A jármű-egység
// oldal bináris dekódolását NEM PHP végzi, hanem a Go `traconiq/tachoparser`
// binárisa (backend/bin/dddparser, exec()-kel hívva) — ld.
// tachografVuInterface.php fejléc-kommentje.
const SOFOR_FULEK = [
  { key: "attekintes", label: "Áttekintés" },
  { key: "soforok", label: "Sofőrök" },
  { key: "naplo", label: "Napló" },
  { key: "import", label: "Import előzmények" },
];
const JARMU_FULEK = [
  { key: "attekintes", label: "Áttekintés" },
  { key: "jarmuvek", label: "Járművek" },
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

  const [forras, setForras] = useState("sofor"); // "sofor" | "jarmu"
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

  const [vuMegfeleloseg, setVuMegfeleloseg] = useState([]);
  const [jarmuAttekintes, setJarmuAttekintes] = useState([]);
  const [vuLoading, setVuLoading] = useState(true);

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

  const betoltesVu = useCallback(() => {
    setVuLoading(true);
    Promise.all([
      fetchAction("getTachografVuMegfeleloseg", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografVuJarmuOsszesito", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
    ])
      .then(([megfelResult, attekintesResult]) => {
        setVuMegfeleloseg(megfelResult?.success ? megfelResult.sorok || [] : []);
        setJarmuAttekintes(attekintesResult?.success ? attekintesResult.sorok || [] : []);
      })
      .finally(() => setVuLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    betoltes();
    betoltesVu();
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betoltes, betoltesVu]);

  const valtForrast = (uj) => {
    setForras(uj);
    setAktivFul("attekintes");
  };

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
      setForras("sofor");
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
  const lefedettJarmuSzam = jarmuAttekintes.filter((j) => j.vanAdat).length;
  const jarmuVezetesPerc7Nap = jarmuAttekintes.reduce((sum, j) => sum + (j.vezetesPerc7Nap || 0), 0);

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

  const vuNaploColumns = [
    { key: "datum", label: "Dátum", sortable: true },
    { key: "rendszam", label: "Jármű" },
    { key: "km_zaro", label: "Km-óraállás", render: (row) => (row.km_zaro != null ? `${row.km_zaro.toLocaleString("hu-HU")} km` : "—") },
    { key: "vezetes_perc", label: "Vezetés", sortable: true, render: (row) => percToOraPerc(row.vezetes_perc) },
    {
      key: "kartya_referenciak_json",
      label: "Kártya-események",
      render: (row) => `${(row.kartya_referenciak_json || []).length || 0}`,
    },
  ];

  const fulek = forras === "sofor" ? SOFOR_FULEK : JARMU_FULEK;

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

      <div className="flex-shrink-0">
        <div className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
          <button
            type="button"
            onClick={() => valtForrast("sofor")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              forras === "sofor"
                ? "bg-white text-brand-900 shadow-soft dark:bg-ink-900 dark:text-ink-50"
                : "text-ink-400 hover:text-ink-600 dark:text-ink-500"
            }`}
          >
            Sofőrkártya
          </button>
          <button
            type="button"
            onClick={() => valtForrast("jarmu")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              forras === "jarmu"
                ? "bg-white text-brand-900 shadow-soft dark:bg-ink-900 dark:text-ink-50"
                : "text-ink-400 hover:text-ink-600 dark:text-ink-500"
            }`}
          >
            Jármű-egység
          </button>
        </div>
      </div>

      <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-ink-100 dark:border-ink-800">
        {fulek.map((f) => (
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

      {forras === "sofor" && aktivFul === "attekintes" && (
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

          <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900 xl:col-span-3">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-brand-900 dark:text-ink-50">
                <PiClockCountdownLight className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                Kártya-letöltés esedékessége
              </h3>
              <MegfelelosegiWidget sorok={megfeleloseg} onSoforClick={megySoforre} />
            </div>
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900 xl:col-span-2">
              <h3 className="mb-3 font-display text-base font-semibold text-brand-900 dark:text-ink-50">Vezetési idő, elmúlt 4 hét</h3>
              <SoforHeatmapLista soforok={megfeleloseg} napiSorok={sorok} />
            </div>
          </div>
        </>
      )}

      {forras === "sofor" && aktivFul === "soforok" && (
        <div className="min-h-0 flex-1">
          <SoforokLista
            soforAttekintes={soforAttekintes}
            loading={loading}
            soforok={soforok}
            onSoforClick={setNyitottSoforId}
          />
        </div>
      )}

      {forras === "sofor" && aktivFul === "naplo" && (
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

      {forras === "sofor" && aktivFul === "import" && (
        <div className="min-h-0 flex-1">
          <ImportElozmenyek />
        </div>
      )}

      {forras === "jarmu" && aktivFul === "attekintes" && (
        <>
          <div className="grid flex-shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CardStats statSubtitle="Vezetési idő (7 nap, teljes flotta)" statTitle={`${percToOraPerc(jarmuVezetesPerc7Nap)} óra`} statIcon={PiRoadHorizonLight} tone="brand" layout="row" />
            <CardStats statSubtitle="Jármű lefedettség" statTitle={`${lefedettJarmuSzam}/${jarmuAttekintes.length}`} statIcon={PiTruckLight} tone="neutral" layout="row" />
            <CardStats
              statSubtitle="90 napnál régebbi letöltéssel"
              statCaption="EU 165/2014 — jármű-egység memória, nyers küszöbérték"
              statTitle={vuMegfeleloseg.filter((v) => v.statusz === "lejart").length}
              statIcon={PiWarningCircleLight}
              tone={vuMegfeleloseg.some((v) => v.statusz === "lejart") ? "warning" : "neutral"}
              layout="row"
            />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-brand-900 dark:text-ink-50">
                <PiClockCountdownLight className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                Jármű-egység letöltés esedékessége
              </h3>
              <VuMegfelelosegiWidget
                sorok={vuMegfeleloseg}
                onJarmuClick={() => {
                  setAktivFul("jarmuvek");
                }}
              />
            </div>
          </div>
        </>
      )}

      {forras === "jarmu" && aktivFul === "jarmuvek" && (
        <div className="min-h-0 flex-1">
          <JarmuvekLista jarmuAttekintes={jarmuAttekintes} loading={vuLoading} />
        </div>
      )}

      {forras === "jarmu" && aktivFul === "naplo" && (
        <div className="min-h-0 flex-1">
          <VuNaploTablazat columns={vuNaploColumns} />
        </div>
      )}

      {forras === "jarmu" && aktivFul === "import" && (
        <div className="min-h-0 flex-1">
          <VuImportElozmenyek />
        </div>
      )}

      <ImportWizard open={forras === "sofor" && importModalOpen} onClose={() => setImportModalOpen(false)} soforok={soforok} onApplied={betoltes} />
      <VuImportWizard open={forras === "jarmu" && importModalOpen} onClose={() => setImportModalOpen(false)} jarmuAttekintes={jarmuAttekintes} onApplied={betoltesVu} />

      <SoforDrawer soforId={nyitottSoforId} soforNev={soforNev(nyitottSoforId)} soforok={soforok} onClose={bezarSoforDrawer} />

      <Modal open={!!reszletModalNap} onClose={() => setReszletModalNap(null)} title={reszletModalNap ? `Napi részletek — ${reszletModalNap.datum}` : ""} maxWidth="max-w-lg">
        {reszletModalNap && <NapiIdovonalSav valtozasok={reszletModalNap.aktivitas_json} />}
      </Modal>
    </div>
  );
}

// A jármű-egység Napló füle — sofőr-oldali párja a fő komponensben marad
// (a séma egyszerűsége miatt nem indokolt külön fájl), ez a jármű-oldali
// flat táblázat saját, kis wrapper komponense, hogy a fő komponens ne
// duplikálja a betöltő logikát.
function VuNaploTablazat({ columns }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAction("getTachografVuNapiAktivitas", { ceg_id: user.ceg_id, kerelmezo_id: user.id })
      .then((result) => setSorok(result?.success ? result.sorok || [] : []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DataTable
      icon={PiIdentificationCardLight}
      title="Napi km-óraállás/vezetési idő (jármű-egység)"
      columns={columns}
      rows={sorok}
      loading={loading}
      exportFilename="tachograf-vu-napi-aktivitas"
      mobileTitleKey="datum"
      emptyLabel="Nincs még importált jármű-egység adat"
      fill
      searchable
      searchPlaceholder="Keresés dátum vagy rendszám szerint..."
    />
  );
}
