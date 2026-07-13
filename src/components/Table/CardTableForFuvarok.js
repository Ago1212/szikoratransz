import React from "react";
import PropTypes from "prop-types";
import {
  PiPencilSimpleLight,
  PiTrashLight,
  PiPackageLight,
  PiPlayLight,
  PiFlagCheckeredLight,
} from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const STATUSZ_TONE = { tervezett: "neutral", folyamatban: "info", lezart: "success", storno: "danger" };
const STATUSZ_LABEL = { tervezett: "Tervezett", folyamatban: "Folyamatban", lezart: "Lezárt", storno: "Sztornó" };

const formatHuf = (value, devizanem) =>
  value
    ? new Intl.NumberFormat("hu-HU", {
        style: "currency",
        currency: devizanem || "HUF",
        maximumFractionDigits: 0,
      }).format(value)
    : "—";

export default function CardTableForFuvarok({ fuvarok, onAdd, onEdit, onDelete, onStatuszValt }) {
  const columns = [
    {
      key: "felrakas_cim",
      label: "Felrakás",
      className: "font-semibold text-brand-900",
      render: (row) => (
        <div>
          <p>{row.felrakas_cim}</p>
          {row.felrakas_datum && <p className="text-xs font-normal text-ink-400">{row.felrakas_datum}</p>}
        </div>
      ),
    },
    {
      key: "lerakas_cim",
      label: "Lerakás",
      render: (row) => (
        <div>
          <p>{row.lerakas_cim}</p>
          {row.lerakas_datum && <p className="text-xs text-ink-400">{row.lerakas_datum}</p>}
        </div>
      ),
    },
    {
      key: "kamion_rendszam",
      label: "Jármű",
      render: (row) => row.kamion_rendszam || row.potkocsi_rendszam || "—",
    },
    { key: "ugyfel_nev", label: "Ügyfél", render: (row) => row.ugyfel_nev || "—" },
    { key: "sofor_nev", label: "Sofőr", render: (row) => row.sofor_nev || "—" },
    { key: "dij", label: "Díj", render: (row) => formatHuf(row.dij, row.devizanem) },
    {
      key: "statusz",
      label: "Státusz",
      render: (row) => (
        <StatusBadge tone={STATUSZ_TONE[row.statusz] || "neutral"}>
          {STATUSZ_LABEL[row.statusz] || row.statusz}
        </StatusBadge>
      ),
      exportValue: (row) => STATUSZ_LABEL[row.statusz] || row.statusz,
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.statusz === "tervezett" && (
            <ActionIcon
              icon={<PiPlayLight />}
              onClick={() => onStatuszValt(row.id, "folyamatban")}
              title="Indítás"
            />
          )}
          {row.statusz === "folyamatban" && (
            <ActionIcon
              icon={<PiFlagCheckeredLight />}
              onClick={() => onStatuszValt(row.id, "lezart")}
              title="Lezárás"
            />
          )}
          <ActionIcon icon={<PiPencilSimpleLight />} onClick={() => onEdit(row)} title="Szerkesztés" />
          <ActionIcon icon={<PiTrashLight />} danger onClick={() => onDelete(row.id)} title="Törlés" />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "felrakas_cim", label: "Felrakás címe" },
    { key: "felrakas_datum", label: "Felrakás dátuma" },
    { key: "lerakas_cim", label: "Lerakás címe" },
    { key: "lerakas_datum", label: "Lerakás dátuma" },
    { key: "kamion_rendszam", label: "Kamion" },
    { key: "potkocsi_rendszam", label: "Pótkocsi" },
    { key: "ugyfel_nev", label: "Ügyfél" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "rakomany_leiras", label: "Rakomány" },
    { key: "suly_kg", label: "Súly (kg)" },
    { key: "dij", label: "Díj", exportValue: (row) => (row.dij ? `${row.dij} ${row.devizanem || "HUF"}` : "") },
    { key: "statusz", label: "Státusz", exportValue: (row) => STATUSZ_LABEL[row.statusz] || row.statusz },
    { key: "megjegyzes", label: "Megjegyzés" },
  ];

  return (
    <DataTable
      icon={PiPackageLight}
      title="Fuvarok"
      onAdd={onAdd}
      addLabel="Új fuvar"
      exportFilename="fuvarok"
      exportColumns={exportColumns}
      columns={columns}
      rows={fuvarok}
      mobileTitleKey="felrakas_cim"
      emptyLabel="Nincsenek fuvarok megjelenítve"
    />
  );
}

CardTableForFuvarok.propTypes = {
  fuvarok: PropTypes.array,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onStatuszValt: PropTypes.func.isRequired,
};

CardTableForFuvarok.defaultProps = {
  fuvarok: [],
};
