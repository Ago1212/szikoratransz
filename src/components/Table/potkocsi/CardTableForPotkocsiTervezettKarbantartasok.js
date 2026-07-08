import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { PiPencilSimpleLight, PiTrashLight, PiArrowRightLight, PiWrenchLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField from "components/UI/FormField.js";

const CardTableForPotkocsiTervezettKarbantartasok = ({ potkocsi_id, refresh, onRefresh }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [karbantartasok, setKarbantartasok] = useState([]);
  const [selectedKarbantartas, setSelectedKarbantartas] = useState(null);

  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getPotkocsiKarbantartas", {
      potkocsi_id: potkocsi_id,
      kesz: false,
    });

    if (result?.success) {
      setKarbantartasok(result.karbantartas);
    } else {
      alert(result?.message || "Karbantartások betöltése sikertelen.");
    }
  };

  useEffect(() => {
    fetchKarbantartasok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potkocsi_id, refresh]);

  const handleAddClick = () => {
    setSelectedKarbantartas(null);
    setOpenDialog(true);
  };

  const handleEditClick = (karbantartas) => {
    setSelectedKarbantartas(karbantartas);
    setOpenDialog(true);
  };

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setPotkocsiKarbantartasKesz", {
      id: karbantartasId,
      kesz: true,
    });

    if (result?.success) {
      await fetchKarbantartasok();
      onRefresh?.();
    } else {
      alert(result?.message || "Hiba történt a státusz frissítésekor.");
    }
  };

  const handleKarbantartasDelete = async (id) => {
    if (!window.confirm("Biztosan törölni szeretnéd a karbantartást?")) return;

    try {
      const result = await fetchAction("deletePotkocsiKarbantartas", { id });

      if (result?.success) {
        alert("A karbantartás sikeresen törölve.");
        await fetchKarbantartasok();
      } else {
        alert(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  const user = JSON.parse(sessionStorage.getItem("user"));
  const handleSave = async (e) => {
    e.preventDefault();

    const result = await fetchAction("updatePotkocsiKarbantartas", {
      admin: user.id,
      id: selectedKarbantartas?.id,
      datum: selectedKarbantartas?.datum,
      log: selectedKarbantartas?.log,
      potkocsi_id: potkocsi_id,
    });

    if (result?.success) {
      await fetchKarbantartasok();
      setOpenDialog(false);
    } else {
      alert(result?.message || "Módosítás sikertelen.");
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
              className="rounded-xl bg-sand-100 px-4 py-2 text-sm font-medium text-ink-600 transition-colors duration-200 hover:bg-sand-200"
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

CardTableForPotkocsiTervezettKarbantartasok.propTypes = {
  potkocsi_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  refresh: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default CardTableForPotkocsiTervezettKarbantartasok;
