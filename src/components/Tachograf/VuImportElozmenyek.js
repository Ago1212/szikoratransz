import React, { useEffect, useState } from "react";
import { PiClockCounterClockwiseLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const FELTOLTO_LABEL = { admin: "Admin", sofor: "Sofőr" };

export default function VuImportElozmenyek() {
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getTachografVuImportNaplo", { ceg_id: user.ceg_id, kerelmezo_id: user.id })
      .then((result) => setSorok(result?.success ? result.sorok || [] : []))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: "letrehozva", label: "Dátum" },
    { key: "fajlnev", label: "Fájl", render: (row) => row.fajlnev || "—" },
    { key: "rendszam", label: "Jármű" },
    {
      key: "feltolto_nev",
      label: "Feltöltötte",
      render: (row) => (row.feltolto_nev ? `${row.feltolto_nev} (${FELTOLTO_LABEL[row.feltolto_tipus] || row.feltolto_tipus})` : "Ismeretlen"),
    },
    {
      key: "uj_nap",
      label: "Eredmény",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone="success">{row.uj_nap} új nap</StatusBadge>
          {row.kihagyott_nap > 0 && <StatusBadge tone="neutral">{row.kihagyott_nap} kihagyva</StatusBadge>}
        </div>
      ),
      exportValue: (row) => `${row.uj_nap} új, ${row.kihagyott_nap} kihagyva`,
    },
  ];

  return (
    <DataTable
      icon={PiClockCounterClockwiseLight}
      title="Jármű-egység import előzmények"
      columns={columns}
      rows={sorok}
      loading={loading}
      exportFilename="tachograf-vu-import-elozmenyek"
      mobileTitleKey="fajlnev"
      emptyLabel="Még nem volt jármű-egység import"
      fill
      searchable
      searchPlaceholder="Keresés fájlnév vagy rendszám szerint..."
    />
  );
}
