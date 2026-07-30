import React, { useEffect, useState } from "react";
import { PiBellLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";

// R12 (fejlesztési audit, 2026-07-19): a haranG (NotificationDropdown) csak
// a JELENLEG élő, még nem dismisselt riasztásokat mutatja — ez az oldal a
// `ertesites_naplo` táblára épülő teljes előzmény (ld. Sidebar.js
// logErtesitesek hívása), egy már dismisselt vagy azóta lezárult ügyre is
// visszakereshető.
//
// Mobil navigáció újratervezés (2026-07-30): a tényleges tartalom kikerült
// egy named exportba, hogy az Elozmenyek.js "Értesítések" füle közvetlenül
// újrafelhasználhassa saját PageHeader/wrapper nélkül — az önálló
// `/admin/ertesitesi-elozmenyek` route (mélylink-kompatibilitás miatt
// megtartva) a lenti default export segítségével ugyanezt csomagolja.
export function ErtesitesiElozmenyekTartalom() {
  const [naplo, setNaplo] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getErtesitesNaplo", { kerelmezo_id: user.id })
      .then((result) => setNaplo(result?.success ? result.naplo || [] : []))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: "letrehozva",
      label: "Időpont",
      render: (row) => new Date(row.letrehozva).toLocaleString("hu-HU"),
      exportValue: (row) => row.letrehozva,
    },
    { key: "szoveg", label: "Értesítés" },
  ];

  return (
    <DataTable
      icon={PiBellLight}
      title="Minden, ami valaha megjelent a haranG-ban"
      columns={columns}
      rows={naplo}
      loading={loading}
      exportFilename="ertesitesi-elozmenyek"
      mobileTitleKey="szoveg"
      emptyLabel="Még nincs naplózott értesítés"
      fill
      searchable
      searchPlaceholder="Keresés az értesítés szövegében..."
      pageSize={20}
    />
  );
}

export default function ErtesitesiElozmenyek() {
  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Rendszer" title="Értesítési előzmények" />
      </div>
      <div className="min-h-0 flex-1">
        <ErtesitesiElozmenyekTartalom />
      </div>
    </div>
  );
}
