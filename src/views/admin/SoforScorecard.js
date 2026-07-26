import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { PiChartBarLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

// R08 (fejlesztési audit, 2026-07-19): sofőrönkénti összesítő — eredetileg a
// Pénzforgalom/Tankolás (jármű-szintű fogyasztás), a Flottakövetés/GPSmart-
// cache (jármű-szintű km) és a bejelentés-számok fésülődtek össze
// sofőrönként. A km és az átlagfogyasztás azóta (2026-07-23) a tachográf
// kártya-importra (ld. Tachograf.js) lett átállítva — az közvetlenül a
// sofőrhöz kötött, nem a jelenlegi jármű-hozzárendelésen át (ld.
// ApiHandler::getSoforScorecard() komment) —, a GPSmart-alapú km-oszlop
// pedig megszűnt, hogy két, eltérő forrású km-szám sose keveredjen a
// táblázatban.
const JARMU_LABEL = { kamion: "Kamion", furgon: "Furgon" };

const percToOraPerc = (perc) => `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;

export default function SoforScorecard() {
  const history = useHistory();
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);

  const betoltes = useCallback(() => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getSoforScorecard", { id: user.ceg_id, kerelmezo_id: user.id })
      .then((result) => setSorok(result?.success ? result.soforok || [] : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    betoltes();
  }, [betoltes]);

  // UX-audit — a DataTable már támogatja az opt-in oszloprendezést (ld.
  // Pénzforgalom/Fájlok modul), ez a riport-jellegű oldal viszont korábban
  // egyik oszlopon sem élt vele, pedig pont egy "ki a legjobb/legrosszabb
  // sofőr" nézetnél alapvető elvárás lenne a rendezhetőség.
  const columns = [
    { key: "nev", label: "Sofőr", sortable: true, className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "jarmu_tipus",
      label: "Jármű",
      render: (row) => (row.jarmu_tipus ? JARMU_LABEL[row.jarmu_tipus] : "—"),
      exportValue: (row) => (row.jarmu_tipus ? JARMU_LABEL[row.jarmu_tipus] : "—"),
    },
    {
      key: "tachograf_km_30nap",
      label: "Km (elmúlt 30 nap)",
      sortable: true,
      sortValue: (row) => (row.tachograf_utolso_datum == null ? -1 : row.tachograf_km_30nap || 0),
      // Tachográf kártya-import alapú (sofőrhöz kötött, ld. fenti komment) —
      // "—" ha a sofőrnek még nincs importált tachográf-adata.
      render: (row) =>
        row.tachograf_utolso_datum == null
          ? "—"
          : `${(row.tachograf_km_30nap || 0).toLocaleString("hu-HU")} km`,
      exportValue: (row) =>
        row.tachograf_utolso_datum == null ? "—" : row.tachograf_km_30nap ?? 0,
    },
    {
      key: "fogyasztas_atlag",
      label: "Átlagfogyasztás",
      sortable: true,
      sortValue: (row) => (row.fogyasztas_atlag == null ? -1 : row.fogyasztas_atlag),
      // Ugyanabban a 30 napos ablakban: a sofőr által (tachográf szerint)
      // vezetett km-hez viszonyítva, az általa használt jármű(vek)re
      // vásárolt üzemanyaggal (ld. ApiHandler::getSoforScorecard()) — "—"
      // ha nincs elég adat (nincs tachográf-km VAGY nincs tankolás ugyanarra
      // a járműre ugyanabban az ablakban).
      render: (row) => (row.fogyasztas_atlag == null ? "—" : `${row.fogyasztas_atlag} l/100km`),
      exportValue: (row) => (row.fogyasztas_atlag == null ? "—" : `${row.fogyasztas_atlag} l/100km`),
    },
    {
      key: "bejelentesek",
      label: "Bejelentések",
      sortable: true,
      sortValue: (row) => row.bejelentes_osszes || 0,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.bejelentes_osszes} összesen</span>
          {row.bejelentes_nyitott > 0 && (
            <StatusBadge tone="info">{row.bejelentes_nyitott} nyitott</StatusBadge>
          )}
        </div>
      ),
      exportValue: (row) => `${row.bejelentes_osszes} összesen, ${row.bejelentes_nyitott} nyitott`,
    },
    {
      key: "tachograf",
      label: "Vezetés (elmúlt 7 nap)",
      sortable: true,
      sortValue: (row) => (row.tachograf_utolso_datum == null ? -1 : row.tachograf_vezetes_perc_7nap || 0),
      render: (row) => {
        if (row.tachograf_utolso_datum == null) return "—";
        return (
          <button
            type="button"
            onClick={() => history.push(`/admin/tachograf?sofor=${row.sofor_id}`)}
            className="flex items-center gap-2 hover:underline"
          >
            <span>{percToOraPerc(row.tachograf_vezetes_perc_7nap || 0)} óra</span>
            {row.tachograf_tul_ora_napok > 0 && (
              <StatusBadge tone="warning">{row.tachograf_tul_ora_napok} nap 9ó felett</StatusBadge>
            )}
          </button>
        );
      },
      exportValue: (row) =>
        row.tachograf_utolso_datum == null
          ? "—"
          : `${percToOraPerc(row.tachograf_vezetes_perc_7nap || 0)} óra (utolsó adat: ${row.tachograf_utolso_datum})`,
    },
  ];

  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Csapat" title="Sofőr-riport" />
      </div>
      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiChartBarLight}
          title="Sofőrönkénti összesítő"
          columns={columns}
          rows={sorok}
          loading={loading}
          exportFilename="sofor-riport"
          mobileTitleKey="nev"
          emptyLabel="Nincs megjeleníthető sofőr-adat"
          fill
          searchable
          searchPlaceholder="Keresés név szerint..."
        />
      </div>
    </div>
  );
}
