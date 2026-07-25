import React from "react";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiClipboardTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusChangePopover from "components/UI/StatusChangePopover.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

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
    { key: "teljesites_datuma", label: "Teljesítés", sortable: true, render: (row) => row.teljesites_datuma || "—" },
    { key: "felrako", label: "Felrakó", sortable: true, render: (row) => row.felrako || "—" },
    { key: "lerako", label: "Lerakó", sortable: true, render: (row) => row.lerako || "—" },
    { key: "megbizo_nev", label: "Megbízó", render: (row) => row.megbizo_nev || "—" },
    { key: "sofor_nev", label: "Sofőr", render: (row) => row.sofor_nev || "—", mobileHidden: true },
    { key: "jarmu", label: "Jármű", render: jarmuLabel, mobileHidden: true },
    {
      key: "osszesen",
      label: "Összesen",
      render: (row) => (row.osszesen != null ? `${Number(row.osszesen).toLocaleString("hu-HU")} Ft` : "—"),
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
    { key: "teljesites_datuma", label: "Teljesítés" },
    { key: "felrako", label: "Felrakó" },
    { key: "lerako", label: "Lerakó" },
    { key: "megbizo_nev", label: "Megbízó" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "fuvardij", label: "Fuvardíj" },
    { key: "egyeb_koltseg", label: "Egyéb költség" },
    { key: "osszesen", label: "Összesen" },
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
