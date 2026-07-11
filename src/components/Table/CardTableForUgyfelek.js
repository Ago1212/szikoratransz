import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiBuildingsLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ ugyfelek }) => {
  const history = useHistory();

  const handleNewUgyfel = () => {
    history.push("/admin/ugyfelForm", { data: {} });
  };

  const handleEditClick = (ugyfel) => {
    history.push("/admin/ugyfelForm", { data: ugyfel });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteUgyfel",
    confirmMessage: "Biztosan törölni szeretnéd az ügyfelet?",
    successMessage: "Az ügyfél sikeresen törölve.",
    listPath: "/admin/ugyfelek",
  });

  const columns = [
    { key: "nev", label: "Név", className: "font-semibold text-brand-900" },
    { key: "varos", label: "Város" },
    { key: "kapcsolattarto_nev", label: "Kapcsolattartó" },
    { key: "kapcsolattarto_telefon", label: "Telefon" },
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
      icon={PiBuildingsLight}
      title="Ügyfelek"
      onAdd={handleNewUgyfel}
      exportFilename="ugyfelek"
      columns={columns}
      rows={ugyfelek}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek ügyfelek megjelenítve"
    />
  );
};

CardTable.propTypes = {
  ugyfelek: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      nev: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

CardTable.defaultProps = {
  ugyfelek: [],
};

export default CardTable;
