import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiNotePencilLight, PiTrashLight, PiChatCircleTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

export default function CardTable({ bejelentesek, isLoading }) {
  const history = useHistory();

  const handleNewBejelentes = () => {
    history.push("/admin/bejelentesForm", { data: {} });
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
    { key: "name", label: "Bejelentő", className: "font-semibold text-brand-900" },
    { key: "bejelentve", label: "Bejelentve" },
    { key: "tipus", label: "Típus" },
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
      columns={columns}
      rows={bejelentesek}
      loading={isLoading}
      emptyLabel="Nincsenek bejelentések megjelenítve"
    />
  );
}

CardTable.propTypes = {
  bejelentesek: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      bejelentve: PropTypes.string,
      tipus: PropTypes.string,
    })
  ),
  isLoading: PropTypes.bool,
};

CardTable.defaultProps = {
  bejelentesek: [],
  isLoading: false,
};
