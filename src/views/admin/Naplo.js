import React, { useState, useEffect, useCallback } from "react";
import { PiListMagnifyingGlassLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const PAGE_SIZE = 20;

const TABLA_LABEL = {
  kamion: "Kamion",
  potkocsi: "Pótkocsi",
  user: "Sofőr",
  bejelentesek: "Bejelentés",
  sofor_szabadsag: "Szabadság",
  ugyfelek: "Ügyfél",
  helyszinek: "Helyszín",
  admin: "Csapattag",
  jogosultsagok: "Jogosultságok",
  szerepkorok: "Szerepkörök",
  listaelemek: "Listaelem",
  egyeb_koltsegek: "Pénzforgalom tétel",
  fuvarok: "Fuvar",
  vezetesi_naplo: "Vezetési napló",
};

const MUVELET_TONE = {
  letrehozas: "success",
  modositas: "warning",
  torles: "danger",
};
const MUVELET_LABEL = {
  letrehozas: "Létrehozás",
  modositas: "Módosítás",
  torles: "Törlés",
};

export default function Naplo() {
  const [naplo, setNaplo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    setLoading(true);
    fetchAction("getAuditLog", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (result?.success) {
          setNaplo(result.naplo || []);
          setTotal(result.total ?? (result.naplo || []).length);
        } else {
          setTotal(0);
        }
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  const handleExportAll = useCallback(async () => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    const result = await fetchAction("getAuditLog", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result?.success ? result.naplo || [] : [];
  }, [search]);

  const columns = [
    {
      key: "tabla",
      label: "Entitás",
      className: "font-semibold text-brand-900",
      render: (row) => TABLA_LABEL[row.tabla] || row.tabla,
      exportValue: (row) => TABLA_LABEL[row.tabla] || row.tabla,
    },
    { key: "rowid", label: "Azonosító" },
    {
      key: "muvelet",
      label: "Művelet",
      render: (row) => (
        <StatusBadge tone={MUVELET_TONE[row.muvelet] || "neutral"}>
          {MUVELET_LABEL[row.muvelet] || row.muvelet}
        </StatusBadge>
      ),
      exportValue: (row) => MUVELET_LABEL[row.muvelet] || row.muvelet,
    },
    { key: "leiras", label: "Leírás", render: (row) => row.leiras || "—" },
    { key: "datum", label: "Időpont" },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
      <div className="flex-shrink-0">
        <PageHeader
          title="Módosítási napló"
          eyebrow="Teljes előzmény, lapozva"
        />
      </div>
      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiListMagnifyingGlassLight}
          title="Napló"
          columns={columns}
          rows={naplo}
          loading={loading}
          exportFilename="naplo"
          mobileTitleKey="tabla"
          emptyLabel="Még nincs naplózott módosítás"
          fill
          searchable
          searchPlaceholder="Keresés entitás, leírás szerint..."
          serverSide
          totalRows={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onSearchChange={setSearch}
          onExportAll={handleExportAll}
        />
      </div>
    </div>
  );
}
