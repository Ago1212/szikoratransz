import React, { useState, useEffect } from "react";
import { confirmDialog } from "utils/confirm.js";
import PropTypes from "prop-types";
import { PiTrashLight, PiArrowLeftLight, PiWrenchLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";

const CardTableForFurgonElvegzettKarbantartas = ({ furgon_id, refresh, onRefresh }) => {
  const [karbantartasok, setKarbantartasok] = useState([]);

  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getFurgonKarbantartas", {
      furgon_id: furgon_id,
      kesz: true,
    });

    if (result?.success) {
      setKarbantartasok(result.karbantartas);
    } else {
      toast.error(result?.message || "Karbantartások betöltése sikertelen.");
    }
  };

  useEffect(() => {
    fetchKarbantartasok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [furgon_id, refresh]);

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setFurgonKarbantartasKesz", {
      id: karbantartasId,
      kesz: false,
    });

    if (result?.success) {
      await fetchKarbantartasok();
      onRefresh?.();
    } else {
      toast.error(result?.message || "Hiba történt a státusz frissítésekor.");
    }
  };

  const handleKarbantartasDelete = async (id) => {
    if (!(await confirmDialog("Biztosan törölni szeretnéd a karbantartást?"))) return;

    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("deleteFurgonKarbantartas", { id, kerelmezo_id: user.id });

      if (result?.success) {
        toast.success("A karbantartás sikeresen törölve.");
        await fetchKarbantartasok();
      } else {
        toast.error(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      toast.error("Hiba történt a törlés során.");
    }
  };

  const columns = [
    {
      key: "actions",
      label: "Műveletek",
      align: "center",
      render: (row) => (
        <div className="flex justify-center">
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleKarbantartasDelete(row.id)}
            title="Törlés"
          />
        </div>
      ),
    },
    { key: "log", label: "Elvégzett karbantartás", className: "whitespace-normal break-words max-w-xs" },
    { key: "datum", label: "Dátum" },
    {
      key: "status",
      label: "Státusz",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => handleSetKarbantartasKesz(row.id)}
          title="Tervezettként jelöl"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-all duration-200 ease-fluid hover:scale-110 hover:bg-amber-50 hover:text-amber-600"
        >
          <PiArrowLeftLight />
        </button>
      ),
    },
  ];

  return (
    <DataTable
      icon={PiWrenchLight}
      title="Elvégzett karbantartások"
      columns={columns}
      rows={karbantartasok}
      emptyLabel="Nincsenek elvégzett karbantartások"
    />
  );
};

CardTableForFurgonElvegzettKarbantartas.propTypes = {
  furgon_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  refresh: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default CardTableForFurgonElvegzettKarbantartas;
