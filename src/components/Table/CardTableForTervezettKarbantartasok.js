import React, { useState, useEffect } from "react";
import { confirmDialog } from "utils/confirm.js";
import PropTypes from "prop-types";
import { PiPencilSimpleLight, PiTrashLight, PiArrowRightLight, PiWrenchLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField from "components/UI/FormField.js";

const CardTableForTervezettKarbantartasok = ({ kamion_id, refresh, onRefresh }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [karbantartasok, setKarbantartasok] = useState([]);
  const [selectedKarbantartas, setSelectedKarbantartas] = useState(null);
  const user = JSON.parse(localStorage.getItem("user"));

  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getKarbantartas", {
      kamion_id: kamion_id,
      kesz: false,
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
  }, [kamion_id, refresh]);

  const handleAddClick = () => {
    setSelectedKarbantartas(null);
    setOpenDialog(true);
  };

  const handleEditClick = (karbantartas) => {
    setSelectedKarbantartas(karbantartas);
    setOpenDialog(true);
  };

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setKarbantartasKesz", {
      id: karbantartasId,
      kesz: true,
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
      const result = await fetchAction("deleteKarbantartas", { id, kerelmezo_id: user.id });

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

  const handleSave = async (e) => {
    e.preventDefault();

    const result = await fetchAction("updateKarbantartas", {
      admin: user.ceg_id,
      id: selectedKarbantartas?.id,
      datum: selectedKarbantartas?.datum,
      log: selectedKarbantartas?.log,
      kamion_id: kamion_id,
      kerelmezo_id: user.id,
    });

    if (result?.success) {
      await fetchKarbantartasok();
      setOpenDialog(false);
    } else {
      toast.error(result?.message || "Módosítás sikertelen.");
    }
  };

  const columns = [
    {
      key: "actions",
      label: "Műveletek",
      align: "center",
      render: (row) => (
        <div className="flex justify-center gap-1">
          <ActionIcon
            icon={<PiPencilSimpleLight />}
            onClick={() => handleEditClick(row)}
            title="Szerkesztés"
          />
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleKarbantartasDelete(row.id)}
            title="Törlés"
          />
          <button
            type="button"
            onClick={() => handleSetKarbantartasKesz(row.id)}
            title="Elvégzettként jelöl"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-all duration-200 ease-fluid hover:scale-110 hover:bg-emerald-50 hover:text-emerald-600"
          >
            <PiArrowRightLight />
          </button>
        </div>
      ),
    },
    { key: "log", label: "Tervezett karbantartás", className: "whitespace-normal break-words max-w-xs" },
    { key: "datum", label: "Dátum" },
  ];

  return (
    <>
      <DataTable
        icon={PiWrenchLight}
        title="Tervezett karbantartások"
        onAdd={handleAddClick}
        columns={columns}
        rows={karbantartasok}
        onRowDoubleClick={handleEditClick}
        emptyLabel="Nincsenek tervezett karbantartások"
      />

      <Modal
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title={selectedKarbantartas ? "Karbantartás módosítása" : "Új karbantartás"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FormField
            label="Dátum"
            type="date"
            value={selectedKarbantartas?.datum || ""}
            onChange={(e) =>
              setSelectedKarbantartas((prev) => ({ ...prev, datum: e.target.value }))
            }
            required
          />
          <FormField
            label="Leírás"
            as="textarea"
            rows="5"
            placeholder="Karbantartás leírása..."
            value={selectedKarbantartas?.log || ""}
            onChange={(e) =>
              setSelectedKarbantartas((prev) => ({ ...prev, log: e.target.value }))
            }
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpenDialog(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              Mentés
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

CardTableForTervezettKarbantartasok.propTypes = {
  kamion_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  refresh: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default CardTableForTervezettKarbantartasok;
