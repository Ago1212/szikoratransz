import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiBuildingsLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ ugyfelek = [], loading, total, page, pageSize, onPageChange, onSearchChange, onExportAll, sortKey, sortDir, onSortChange }) => {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

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
    extraParams: { ceg_id: user.ceg_id, kerelmezo_id: user.id },
  });

  const columns = [
    { key: "nev", label: "Név", sortable: true, className: "font-semibold text-brand-900 dark:text-ink-50" },
    { key: "varos", label: "Város", sortable: true },
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

  // Az Excel export a listaoszlopokon felül az adószámot, a teljes cím-
  // bontást, a kapcsolattartó email-címét és a megjegyzést is tartalmazza.
  const exportColumns = [
    { key: "nev", label: "Név" },
    { key: "adoszam", label: "Adószám" },
    { key: "varos", label: "Város" },
    { key: "irsz", label: "Irányítószám" },
    { key: "cim", label: "Cím" },
    { key: "kapcsolattarto_nev", label: "Kapcsolattartó" },
    { key: "kapcsolattarto_telefon", label: "Kapcsolattartó telefon" },
    { key: "kapcsolattarto_email", label: "Kapcsolattartó email" },
    { key: "megjegyzes", label: "Megjegyzés" },
  ];

  return (
    <DataTable
      icon={PiBuildingsLight}
      title="Ügyfelek"
      onAdd={handleNewUgyfel}
      exportFilename="ugyfelek"
      exportColumns={exportColumns}
      columns={columns}
      rows={ugyfelek}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek ügyfelek megjelenítve"
      loading={loading}
      searchable
      searchPlaceholder="Keresés ügyfél, város, kapcsolattartó szerint..."
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
  ugyfelek: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      nev: PropTypes.string.isRequired,
    }),
  ),
};

export default CardTable;
