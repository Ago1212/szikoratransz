import React, { useCallback, useEffect, useState } from "react";
import { PiChartBarLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

// R08 (fejlesztési audit, 2026-07-19): sofőrönkénti összesítő — a
// fogyasztás-anomália (Pénzforgalom/Tankolás), az elmúlt 30 nap km-je
// (Flottakövetés/GPSmart-cache) és a bejelentés-számok (Bejelentések) ma
// három külön oldalon élnek; ez a nézet ugyanazt a három, már meglévő
// backend-forrást fésüli össze sofőrönként, új adatgyűjtés nélkül.
const JARMU_LABEL = { kamion: "Kamion", furgon: "Furgon" };

export default function SoforScorecard() {
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

  const columns = [
    { key: "nev", label: "Sofőr", className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "jarmu_tipus",
      label: "Jármű",
      render: (row) => (row.jarmu_tipus ? JARMU_LABEL[row.jarmu_tipus] : "—"),
      exportValue: (row) => (row.jarmu_tipus ? JARMU_LABEL[row.jarmu_tipus] : "—"),
    },
    {
      key: "km_30nap",
      label: "Km (elmúlt 30 nap)",
      render: (row) =>
        row.km_30nap == null ? "—" : `${row.km_30nap.toLocaleString("hu-HU")} km`,
      exportValue: (row) => row.km_30nap ?? "—",
    },
    {
      key: "fogyasztas_atlag",
      label: "Átlagfogyasztás",
      render: (row) => {
        if (row.fogyasztas_atlag == null) return "—";
        return (
          <div className="flex items-center gap-2">
            <span>{row.fogyasztas_atlag} l/100km</span>
            {row.fogyasztas_anomalia_szam > 0 && (
              <StatusBadge tone="warning">
                {row.fogyasztas_anomalia_szam} anomália
              </StatusBadge>
            )}
          </div>
        );
      },
      exportValue: (row) =>
        row.fogyasztas_atlag == null
          ? "—"
          : `${row.fogyasztas_atlag} l/100km (${row.fogyasztas_anomalia_szam} anomália)`,
    },
    {
      key: "bejelentesek",
      label: "Bejelentések",
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
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
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
