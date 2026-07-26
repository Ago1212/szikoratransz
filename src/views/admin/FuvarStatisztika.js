import React, { useCallback, useEffect, useState } from "react";
import {
  PiChartBarLight,
  PiTruckLight,
  PiUsersLight,
  PiWarningCircleLight,
  PiArrowsClockwiseLight,
} from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import CardStats from "components/Cards/CardStats.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";
import { fetchAction } from "utils/fetchAction";

const FUVAR_ALLAPOT_OPTIONS = [
  { value: "", label: "Mind" },
  { value: "rogzitett", label: "Rögzítve" },
  { value: "szamlazasra_var", label: "Számlázásra vár" },
  { value: "szamlazva", label: "Számlázva" },
  { value: "fizetesre_var", label: "Fizetésre vár" },
  { value: "teljesitve", label: "Teljesítve" },
];

const DOKUMENTUM_OPTIONS = [
  { value: "", label: "Mind" },
  { value: "van", label: "Van csatolva" },
  { value: "nincs", label: "Hiányzik" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StatisztikaFilterBar({ filter, onPreset, onFieldChange, soforok }) {
  const today = todayIso();
  const hetElso = new Date();
  hetElso.setDate(hetElso.getDate() - hetElso.getDay() + (hetElso.getDay() === 0 ? -6 : 1));
  const hetElejeIso = hetElso.toISOString().slice(0, 10);
  const honapEleje = `${today.slice(0, 7)}-01`;
  const napja30Elott = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const presets = [
    { key: "het", label: "Ez a hét", tol: hetElejeIso, ig: today },
    { key: "honap", label: "Ez a hónap", tol: honapEleje, ig: today },
    { key: "30nap", label: "Elmúlt 30 nap", tol: napja30Elott, ig: today },
  ];
  const activePreset = presets.find((p) => p.tol === filter.datumTol && p.ig === filter.datumIg)?.key;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPreset(p.tol, p.ig)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              activePreset === p.key
                ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => document.getElementById("statisztikaDatumTol")?.focus()}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
            !activePreset ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300" : "text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-100"
          }`}
        >
          Egyedi
        </button>
      </div>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Dátumtól
        <input
          id="statisztikaDatumTol"
          type="date"
          name="datumTol"
          value={filter.datumTol}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        />
      </label>
      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Dátumig
        <input
          type="date"
          name="datumIg"
          value={filter.datumIg}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        />
      </label>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Sofőr
        <select
          name="soforId"
          value={filter.soforId}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          <option value="">Mind</option>
          {soforok.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Fuvar állapota
        <select
          name="fuvarAllapot"
          value={filter.fuvarAllapot}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          {FUVAR_ALLAPOT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Dokumentum
        <select
          name="dokumentumSzuro"
          value={filter.dokumentumSzuro}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          {DOKUMENTUM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const emptyFilter = {
  datumTol: `${todayIso().slice(0, 7)}-01`,
  datumIg: todayIso(),
  soforId: "",
  fuvarAllapot: "",
  dokumentumSzuro: "",
};

export default function FuvarStatisztika() {
  const [filter, setFilter] = useState(emptyFilter);
  const [soforok, setSoforok] = useState([]);
  const [adat, setAdat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [granularitas, setGranularitas] = useState(null); // null = szerver-oldali auto-választás

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getSoforDashboard", {
      ceg_id: user.ceg_id,
      datumTol: filter.datumTol || undefined,
      datumIg: filter.datumIg || undefined,
      soforId: filter.soforId || undefined,
      fuvarAllapot: filter.fuvarAllapot || undefined,
      dokumentumSzuro: filter.dokumentumSzuro || undefined,
      granularitas: granularitas || undefined,
    });
    if (result?.success) {
      setAdat(result);
      if (!granularitas) setGranularitas(result.granularitas);
    }
    setLoading(false);
  }, [filter, granularitas]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handlePreset = (tol, ig) => setFilter((prev) => ({ ...prev, datumTol: tol, datumIg: ig }));
  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };
  const handleRefresh = () => fetchData();

  const osszesito = adat?.osszesito || {};
  const soforonkent = adat?.soforonkent || [];

  const columns = [
    { key: "nev", label: "Sofőr", sortable: true, className: "font-semibold text-brand-900 dark:text-ink-50" },
    { key: "fuvarokSzama", label: "Fuvarok száma", sortable: true },
    { key: "dokumentaltSzama", label: "Dokumentált", sortable: true },
    {
      key: "hianyzoSzama",
      label: "Hiányzó",
      sortable: true,
      render: (row) => (row.hianyzoSzama > 0 ? <StatusBadge tone="warning">{row.hianyzoSzama}</StatusBadge> : "—"),
      exportValue: (row) => row.hianyzoSzama,
    },
    { key: "utolsoFuvarDatuma", label: "Utolsó fuvar", sortable: true, render: (row) => row.utolsoFuvarDatuma || "—" },
    {
      key: "bevetelOsszesen",
      label: "Bevétel",
      sortable: true,
      render: (row) => `${Number(row.bevetelOsszesen).toLocaleString("hu-HU")} Ft`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Fuvarok"
        title="Statisztikák"
        action={
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          >
            <PiArrowsClockwiseLight className="h-4 w-4" />
            Frissítés
          </button>
        }
      />

      <StatisztikaFilterBar filter={filter} onPreset={handlePreset} onFieldChange={handleFieldChange} soforok={soforok} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardStats statSubtitle="Összes fuvar" statTitle={String(osszesito.osszesFuvar ?? "—")} statIcon={PiTruckLight} tone="brand" layout="row" />
        <CardStats statSubtitle="Aktív sofőrök" statTitle={String(osszesito.aktivSoforokSzama ?? "—")} statIcon={PiUsersLight} tone="neutral" layout="row" />
        <CardStats
          statSubtitle="Hiányzó dokumentumok"
          statTitle={String(osszesito.hianyzoDokumentumSzama ?? "—")}
          statIcon={PiWarningCircleLight}
          tone={osszesito.hianyzoDokumentumSzama > 0 ? "warning" : "positive"}
          layout="row"
        />
        <CardStats statSubtitle="Átlag fuvar/sofőr" statTitle={String(osszesito.atlagFuvarSoforonkent ?? "—")} statIcon={PiChartBarLight} tone="neutral" layout="row" />
      </div>

      <div className="mb-4">
        <DataTable
          icon={PiChartBarLight}
          title="Sofőrönkénti bontás"
          columns={columns}
          rows={soforonkent}
          loading={loading}
          exportFilename="sofor-fuvar-statisztika"
          mobileTitleKey="nev"
          emptyLabel="Nincs a szűrésnek megfelelő adat"
        />
      </div>
    </>
  );
}
