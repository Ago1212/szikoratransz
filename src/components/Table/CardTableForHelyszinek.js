import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiMapPinLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ helyszinek = [], loading, total, page, pageSize, onPageChange, onSearchChange, onExportAll }) => {
  const history = useHistory();

  const handleNewHelyszin = () => {
    history.push("/admin/helyszinForm", { data: {} });
  };

  const handleEditClick = (helyszin) => {
    history.push("/admin/helyszinForm", { data: helyszin });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteHelyszin",
    confirmMessage: "Biztosan törölni szeretnéd ezt a helyszínt?",
    successMessage: "A helyszín sikeresen törölve.",
    listPath: "/admin/helyszinek",
  });

  const columns = [
    { key: "nev", label: "Név", className: "font-semibold text-brand-900 dark:text-ink-50" },
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
      icon={PiMapPinLight}
      title="Helyszínek"
      onAdd={handleNewHelyszin}
      exportFilename="helyszinek"
      columns={columns}
      rows={helyszinek}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek helyszínek megjelenítve"
      loading={loading}
      searchable
      searchPlaceholder="Keresés név szerint..."
      serverSide
      totalRows={total}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onSearchChange={onSearchChange}
      onExportAll={onExportAll}
    />
  );
};

CardTable.propTypes = {
  helyszinek: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      nev: PropTypes.string.isRequired,
    }),
  ),
};

export default CardTable;
