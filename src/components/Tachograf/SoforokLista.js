import React from "react";
import { PiUsersLight } from "react-icons/pi";

import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const percToOraPerc = (perc) => `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;

// A sofőr-részletek modalt a szülő (`Tachograf.js`) birtokolja, hogy az
// Áttekintés fül megfelelőségi widgetje is meg tudja nyitni fülváltás
// nélkül — ez a komponens csak a listát adja, `onSoforClick`-en jelez.
export default function SoforokLista({ soforAttekintes, loading, onSoforClick }) {
  const columns = [
    { key: "nev", label: "Sofőr", className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "utolsoDatum",
      label: "Utolsó letöltés",
      render: (row) => row.utolsoDatum || "—",
    },
    {
      key: "vezetesPerc7Nap",
      label: "Vezetés (7 nap)",
      render: (row) => (row.vanAdat ? `${percToOraPerc(row.vezetesPerc7Nap)} óra` : "—"),
    },
    {
      key: "km30Nap",
      label: "Km (30 nap)",
      render: (row) => (row.vanAdat ? `${row.km30Nap.toLocaleString("hu-HU")} km` : "—"),
    },
    {
      key: "tulOraNapok",
      label: "Túlórás napok",
      render: (row) => (row.tulOraNapok > 0 ? <StatusBadge tone="warning">{row.tulOraNapok} nap</StatusBadge> : "—"),
    },
  ];

  return (
    <DataTable
      icon={PiUsersLight}
      title="Sofőrönként"
      columns={columns}
      rows={soforAttekintes}
      loading={loading}
      exportFilename="tachograf-soforok"
      mobileTitleKey="nev"
      emptyLabel="Nincs megjeleníthető sofőr"
      fill
      searchable
      searchPlaceholder="Keresés név szerint..."
      onRowDoubleClick={(row) => onSoforClick(row.sofor_id)}
    />
  );
}
