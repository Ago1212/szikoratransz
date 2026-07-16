import React, { useState, useEffect, useCallback } from "react";
// components

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForSoforok.js";
import PageHeader from "components/UI/PageHeader.js";

const PAGE_SIZE = 10;

export default function Soforok() {
  const [soforok, setSoforok] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getSoforok", {
        id: user.ceg_id,
        kerelmezo_id: user.id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
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
  }, [page, search]);

  const handleExportAll = useCallback(async () => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    const result = await fetchAction("getSoforok", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result.success ? result.soforok || [] : [];
  }, [search]);

  return (
    <>
      <PageHeader eyebrow="Csapat" title="Sofőrök" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable
            soforok={soforok}
            loading={loading}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onSearchChange={setSearch}
            onExportAll={handleExportAll}
          />
        </div>
      </div>
    </>
  );
}
