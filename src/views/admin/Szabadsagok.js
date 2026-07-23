import React, { useState, useEffect, useCallback } from "react";
import { PiCalendarBlankLight, PiTrashLight, PiPencilSimpleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { useListaElemek } from "utils/useListaElemek.js";

import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import { confirmDialog } from "utils/confirm.js";

const PAGE_SIZE = 10;

const emptySzabadsag = (adminId) => ({
  admin: adminId,
  sofor_id: "",
  datum_tol: "",
  datum_ig: "",
  tipus: "szabadsag",
  megjegyzes: "",
});

export default function Szabadsagok() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [szabadsagok, setSzabadsagok] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  // UX-audit — korábban csak létrehozás/törlés volt lehetséges, egy
  // elgépelt dátum/típus javításának egyetlen útja a teljes törlés+újra-
  // felvitel volt. `editingId` — ha nem null, a modal szerkesztés módban
  // nyílik, előtöltött adatokkal, és `updateSzabadsag`-et hív mentéskor.
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptySzabadsag(user.ceg_id));
  const { elemek: tipusok } = useListaElemek("szabadsag_tipus");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchSzabadsagok = async () => {
    const result = await fetchAction("getSzabadsagok", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    if (result?.success) {
      setSzabadsagok(result.szabadsagok || []);
      setTotal(result.total ?? (result.szabadsagok || []).length);
    } else {
      setTotal(0);
    }
  };

  useEffect(() => {
    fetchSzabadsagok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportAll = useCallback(async () => {
    const result = await fetchAction("getSzabadsagok", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result?.success ? result.szabadsagok || [] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const action = editingId ? "updateSzabadsag" : "newSzabadsag";
    const payload = editingId ? { ...form, id: editingId, kerelmezo_id: user.id } : { ...form, kerelmezo_id: user.id };
    const result = await fetchAction(action, payload);
    if (result?.success) {
      toast.success(editingId ? "Szabadság módosítva." : "Szabadság rögzítve.");
      setOpenDialog(false);
      setEditingId(null);
      setForm(emptySzabadsag(user.ceg_id));
      fetchSzabadsagok();
    } else {
      toast.error(result?.message || "Mentés sikertelen.");
    }
  };

  const handleEditClick = (row) => {
    setEditingId(row.id);
    setForm({
      admin: user.ceg_id,
      sofor_id: row.sofor_id,
      datum_tol: row.datum_tol,
      datum_ig: row.datum_ig,
      tipus: row.tipus || "szabadsag",
      megjegyzes: row.megjegyzes || "",
    });
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog("Biztosan törölni szeretnéd ezt a bejegyzést?"))) return;
    const result = await fetchAction("deleteSzabadsag", { id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Törölve.");
      fetchSzabadsagok();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const columns = [
    { key: "sofor_nev", label: "Sofőr", className: "font-semibold text-brand-900 dark:text-ink-50" },
    { key: "datum_tol", label: "Kezdete" },
    { key: "datum_ig", label: "Vége" },
    {
      key: "tipus",
      label: "Típus",
      render: (row) => tipusok.find((t) => t.kulcs === row.tipus)?.nev || row.tipus,
      exportValue: (row) => tipusok.find((t) => t.kulcs === row.tipus)?.nev || row.tipus,
    },
    { key: "megjegyzes", label: "Megjegyzés", render: (row) => row.megjegyzes || "—" },
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
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Csapat" title="Sofőr szabadságok" />
      </div>

      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiCalendarBlankLight}
          title="Szabadságok / elérhetőség"
          onAdd={() => {
            setEditingId(null);
            setForm(emptySzabadsag(user.ceg_id));
            setOpenDialog(true);
          }}
          addLabel="Új bejegyzés"
          exportFilename="szabadsagok"
          columns={columns}
          rows={szabadsagok}
          mobileTitleKey="sofor_nev"
          emptyLabel="Nincsenek rögzített szabadságok"
          fill
          searchable
          searchPlaceholder="Keresés sofőr, típus, megjegyzés szerint..."
          serverSide
          totalRows={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onSearchChange={setSearch}
          onExportAll={handleExportAll}
        />
      </div>

      <Modal
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setEditingId(null);
        }}
        title={editingId ? "Szabadság/elérhetőség szerkesztése" : "Új szabadság/elérhetőség bejegyzés"}
      >
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
            {tipusok.map((t) => (
              <option key={t.kulcs} value={t.kulcs}>
                {t.nev}
              </option>
            ))}
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
              onClick={() => {
                setOpenDialog(false);
                setEditingId(null);
              }}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              {editingId ? "Mentés" : "Hozzáadás"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
