import React, { useEffect, useState } from "react";
import { confirmDialog } from "utils/confirm.js";
import PropTypes from "prop-types";
import { PiPencilSimpleLight, PiTrashLight, PiCalendarBlankLight } from "react-icons/pi";
import { format } from "date-fns";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField from "components/UI/FormField.js";

const PAGE_SIZE = 10;

const emptyForm = () => ({
  leiras: "",
  datum: format(new Date(), "yyyy-MM-dd"),
});

const CardTableForEsemenyek = ({ id }) => {
  const [esemenyek, setEsemenyek] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [currentEsemeny, setCurrentEsemeny] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchEsemenyek = async () => {
    const result = await fetchAction("getEgyediHataridok", { id, search: search || undefined, page, pageSize: PAGE_SIZE });
    if (result?.success) {
      setEsemenyek(result.esemenyek);
      setTotal(result.total ?? (result.esemenyek || []).length);
    } else {
      toast.error(result?.message || "Események betöltése sikertelen.");
      setTotal(0);
    }
  };

  useEffect(() => {
    fetchEsemenyek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, search]);


  const handleEsemenyDelete = async (esemeny_id) => {
    if (!(await confirmDialog("Biztosan törölni szeretné ezt az eseményt?"))) return;

    const result = await fetchAction("deleteEgyediHatarido", { id: esemeny_id, ceg_id: id });
    if (result?.success) {
      await fetchEsemenyek();
    } else {
      toast.error(result?.message || "Hiba történt a törlés során");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const action = currentEsemeny ? "updateEgyediHatarido" : "createEgyediHatarido";
    const data = currentEsemeny
      ? { ...formData, id: currentEsemeny.sorszam, ceg_id: id }
      : { ...formData, id };

    const result = await fetchAction(action, data);
    if (result?.success) {
      await fetchEsemenyek();
      resetForm();
    } else {
      toast.error(result?.message || "Hiba történt a művelet során");
    }
  };

  const openEditDialog = (esemeny) => {
    setCurrentEsemeny(esemeny);
    setFormData({ leiras: esemeny.leiras, datum: esemeny.datum });
    setShowDialog(true);
  };

  const resetForm = () => {
    setShowDialog(false);
    setCurrentEsemeny(null);
    setFormData(emptyForm());
  };

  const columns = [
    { key: "leiras", label: "Esemény" },
    { key: "datum", label: "Dátum" },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon
            icon={<PiPencilSimpleLight />}
            onClick={() => openEditDialog(row)}
            title="Szerkesztés"
          />
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleEsemenyDelete(row.sorszam)}
            title="Törlés"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        icon={PiCalendarBlankLight}
        title="Események"
        onAdd={() => setShowDialog(true)}
        addLabel="Új esemény"
        columns={columns}
        rows={esemenyek}
        rowKey={(row, index) => row.sorszam ?? index}
        onRowDoubleClick={openEditDialog}
        emptyLabel="Nincsenek események megjelenítve"
        searchable
        searchPlaceholder="Keresés leírás szerint..."
        serverSide
        totalRows={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onSearchChange={setSearch}
      />

      <Modal
        open={showDialog}
        onClose={resetForm}
        title={currentEsemeny ? "Esemény szerkesztése" : "Új esemény létrehozása"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Leírás"
            name="leiras"
            value={formData.leiras}
            onChange={handleInputChange}
            required
          />
          <FormField
            label="Dátum"
            type="date"
            name="datum"
            value={formData.datum}
            onChange={handleInputChange}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              {currentEsemeny ? "Mentés" : "Létrehozás"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

CardTableForEsemenyek.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default CardTableForEsemenyek;
