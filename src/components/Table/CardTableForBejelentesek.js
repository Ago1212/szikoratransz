import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiNotePencilLight, PiTrashLight, PiChatCircleTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusBadge from "components/UI/StatusBadge.js";

const PRIORITAS_TONE = { alacsony: "neutral", kozepes: "warning", magas: "danger" };
const PRIORITAS_LABEL = { alacsony: "Alacsony", kozepes: "Közepes", magas: "Magas" };

const STATUSZ_TONE = { uj: "info", folyamatban: "warning", lezart: "success" };
const STATUSZ_LABEL = { uj: "Új", folyamatban: "Folyamatban", lezart: "Lezárt" };

export default function CardTable({ bejelentesek, isLoading, selectedKamion }) {
  const history = useHistory();

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
  });

  const columns = [
    { key: "cim", label: "Cím", className: "font-semibold text-brand-900" },
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
    },
    {
      key: "statusz",
      label: "Státusz",
      render: (row) => (
        <StatusBadge tone={STATUSZ_TONE[row.statusz] || "info"}>
          {STATUSZ_LABEL[row.statusz] || "Új"}
        </StatusBadge>
      ),
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

  return (
    <DataTable
      icon={PiChatCircleTextLight}
      title="Bejelentések"
      onAdd={handleNewBejelentes}
      addLabel="Új bejelentés"
      exportFilename="bejelentesek"
      columns={columns}
      rows={bejelentesek}
      loading={isLoading}
      mobileTitleKey="cim"
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek bejelentések megjelenítve"
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

CardTable.defaultProps = {
  bejelentesek: [],
  isLoading: false,
  selectedKamion: "",
};
