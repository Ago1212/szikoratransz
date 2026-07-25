import React from "react";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiClipboardTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusBadge from "components/UI/StatusBadge.js";

const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};

// StatusBadge.js ténylegesen `success`/`warning`/`danger`/`info`/`neutral`
// tónusokat ismer (ld. TONE_CLASSES) — a tervben szereplő `brand`/`positive`
// nevek nem léteznek a komponensben (ismeretlen tónusnál a badge csendben
// `neutral`-ra esne vissza), ezért itt `info` (márka-kék, ld. AllapotBadge.js
// hasonló használata) és `success` váltja őket.
const ALLAPOT_TONE = {
  rogzitett: "neutral",
  szamlazasra_var: "warning",
  szamlazva: "info",
  fizetesre_var: "warning",
  teljesitve: "success",
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
}) => {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

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
      render: (row) => <StatusBadge tone={ALLAPOT_TONE[row.allapot] || "neutral"}>{ALLAPOT_LABEL[row.allapot] || row.allapot}</StatusBadge>,
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
    />
  );
};

export default CardTable;
