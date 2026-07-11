import React, { useState, useEffect } from "react";
import { PiCalendarBlankLight, PiTrashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";

const TIPUS_LABEL = {
  szabadsag: "Szabadság",
  betegszabadsag: "Betegszabadság",
  egyeb: "Egyéb",
};

const emptySzabadsag = (adminId) => ({
  admin: adminId,
  sofor_id: "",
  datum_tol: "",
  datum_ig: "",
  tipus: "szabadsag",
  megjegyzes: "",
});

export default function Szabadsagok() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [szabadsagok, setSzabadsagok] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(emptySzabadsag(user.ceg_id));

  const fetchSzabadsagok = async () => {
    const result = await fetchAction("getSzabadsagok", { id: user.ceg_id });
    if (result?.success) setSzabadsagok(result.szabadsagok || []);
  };

  useEffect(() => {
    fetchSzabadsagok();
    fetchAction("getSoforok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const result = await fetchAction("newSzabadsag", form);
    if (result?.success) {
      toast.success("Szabadság rögzítve.");
      setOpenDialog(false);
      setForm(emptySzabadsag(user.ceg_id));
      fetchSzabadsagok();
    } else {
      toast.error(result?.message || "Mentés sikertelen.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Biztosan törölni szeretnéd ezt a bejegyzést?")) return;
    const result = await fetchAction("deleteSzabadsag", { id });
    if (result?.success) {
      toast.success("Törölve.");
      fetchSzabadsagok();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const columns = [
    { key: "sofor_nev", label: "Sofőr", className: "font-semibold text-brand-900" },
    { key: "datum_tol", label: "Kezdete" },
    { key: "datum_ig", label: "Vége" },
    {
      key: "tipus",
      label: "Típus",
      render: (row) => TIPUS_LABEL[row.tipus] || row.tipus,
    },
    { key: "megjegyzes", label: "Megjegyzés", render: (row) => row.megjegyzes || "—" },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
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
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
      <div className="flex-shrink-0">
        <PageHeader title="Sofőr szabadságok" />
      </div>

      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiCalendarBlankLight}
          title="Szabadságok / elérhetőség"
          onAdd={() => setOpenDialog(true)}
          addLabel="Új bejegyzés"
          exportFilename="szabadsagok"
          columns={columns}
          rows={szabadsagok}
          mobileTitleKey="sofor_nev"
          emptyLabel="Nincsenek rögzített szabadságok"
          fill
        />
      </div>

      <Modal open={openDialog} onClose={() => setOpenDialog(false)} title="Új szabadság/elérhetőség bejegyzés">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField
            as="select"
            label="Sofőr"
            name="sofor_id"
            value={form.sofor_id}
            onChange={handleChange}
            required
          >
            <option value="">Válassz sofőrt</option>
            {soforok.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FormField>
          <FormSection columns={2}>
            <FormField
              type="date"
              label="Kezdete"
              name="datum_tol"
              value={form.datum_tol}
              onChange={handleChange}
              required
            />
            <FormField
              type="date"
              label="Vége"
              name="datum_ig"
              value={form.datum_ig}
              onChange={handleChange}
              required
            />
          </FormSection>
          <FormField
            as="select"
            label="Típus"
            name="tipus"
            value={form.tipus}
            onChange={handleChange}
          >
            <option value="szabadsag">Szabadság</option>
            <option value="betegszabadsag">Betegszabadság</option>
            <option value="egyeb">Egyéb</option>
          </FormField>
          <FormField
            as="textarea"
            label="Megjegyzés"
            name="megjegyzes"
            value={form.megjegyzes}
            onChange={handleChange}
            rows="2"
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
              Hozzáadás
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
