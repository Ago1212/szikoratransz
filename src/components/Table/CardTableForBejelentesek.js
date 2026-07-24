import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiNotePencilLight, PiTrashLight, PiChatCircleTextLight, PiChatDotsFill } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusBadge from "components/UI/StatusBadge.js";

const PRIORITAS_TONE = { alacsony: "neutral", kozepes: "warning", magas: "danger" };
const PRIORITAS_LABEL = { alacsony: "Alacsony", kozepes: "Közepes", magas: "Magas" };

const STATUSZ_TONE = { uj: "info", folyamatban: "warning", lezart: "success" };
const STATUSZ_LABEL = { uj: "Új", folyamatban: "Folyamatban", lezart: "Lezárt" };

export default function CardTable({ bejelentesek = [], isLoading = false, selectedKamion = "", total, page, pageSize, onPageChange, onSearchChange, onExportAll }) {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

  const handleNewBejelentes = () => {
    history.push("/admin/bejelentesForm", { data: { kamion_id: selectedKamion || "" } });
  };
  const handleEditClick = (bejelentes) => {
    history.push("/admin/bejelentesForm", { data: bejelentes });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteBejelentes",
    confirmMessage: "Biztosan törölni szeretnéd a bejelentést?",
    successMessage: "A bejelentés sikeresen törölve.",
    listPath: "/admin/bejelentesek",
    extraParams: { kerelmezo_id: user.id },
  });

  const columns = [
    {
      key: "cim",
      label: "Cím",
      className: "font-semibold text-brand-900 dark:text-ink-50",
      // UX-audit — korábban semmi nem jelezte a listában, melyik
      // bejelentésnek van új, admin által még nem megválaszolt sofőr-
      // üzenete; az admin csak úgy tudta meg, ha egyenként megnyitotta és
      // legörgetett mindegyiket az "Üzenetek" szekcióig.
      render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {row.cim}
          {row.van_olvasatlan_uzenet && (
            <span
              className="flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300"
              title={`${row.uzenet_szam} üzenet — a sofőr utolsó üzenetére még nem érkezett válasz`}
            >
              <PiChatDotsFill className="h-3 w-3" />
              Új üzenet
            </span>
          )}
        </span>
      ),
    },
    { key: "kamion_rendszam", label: "Rendszám", render: (row) => row.kamion_rendszam || "—" },
    { key: "sofor_nev", label: "Bejelentő", render: (row) => row.sofor_nev || "Ismeretlen" },
    { key: "bejelentve", label: "Bejelentve" },
    {
      key: "prioritas",
      label: "Prioritás",
      render: (row) => (
        <StatusBadge tone={PRIORITAS_TONE[row.prioritas] || "warning"}>
          {PRIORITAS_LABEL[row.prioritas] || "Közepes"}
        </StatusBadge>
      ),
      exportValue: (row) => PRIORITAS_LABEL[row.prioritas] || "Közepes",
    },
    {
      key: "statusz",
      label: "Státusz",
      render: (row) => (
        <StatusBadge tone={STATUSZ_TONE[row.statusz] || "info"}>
          {STATUSZ_LABEL[row.statusz] || "Új"}
        </StatusBadge>
      ),
      exportValue: (row) => STATUSZ_LABEL[row.statusz] || "Új",
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon
            icon={<PiNotePencilLight />}
            onClick={() => handleEditClick(row)}
            title="Megnyitás"
          />
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleDelete(row.id)}
            title="Törlés"
          />
        </div>
      ),
    },
  ];

  // Az Excel export a listaoszlopokon felül a bejelentés típusát és a
  // teljes leírását is tartalmazza, amik a kompakt táblázatban nem
  // látszanak.
  const exportColumns = [
    { key: "cim", label: "Cím" },
    { key: "kamion_rendszam", label: "Rendszám" },
    { key: "sofor_nev", label: "Bejelentő", exportValue: (row) => row.sofor_nev || "Ismeretlen" },
    { key: "tipus", label: "Típus" },
    { key: "leiras", label: "Leírás" },
    { key: "bejelentve", label: "Bejelentve" },
    {
      key: "prioritas",
      label: "Prioritás",
      exportValue: (row) => PRIORITAS_LABEL[row.prioritas] || "Közepes",
    },
    {
      key: "statusz",
      label: "Státusz",
      exportValue: (row) => STATUSZ_LABEL[row.statusz] || "Új",
    },
  ];

  return (
    <DataTable
      icon={PiChatCircleTextLight}
      title="Bejelentések"
      onAdd={handleNewBejelentes}
      addLabel="Új bejelentés"
      exportFilename="bejelentesek"
      exportColumns={exportColumns}
      columns={columns}
      rows={bejelentesek}
      loading={isLoading}
      mobileTitleKey="cim"
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek bejelentések megjelenítve"
      searchable
      searchPlaceholder="Keresés cím, rendszám, bejelentő szerint..."
      serverSide
      totalRows={total}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onSearchChange={onSearchChange}
      onExportAll={onExportAll}
    />
  );
}

CardTable.propTypes = {
  bejelentesek: PropTypes.arrayOf(
    PropTypes.shape({
      cim: PropTypes.string,
      bejelentve: PropTypes.string,
      prioritas: PropTypes.string,
      statusz: PropTypes.string,
    })
  ),
  isLoading: PropTypes.bool,
  selectedKamion: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
