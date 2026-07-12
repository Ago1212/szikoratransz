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

  // Az Excel export bővebb, mint a képernyőn látható táblázat — a
  // kompakt nézetben helyhiány miatt nem szereplő lejárati dátumok és
  // biztosítási adatok is bekerülnek, hiszen egy exportált táblázatnál
  // ezek pont annyira (vagy jobban) érdekesek, mint a listaoszlopok.
  const exportColumns = [
    { key: "rendszam", label: "Rendszám" },
    { key: "tipus", label: "Típus" },
    { key: "meret", label: "Méret" },
    { key: "potkocsi", label: "Pótkocsi" },
    { key: "allapot", label: "Állapot" },
    { key: "aktualis_km", label: "Km óraállás" },
    { key: "muszaki_lejarat", label: "Műszaki vizsga lejárata" },
    { key: "adr_lejarat", label: "ADR lejárat" },
    { key: "taograf_illesztes", label: "Tachográf illesztés" },
    { key: "emelohatfal_vizsga", label: "Emelőhátfal vizsga" },
    { key: "porolto_lejarat", label: "Poroltó #1 lejárat" },
    { key: "porolto_lejarat_2", label: "Poroltó #2 lejárat" },
    { key: "kot_biztositas", label: "Kötelező biztosítás kezdete" },
    { key: "kot_biz_nev", label: "Kötelező biztosító neve" },
    { key: "kot_biz_dij", label: "Kötelező biztosítás éves díja" },
    { key: "kot_biz_utem", label: "Kötelező biztosítás fizetési üteme" },
    { key: "kaszko_biztositas", label: "Kaszkó biztosítás kezdete" },
    { key: "kaszko_nev", label: "Kaszkó biztosító neve" },
    { key: "kaszko_dij", label: "Kaszkó biztosítás éves díja" },
    { key: "kaszko_fizetesi_utem", label: "Kaszkó biztosítás fizetési üteme" },
  ];

  return (
    <DataTable
      icon={PiTruckLight}
      title="Kamionok"
      onAdd={handleNewKamion}
      exportFilename="kamionok"
      exportColumns={exportColumns}
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
