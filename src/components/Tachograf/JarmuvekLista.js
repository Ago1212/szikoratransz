import React, { useState } from "react";
import { PiTruckLight } from "react-icons/pi";

import DataTable from "components/UI/DataTable.js";
import JarmuDrawer from "components/Tachograf/JarmuDrawer.js";

const percToOraPerc = (perc) => `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;

export default function JarmuvekLista({ jarmuAttekintes, loading }) {
  const [nyitottJarmu, setNyitottJarmu] = useState(null);

  const columns = [
    { key: "rendszam", label: "Jármű", className: "font-semibold text-brand-900 dark:text-ink-50" },
    { key: "utolsoDatum", label: "Utolsó letöltés", render: (row) => row.utolsoDatum || "—" },
    {
      key: "vezetesPerc7Nap",
      label: "Vezetés (7 nap)",
      render: (row) => (row.vanAdat ? `${percToOraPerc(row.vezetesPerc7Nap)} óra` : "—"),
    },
  ];

  return (
    <>
      <DataTable
        icon={PiTruckLight}
        title="Járművenként"
        columns={columns}
        rows={jarmuAttekintes}
        loading={loading}
        exportFilename="tachograf-vu-jarmuvek"
        mobileTitleKey="rendszam"
        emptyLabel="Nincs megjeleníthető jármű"
        fill
        searchable
        searchPlaceholder="Keresés rendszám szerint..."
        onRowDoubleClick={(row) => setNyitottJarmu(row)}
      />
      {nyitottJarmu && (
        <JarmuDrawer
          jarmuTipus={nyitottJarmu.jarmu_tipus}
          jarmuId={nyitottJarmu.jarmu_id}
          rendszam={nyitottJarmu.rendszam}
          onClose={() => setNyitottJarmu(null)}
        />
      )}
    </>
  );
}
