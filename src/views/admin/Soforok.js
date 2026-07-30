import React, { useState, useEffect, useCallback } from "react";
import { PiUsersLight, PiChartBarLight } from "react-icons/pi";
// components

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForSoforok.js";
import PageHeader from "components/UI/PageHeader.js";
import { SoforRiportTartalom } from "views/admin/SoforScorecard.js";

const PAGE_SIZE = 10;

// Mobil navigáció újratervezés (2026-07-30): a korábban külön menüpontként
// élő Sofőr-riport (`/admin/sofor-riport`) most egy belső fülként érhető el
// itt is — a fül-váltó ugyanazt a mintát követi, mint a Koltsegek.js. A
// route maga megmaradt (mélylink-kompatibilitás), csak a nav-regisztrációkból
// tűnt el.
const TABS = [
  { key: "lista", label: "Sofőrök", icon: PiUsersLight },
  { key: "riport", label: "Riport", icon: PiChartBarLight },
];

export default function Soforok() {
  const [activeTab, setActiveTab] = useState("lista");
  const [soforok, setSoforok] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("getSoforok", {
        id: user.ceg_id,
        kerelmezo_id: user.id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortKey: sortKey || undefined,
        sortDir,
      });
      if (cancelled) return;
      if (result.success) {
        setSoforok(result.soforok || []);
        setTotal(result.total ?? (result.soforok || []).length);
      } else {
        setSoforok([]);
        setTotal(0);
        console.error("Error fetching stats:", result.message);
      }
      setLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page, search, sortKey, sortDir]);

  const handleSortChange = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleExportAll = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getSoforok", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result.success ? result.soforok || [] : [];
  }, [search]);

  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Csapat" title="Sofőrök" />
        <div className="-mt-2 mb-4 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ${
                activeTab === t.key
                  ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                  : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === "lista" && (
          <CardTable
            fill
            soforok={soforok}
            loading={loading}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onSearchChange={setSearch}
            onExportAll={handleExportAll}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={handleSortChange}
          />
        )}
        {activeTab === "riport" && <SoforRiportTartalom />}
      </div>
    </div>
  );
}
