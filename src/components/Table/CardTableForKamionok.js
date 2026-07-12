import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiTruckLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import AllapotBadge from "components/UI/AllapotBadge.js";

const CardTable = ({ kamionok }) => {
  const history = useHistory();
  const user = JSON.parse(sessionStorage.getItem("user"));

  const handleNewKamion = () => {
    history.push("/admin/kamionForm", { data: {} });
  };

  const handleEditClick = (kamion) => {
    history.push("/admin/kamionForm", { data: kamion });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteKamion",
    confirmMessage: "Biztosan törölni szeretnéd a kamiont?",
    successMessage: "A kamion sikeresen törölve.",
    listPath: "/admin/kamionok",
    extraParams: { kerelmezo_id: user.id },
  });

  const columns = [
    { key: "rendszam", label: "Rendszám", className: "font-semibold text-brand-900" },
    { key: "tipus", label: "Típus", render: (row) => row.tipus || "Nincs" },
    { key: "meret", label: "Méret", render: (row) => row.meret || "Nincs" },
    { key: "potkocsi", label: "Pótkocsi", render: (row) => row.potkocsi || "Nincs" },
    {
      key: "allapot",
      label: "Állapot",
      render: (row) => <AllapotBadge allapot={row.allapot} />,
    },
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
      icon={PiTruckLight}
      title="Kamionok"
      onAdd={handleNewKamion}
      exportFilename="kamionok"
      columns={columns}
      rows={kamionok}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek kamionok megjelenítve"
    />
  );
};

CardTable.propTypes = {
  kamionok: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      rendszam: PropTypes.string.isRequired,
      tipus: PropTypes.string,
      meret: PropTypes.string,
      potkocsi: PropTypes.string,
    })
  ).isRequired,
};

CardTable.defaultProps = {
  kamionok: [],
};

export default CardTable;
