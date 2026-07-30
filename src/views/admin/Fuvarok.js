import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { PiListLight, PiKanbanLight, PiUsersLight, PiChartBarLight } from "react-icons/pi";

import CardTable from "components/Table/CardTableForFuvarok.js";
import PageHeader from "components/UI/PageHeader.js";
import AllapotOsszesitoChips from "components/Fuvarok/AllapotOsszesitoChips.js";
import KanbanBoard from "components/Fuvarok/KanbanBoard.js";
import SoforCsoportositottLista from "components/Fuvarok/SoforCsoportositottLista.js";
import StatisztikaDashboard from "components/Fuvarok/StatisztikaDashboard.js";
import FigyelmeztetesSav from "components/Fuvarok/FigyelmeztetesSav.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

const PAGE_SIZE = 10;

export default function Fuvarok() {
  const history = useHistory();
  const [fuvarok, setFuvarok] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  // Alapértelmezetten dátum szerint csökkenő sorrend (legutóbbi fuvar
  // legfelül) — ugyanaz a rendezés, mint amit a backend `getFuvarok()`
  // saját maga is választana `sortKey` hiányában, csak itt explicit,
  // hogy a táblázat fejlécének rendezés-jelzése is helyesen mutassa.
  const [sortKey, setSortKey] = useState("lerakas_datuma");
  const [sortDir, setSortDir] = useState("desc");
  const [allapotSzuro, setAllapotSzuro] = useState("");
  const [osszesito, setOsszesito] = useState(null);
  const [nezetMod, setNezetMod] = useState("tablazat");
  const [figyelmeztetesek, setFigyelmeztetesek] = useState(null);
  const [keresPreset, setKeresPreset] = useState("");

  const loadOsszesito = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getFuvarAllapotOsszesito", { ceg_id: user.ceg_id });
    if (result?.success) setOsszesito(result.osszesito);
  }, []);

  useEffect(() => {
    loadOsszesito();
  }, [loadOsszesito]);

  const loadFigyelmeztetesek = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getFuvarFigyelmeztetesek", { ceg_id: user.ceg_id });
    if (result?.success) {
      setFigyelmeztetesek({ lejartFizetes: result.lejartFizetes, szamlazasraVar: result.szamlazasraVar });
    }
  }, []);

  useEffect(() => {
    loadFigyelmeztetesek();
  }, [loadFigyelmeztetesek]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortKey: sortKey || undefined,
      sortDir,
      allapot: allapotSzuro || undefined,
    });
    if (result.success) {
      setFuvarok(result.fuvarok || []);
      setTotal(result.total ?? (result.fuvarok || []).length);
    } else {
      setFuvarok([]);
      setTotal(0);
      console.error("Error fetching fuvarok:", result.message);
    }
    setLoading(false);
  }, [page, search, sortKey, sortDir, allapotSzuro]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSortChange = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleKanbanAllapotChange = async (fuvarId, ujAllapot) => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("updateFuvarAllapot", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      id: fuvarId,
      allapot: ujAllapot,
    });
    if (result?.success) {
      fetchData();
      loadOsszesito();
      loadFigyelmeztetesek();
    } else {
      toast.error(result?.message || "Az állapot módosítása sikertelen.");
    }
  };

  const handleFigyelmeztetesMegnyitas = (utvonal) => {
    setAllapotSzuro("");
    setNezetMod("tablazat");
    setKeresPreset(utvonal);
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
      <PageHeader eyebrow="Fuvarok" title="Fuvarok" />
      <FigyelmeztetesSav figyelmeztetesek={figyelmeztetesek} onMegnyitas={handleFigyelmeztetesMegnyitas} />
      <AllapotOsszesitoChips
        osszesito={osszesito}
        active={allapotSzuro}
        onSelect={(v) => {
          setAllapotSzuro(v);
          setPage(1);
        }}
      />
      <div className="mb-3 flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setNezetMod("tablazat")}
          className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
            nezetMod === "tablazat" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          }`}
        >
          <PiListLight className="h-4 w-4" /> Táblázat
        </button>
        <button
          type="button"
          onClick={() => setNezetMod("kanban")}
          className={`hidden min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide md:flex ${
            nezetMod === "kanban" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          }`}
        >
          <PiKanbanLight className="h-4 w-4" /> Kanban
        </button>
        <button
          type="button"
          onClick={() => setNezetMod("sofor")}
          className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
            nezetMod === "sofor" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          }`}
        >
          <PiUsersLight className="h-4 w-4" /> Sofőr szerint
        </button>
        <button
          type="button"
          onClick={() => setNezetMod("statisztika")}
          className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
            nezetMod === "statisztika" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          }`}
        >
          <PiChartBarLight className="h-4 w-4" /> Statisztikák
        </button>
      </div>

      {nezetMod === "kanban" ? (
        <KanbanBoard
          fuvarok={fuvarok}
          onAllapotChange={handleKanbanAllapotChange}
          onFuvarClick={(fuvar) => history.push("/admin/fuvarForm", { data: fuvar })}
        />
      ) : nezetMod === "sofor" ? (
        <SoforCsoportositottLista />
      ) : nezetMod === "statisztika" ? (
        <StatisztikaDashboard />
      ) : (
        <div className="flex flex-wrap mt-0">
          <div className="w-full mb-12 px-0 md:px-4">
            <CardTable
              key={keresPreset}
              fuvarok={fuvarok}
              loading={loading}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onSearchChange={setSearch}
              initialSearch={keresPreset}
              onExportAll={handleExportAll}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              onAllapotValtozott={() => {
                fetchData();
                loadOsszesito();
                loadFigyelmeztetesek();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
