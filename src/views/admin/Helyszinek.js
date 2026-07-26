import React, { useState, useEffect, useCallback } from "react";

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForHelyszinek.js";
import PageHeader from "components/UI/PageHeader.js";

const PAGE_SIZE = 10;

export default function Helyszinek() {
  const [helyszinek, setHelyszinek] = useState([]);
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
      const result = await fetchAction("getHelyszinek", {
        id: user.ceg_id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortKey: sortKey || undefined,
        sortDir,
      });
      if (cancelled) return;
      if (result.success) {
        setHelyszinek(result.helyszinek || []);
        setTotal(result.total ?? (result.helyszinek || []).length);
      } else {
        setHelyszinek([]);
        setTotal(0);
        console.error("Error fetching helyszinek:", result.message);
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
    const result = await fetchAction("getHelyszinek", {
      id: user.ceg_id,
      search: search || undefined,
    });
    return result.success ? result.helyszinek || [] : [];
  }, [search]);

  return (
    <>
      <PageHeader eyebrow="Partnerek" title="Helyszínek" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable
            helyszinek={helyszinek}
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
