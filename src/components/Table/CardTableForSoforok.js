import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiUsersLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";

const CardTable = ({ soforok = [], loading, total, page, pageSize, onPageChange, onSearchChange, onExportAll }) => {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

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
    extraParams: { kerelmezo_id: user.id },
  });

  const columns = [
    { key: "name", label: "Név", className: "font-semibold text-brand-900 dark:text-ink-50" },
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

  // Az Excel export a listaoszlopokon felül a sofőr dokumentumainak lejárati
  // dátumait és a teljes cím-bontást is tartalmazza — ezek a kompakt
  // táblázatban helyhiány miatt nem látszanak, de egy exportnál (pl.
  // lejárat-figyeléshez) pont ezek a leghasznosabbak.
  const exportColumns = [
    { key: "name", label: "Név" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefon" },
    { key: "lakcim", label: "Lakcím" },
    { key: "varos", label: "Város" },
    { key: "irsz", label: "Irányítószám" },
    { key: "cim", label: "Cím" },
    { key: "szul_datum", label: "Születési dátum" },
    { key: "szemelyi", label: "Személyigazolvány szám" },
    { key: "szemelyi_lejarat", label: "Személyi lejárata" },
    { key: "jogsi_lejarat", label: "Jogosítvány lejárata" },
    { key: "gki_lejarat", label: "GKI lejárata" },
    { key: "adr_lejarat", label: "ADR lejárata" },
  ];

  return (
    <DataTable
      icon={PiUsersLight}
      title="Sofőrök"
      onAdd={handleNewSofor}
      exportFilename="soforok"
      exportColumns={exportColumns}
      columns={columns}
      rows={soforok}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek sofőrök megjelenítve"
      loading={loading}
      searchable
      searchPlaceholder="Keresés név, email, telefon szerint..."
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
  soforok: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      phone: PropTypes.string.isRequired,
      lakcim: PropTypes.string.isRequired,
    })
  ),
};

export default CardTable;
