import React, { useState, useEffect, useCallback } from "react";

// components

import CardTable from "components/Table/CardTableForKamionok.js";
import PageHeader from "components/UI/PageHeader.js";
import { fetchAction } from "utils/fetchAction";

const PAGE_SIZE = 10;

export default function Kamionok() {
  const [kamionok, setKamionok] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  // UX-audit — a DataTable már támogatja az opt-in oszloprendezést, ez a
  // (és a többi CRUD-) lista nem élt vele, pedig a backend fehérlistás
  // ORDER BY-ja készen áll (ld. kamionInterface.php RENDEZHETO_OSZLOPOK).
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("getKamionok", {
        id: user.ceg_id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortKey: sortKey || undefined,
        sortDir,
      });
      if (cancelled) return;
      if (result.success) {
        setKamionok(result.kamionok || []);
        setTotal(result.total ?? (result.kamionok || []).length);
      } else {
        setKamionok([]);
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
    const result = await fetchAction("getKamionok", {
      id: user.ceg_id,
      search: search || undefined,
    });
    return result.success ? result.kamionok || [] : [];
  }, [search]);

  return (
    <>
      <PageHeader eyebrow="Flotta" title="Kamionok" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable
            kamionok={kamionok}
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
        </div>
      </div>
    </>
  );
}
