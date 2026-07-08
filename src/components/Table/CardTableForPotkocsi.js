import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import {
  PiPencilSimpleLight,
  PiTrashLight,
  PiTruckTrailerLight,
} from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ potkocsik }) => {
  const history = useHistory();

  const handleNewPotkocsi = () => {
    history.push("/admin/potkocsiForm", { data: {} });
  };

  const handleEditClick = (potkocsi) => {
    history.push("/admin/potkocsiForm", { data: potkocsi });
  };

  const handleDelete = useConfirmDelete({
    action: "deletePotkocsi",
    confirmMessage: "Biztosan törölni szeretnéd a pótkocsit?",
    successMessage: "A pótkocsi sikeresen törölve.",
    listPath: "/admin/potkocsi",
  });

  const columns = [
    { key: "rendszam", label: "Rendszám", className: "font-semibold text-brand-900" },
    { key: "tipus", label: "Típus", render: (row) => row.tipus || "Nincs" },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon
            icon={<PiPencilSimpleLight />}
            onClick={() => handleEditClick(row)}
            title="Szerkesztés"
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
      icon={PiTruckTrailerLight}
      title="Pótkocsik"
      onAdd={handleNewPotkocsi}
      columns={columns}
      rows={potkocsik}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek pótkocsik megjelenítve"
    />
  );
};

CardTable.propTypes = {
  potkocsik: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      rendszam: PropTypes.string.isRequired,
      tipus: PropTypes.string,
    })
  ).isRequired,
};

CardTable.defaultProps = {
  potkocsik: [],
};

export default CardTable;
