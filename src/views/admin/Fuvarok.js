import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";

import CardTable from "components/Table/CardTableForFuvarok.js";
import PageHeader from "components/UI/PageHeader.js";
import { fetchAction } from "utils/fetchAction";

const PAGE_SIZE = 10;

export default function Fuvarok() {
  const history = useHistory();
  const [fuvarok, setFuvarok] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [dokSzam, setDokSzam] = useState(0);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getBeerkezettDokumentumokSzama", { ceg_id: user.ceg_id }).then((result) => {
      if (result?.success) setDokSzam(result.szam);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("getFuvarok", {
        ceg_id: user.ceg_id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortKey: sortKey || undefined,
        sortDir,
      });
      if (cancelled) return;
      if (result.success) {
        setFuvarok(result.fuvarok || []);
        setTotal(result.total ?? (result.fuvarok || []).length);
      } else {
        setFuvarok([]);
        setTotal(0);
        console.error("Error fetching fuvarok:", result.message);
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
    const result = await fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      search: search || undefined,
    });
    return result.success ? result.fuvarok || [] : [];
  }, [search]);

  return (
    <>
      <PageHeader
        eyebrow="Fuvarok"
        title="Fuvarok"
        action={
          dokSzam > 0 && (
            <button
              type="button"
              onClick={() => history.push("/admin/beerkezettDokumentumok")}
              className="rounded-full bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {dokSzam} dokumentum feldolgozásra vár →
            </button>
          )
        }
      />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable
            fuvarok={fuvarok}
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
