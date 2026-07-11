import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiUsersLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ soforok }) => {
  const history = useHistory();

  const handleNewSofor = () => {
    history.push("/admin/soforForm", { data: {} });
  };

  const handleEditClick = (sofor) => {
    history.push("/admin/soforForm", { data: sofor });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteSofor",
    confirmMessage: "Biztosan törölni szeretnéd a sofőrt?",
    successMessage: "A sofőr sikeresen törölve.",
    listPath: "/admin/soforok",
  });

  const columns = [
    { key: "name", label: "Név", className: "font-semibold text-brand-900" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefon" },
    { key: "lakcim", label: "Lakcím" },
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
      icon={PiUsersLight}
      title="Sofőrök"
      onAdd={handleNewSofor}
      exportFilename="soforok"
      columns={columns}
      rows={soforok}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek sofőrök megjelenítve"
    />
  );
};

CardTable.propTypes = {
  soforok: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      phone: PropTypes.string.isRequired,
      lakcim: PropTypes.string.isRequired,
    })
  ).isRequired,
};

CardTable.defaultProps = {
  soforok: [],
};

export default CardTable;
