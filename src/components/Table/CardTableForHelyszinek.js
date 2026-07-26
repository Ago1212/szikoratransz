import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiMapPinLight, PiChatCircleTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ helyszinek = [], loading, total, page, pageSize, onPageChange, onSearchChange, onExportAll, sortKey, sortDir, onSortChange }) => {
  const history = useHistory();

  const handleNewHelyszin = () => {
    history.push("/admin/helyszinForm", { data: {} });
  };

  const handleEditClick = (helyszin) => {
    history.push("/admin/helyszinForm", { data: helyszin });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteHelyszin",
    // UX-audit — a többi modul egységesen "...szeretnéd A X-t?" mintát követ,
    // ez itt "...szeretnéd EZT A helyszínt?" volt, stiláris kilógás.
    confirmMessage: "Biztosan törölni szeretnéd a helyszínt?",
    successMessage: "A helyszín sikeresen törölve.",
    listPath: "/admin/helyszinek",
  });

  const columns = [
    { key: "nev", label: "Név", sortable: true, className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "megjegyzesek_szama",
      label: "Megjegyzések",
      render: (row) =>
        row.megjegyzesek_szama > 0 ? (
          <span className="inline-flex items-center gap-1 text-ink-500 dark:text-ink-400">
            <PiChatCircleTextLight className="h-3.5 w-3.5 flex-shrink-0" />
            {row.megjegyzesek_szama}
          </span>
        ) : (
          <span className="text-ink-300 dark:text-ink-600">—</span>
        ),
      exportValue: (row) => row.megjegyzesek_szama || 0,
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
      sortKey={sortKey}
      sortDir={sortDir}
      onSortChange={onSortChange}
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
