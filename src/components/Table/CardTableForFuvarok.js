import React from "react";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiClipboardTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusChangePopover from "components/UI/StatusChangePopover.js";
import StatusBadge from "components/UI/StatusBadge.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { formatFuvarDatum } from "utils/formatDatum";

const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};

const CardTable = ({
  fuvarok = [],
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onSearchChange,
  onExportAll,
  sortKey,
  sortDir,
  onSortChange,
  onAllapotValtozott,
  initialSearch,
}) => {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

  const valtAllapotot = async (id, ujAllapot) => {
    const result = await fetchAction("updateFuvarAllapot", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      id,
      allapot: ujAllapot,
    });
    if (result?.success) {
      onAllapotValtozott?.();
    } else {
      toast.error(result?.message || "Az állapot módosítása sikertelen.");
    }
  };

  // Nincs Számlázz.hu API-integráció — az admin saját maga állítja ki a
  // számlát a Számlázz.hu felületén, ez a tömeges művelet csak a szám
  // UTÓLAGOS, kézi rögzítését végzi egyszerre több (azonos számlához
  // tartozó) fuvarra. `window.prompt` ugyanaz a minta, mint a Fájlok
  // modul tömeges címkézésénél.
  const hozzarendelSzamlaszamot = async (rows) => {
    const szamlaszam = window.prompt("Add meg a számlaszámot (minden kijelölt fuvarra ráíródik):");
    if (szamlaszam === null || szamlaszam.trim() === "") {
      return;
    }
    const result = await fetchAction("hozzarendelFuvarSzamlaszamot", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      idk: rows.map((row) => row.id),
      szamlaszam: szamlaszam.trim(),
    });
    if (result?.success) {
      toast.success(`Számlaszám hozzárendelve ${result.darab} fuvarhoz.`);
      onAllapotValtozott?.();
    } else {
      toast.error(result?.message || "A számlaszám hozzárendelése sikertelen.");
    }
  };

  const bulkActions = [
    {
      label: "Számla készítése",
      onClick: hozzarendelSzamlaszamot,
    },
    {
      label: `Állapot: ${ALLAPOT_LABEL.szamlazasra_var}`,
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => valtAllapotot(row.id, "szamlazasra_var")));
      },
    },
    {
      label: `Állapot: ${ALLAPOT_LABEL.teljesitve}`,
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => valtAllapotot(row.id, "teljesitve")));
      },
    },
  ];

  const handleNewFuvar = () => {
    history.push("/admin/fuvarForm", { data: {} });
  };

  const handleEditClick = (fuvar) => {
    history.push("/admin/fuvarForm", { data: fuvar });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteFuvar",
    confirmMessage: "Biztosan törölni szeretnéd a fuvart?",
    successMessage: "A fuvar sikeresen törölve.",
    listPath: "/admin/fuvarok",
    // FONTOS: `deleteFuvar` a backend `getActions()`-ben ['id', 'ceg_id',
    // 'kerelmezo_id']-t vár (eltér a legtöbb más domain `deleteX` action-jétől,
    // pl. `deleteFurgon` csak ['id', 'kerelmezo_id']-t igényel) — `ceg_id`
    // nélkül a `validation()` "Hiányzó paraméter: ceg_id." hibával elszállna.
    extraParams: { kerelmezo_id: user.id, ceg_id: user.ceg_id },
  });

  const jarmuLabel = (row) => row.kamion_rendszam || row.furgon_rendszam || "—";

  const columns = [
    {
      // A Lerakás az elsődleges dátum (ld. RENDEZHETO_OSZLOPOK), a
      // Felrakás csak kiegészítő infó alatta — ez a két korábban külön
      // oszlop most eggyé vonva, hogy kevesebb oszlop-szélesség kelljen
      // (ld. UX-audit: az asztali táblázat 15 oszlopa erősen túlcsordult
      // 1400px-es nézeten is, a Műveletek oszlop görgetés nélkül nem
      // látszott).
      key: "lerakas_datuma",
      label: "Dátum",
      sortable: true,
      render: (row) => {
        const lerakas = formatFuvarDatum(row.lerakas_datuma);
        const felrakas = formatFuvarDatum(row.felrakas_datuma);
        return (
          <div className="leading-tight">
            <p>{lerakas || "—"}</p>
            {felrakas && <p className="text-xs text-ink-400">Felrakás: {felrakas}</p>}
          </div>
        );
      },
    },
    {
      // Felrakó+Lerakó szintén egy oszlopba vonva, ugyanazzal a "Cég A →
      // Cég B" mintával, mint a Kanban-kártya/Sofőr-szerinti nézet —
      // a teljes cím a title tooltipben marad elérhető.
      key: "felrako",
      label: "Útvonal",
      sortable: true,
      render: (row) => {
        if (!row.felrako_ceg && !row.lerako_ceg) {
          return <span className="text-ink-400">Nincs útvonal megadva</span>;
        }
        const teljesCim = [row.felrako_cim, row.lerako_cim].filter(Boolean).join(" → ");
        return (
          <span title={teljesCim}>
            {row.felrako_ceg || "—"} → {row.lerako_ceg || "—"}
          </span>
        );
      },
    },
    { key: "megbizo_nev", label: "Megbízó", render: (row) => row.megbizo_nev || "—" },
    { key: "sofor_nev", label: "Sofőr", render: (row) => row.sofor_nev || "—", mobileHidden: true },
    { key: "jarmu", label: "Jármű", render: jarmuLabel, mobileHidden: true },
    { key: "raklapszam", label: "Raklapszám", render: (row) => row.raklapszam ?? "—", mobileHidden: true },
    {
      key: "tomeg_tonna",
      label: "Tömeg",
      render: (row) => (row.tomeg_tonna != null ? `${Number(row.tomeg_tonna).toLocaleString("hu-HU")} t` : "—"),
      mobileHidden: true,
    },
    {
      key: "dij",
      label: "Díj",
      render: (row) => (row.dij != null ? `${Number(row.dij).toLocaleString("hu-HU")} Ft` : "—"),
    },
    {
      key: "allapot",
      label: "Állapot",
      sortable: true,
      render: (row) => (
        <StatusChangePopover value={row.allapot} onChange={(ujAllapot) => valtAllapotot(row.id, ujAllapot)} />
      ),
    },
    {
      key: "szamlaszam",
      label: "Számlaszám",
      render: (row) => row.szamlaszam || "—",
      mobileHidden: true,
    },
    {
      key: "dokumentum_feltoltve",
      label: "Dokumentum",
      render: (row) =>
        row.dokumentum_feltoltve ? (
          <StatusBadge tone="success">Feltöltve</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Hiányzik</StatusBadge>
        ),
      mobileHidden: true,
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiPencilSimpleLight />} onClick={() => handleEditClick(row)} title="Szerkesztés" />
          <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDelete(row.id)} title="Törlés" />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "lerakas_datuma", label: "Lerakás" },
    { key: "felrakas_datuma", label: "Felrakás" },
    { key: "felrako_ceg", label: "Felrakó cég" },
    { key: "felrako_cim", label: "Felrakó cím" },
    { key: "lerako_ceg", label: "Lerakó cég" },
    { key: "lerako_cim", label: "Lerakó cím" },
    { key: "megbizo_nev", label: "Megbízó" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "raklapszam", label: "Raklapszám" },
    { key: "tomeg_tonna", label: "Tömeg (t)" },
    { key: "dij", label: "Díj" },
    { key: "allapot", label: "Állapot" },
    { key: "szamlaszam", label: "Számlaszám" },
  ];

  return (
    <DataTable
      icon={PiClipboardTextLight}
      title="Fuvarok"
      onAdd={handleNewFuvar}
      exportFilename="fuvarok"
      exportColumns={exportColumns}
      columns={columns}
      rows={fuvarok}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek fuvarok megjelenítve"
      loading={loading}
      searchable
      searchPlaceholder="Keresés felrakó, lerakó, sofőr, rendszám, megbízó szerint..."
      initialSearch={initialSearch}
      serverSide
      totalRows={total}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onSearchChange={onSearchChange}
      onExportAll={onExportAll}
      sortKey={sortKey}
      sortDir={sortDir}
      onSortChange={onSortChange}
      selectable
      bulkActions={bulkActions}
    />
  );
};

export default CardTable;
