import React, { useState, useEffect, useCallback } from "react";
// components

import CardTable from "components/Table/CardTableForPotkocsi";
import { fetchAction } from "utils/fetchAction";

const PAGE_SIZE = 10;

export default function Potkocsi() {
  const [potkocsik, setPotkocsik] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getPotkocsik", {
        id: user.ceg_id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (cancelled) return;
      if (result.success) {
        setPotkocsik(result.potkocsik || []);
        setTotal(result.total ?? (result.potkocsik || []).length);
      } else {
        setPotkocsik([]);
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
    const result = await fetchAction("getPotkocsik", {
      id: user.ceg_id,
      search: search || undefined,
    });
    return result.success ? result.potkocsik || [] : [];
  }, [search]);

  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable
            potkocsik={potkocsik}
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
