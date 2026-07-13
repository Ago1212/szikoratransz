import React, { useEffect, useState, useCallback } from "react";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

import PageHeader from "components/UI/PageHeader.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import CardTableForFuvarok from "components/Table/CardTableForFuvarok.js";

const STATUSZ_FILTEREK = [
  { key: "", label: "Mind" },
  { key: "tervezett", label: "Tervezett" },
  { key: "folyamatban", label: "Folyamatban" },
  { key: "lezart", label: "Lezárt" },
  { key: "storno", label: "Sztornó" },
];

const emptyFuvar = () => ({
  felrakas_cim: "",
  felrakas_datum: "",
  lerakas_cim: "",
  lerakas_datum: "",
  ugyfel_id: "",
  kamion_id: "",
  potkocsi_id: "",
  sofor_id: "",
  rakomany_leiras: "",
  suly_kg: "",
  dij: "",
  devizanem: "HUF",
  megjegyzes: "",
});

const PAGE_SIZE = 15;

export default function Fuvarok() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [fuvarok, setFuvarok] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ statusz: "", datumTol: "", datumIg: "" });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [ugyfelek, setUgyfelek] = useState([]);
  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [soforok, setSoforok] = useState([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyFuvar());
  const [isSaving, setIsSaving] = useState(false);

  const loadFuvarok = () => {
    setIsLoading(true);
    fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      statusz: filter.statusz || undefined,
      datumTol: filter.datumTol || undefined,
      datumIg: filter.datumIg || undefined,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then((result) => {
      if (result?.success) {
        setFuvarok(result.fuvarok || []);
        setTotal(result.total ?? (result.fuvarok || []).length);
      } else {
        setTotal(0);
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadFuvarok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, search]);

  const handleExportAll = useCallback(async () => {
    const result = await fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      statusz: filter.statusz || undefined,
      datumTol: filter.datumTol || undefined,
      datumIg: filter.datumIg || undefined,
      search: search || undefined,
    });
    return result?.success ? result.fuvarok || [] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  // A választók (ügyfél/kamion/pótkocsi/sofőr) csak egyszer töltődnek be —
  // ezek a meglévő, könnyű lookup-akciók, amiket más modulok is használnak.
  useEffect(() => {
    fetchAction("getUgyfelValaszto", { id: user.ceg_id }).then((result) => {
      if (result?.success) setUgyfelek(result.ugyfelek || []);
    });
    fetchAction("getKamionRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setKamionok(result.kamionok || []);
    });
    fetchAction("getPotkocsiRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
    });
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm(emptyFuvar());
    setEditingId(null);
  };

  const closeDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (fuvar) => {
    setEditingId(fuvar.id);
    setForm({
      felrakas_cim: fuvar.felrakas_cim || "",
      felrakas_datum: fuvar.felrakas_datum || "",
      lerakas_cim: fuvar.lerakas_cim || "",
      lerakas_datum: fuvar.lerakas_datum || "",
      ugyfel_id: fuvar.ugyfel_id || "",
      kamion_id: fuvar.kamion_id || "",
      potkocsi_id: fuvar.potkocsi_id || "",
      sofor_id: fuvar.sofor_id || "",
      rakomany_leiras: fuvar.rakomany_leiras || "",
      suly_kg: fuvar.suly_kg || "",
      dij: fuvar.dij || "",
      devizanem: fuvar.devizanem || "HUF",
      megjegyzes: fuvar.megjegyzes || "",
    });
    setOpenDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.felrakas_cim.trim() || !form.lerakas_cim.trim()) {
      toast.error("A felrakási és lerakási cím megadása kötelező!");
      return;
    }
    setIsSaving(true);
    try {
      const action = editingId ? "saveFuvarData" : "newFuvar";
      const result = await fetchAction(action, {
        ...form,
        id: editingId || undefined,
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        toast.success(editingId ? "Fuvar frissítve." : "Fuvar rögzítve.");
        closeDialog();
        loadFuvarok();
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Biztosan törlöd ezt a fuvart?")) return;
    const result = await fetchAction("deleteFuvar", { id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Fuvar törölve.");
      loadFuvarok();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const handleStatuszValt = async (id, statusz) => {
    const result = await fetchAction("updateFuvarStatusz", { id, statusz, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success(statusz === "folyamatban" ? "Fuvar elindítva." : "Fuvar lezárva.");
      loadFuvarok();
    } else {
      toast.error(result?.message || "Nem sikerült frissíteni az állapotot.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader eyebrow="Járművek" title="Fuvarok" className="mb-0" />

      <div className="flex flex-wrap gap-2">
        {STATUSZ_FILTEREK.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setFilter((prev) => ({ ...prev, statusz: s.key }));
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors duration-150 ${
              filter.statusz === s.key ? "bg-brand-600 text-white" : "border border-ink-100 bg-white text-ink-500 hover:bg-slate-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-100">
        <FormSection columns={2}>
          <FormField
            type="date"
            label="Felrakás dátumtól"
            name="datumTol"
            value={filter.datumTol}
            onChange={(e) => {
              setFilter((prev) => ({ ...prev, datumTol: e.target.value }));
              setPage(1);
            }}
          />
          <FormField
            type="date"
            label="Felrakás dátumig"
            name="datumIg"
            value={filter.datumIg}
            onChange={(e) => {
              setFilter((prev) => ({ ...prev, datumIg: e.target.value }));
              setPage(1);
            }}
          />
        </FormSection>
      </div>

      <CardTableForFuvarok
        fuvarok={fuvarok}
        onAdd={() => {
          resetForm();
          setOpenDialog(true);
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatuszValt={handleStatuszValt}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onSearchChange={setSearch}
        onExportAll={handleExportAll}
      />
      {isLoading && <p className="text-center text-sm text-ink-400">Betöltés…</p>}

      <Modal
        open={openDialog}
        onClose={closeDialog}
        title={editingId ? "Fuvar szerkesztése" : "Új fuvar"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSection columns={2}>
            <FormField
              label="Felrakás címe"
              name="felrakas_cim"
              value={form.felrakas_cim}
              onChange={handleFormChange}
              placeholder="pl. Budapest"
              required
            />
            <FormField
              type="date"
              label="Felrakás dátuma"
              name="felrakas_datum"
              value={form.felrakas_datum}
              onChange={handleFormChange}
            />
          </FormSection>
          <FormSection columns={2}>
            <FormField
              label="Lerakás címe"
              name="lerakas_cim"
              value={form.lerakas_cim}
              onChange={handleFormChange}
              placeholder="pl. Wien"
              required
            />
            <FormField
              type="date"
              label="Lerakás dátuma"
              name="lerakas_datum"
              value={form.lerakas_datum}
              onChange={handleFormChange}
            />
          </FormSection>

          <FormSection columns={4}>
            <FormField
              as="select"
              label="Ügyfél"
              name="ugyfel_id"
              value={form.ugyfel_id}
              onChange={handleFormChange}
              className="md:col-span-2"
            >
              <option value="">Nincs kiválasztva</option>
              {ugyfelek.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nev}
                </option>
              ))}
            </FormField>
            <FormField
              as="select"
              label="Sofőr"
              name="sofor_id"
              value={form.sofor_id}
              onChange={handleFormChange}
              className="md:col-span-2"
            >
              <option value="">Nincs kiválasztva</option>
              {soforok.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </FormField>
            <FormField
              as="select"
              label="Kamion"
              name="kamion_id"
              value={form.kamion_id}
              onChange={handleFormChange}
            >
              <option value="">Nincs kiválasztva</option>
              {kamionok.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.rendszam}
                </option>
              ))}
            </FormField>
            <FormField
              as="select"
              label="Pótkocsi"
              name="potkocsi_id"
              value={form.potkocsi_id}
              onChange={handleFormChange}
            >
              <option value="">Nincs kiválasztva</option>
              {potkocsik.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.rendszam}
                </option>
              ))}
            </FormField>
          </FormSection>

          <FormSection columns={4}>
            <FormField
              type="number"
              label="Díj"
              name="dij"
              value={form.dij}
              onChange={handleFormChange}
              className="md:col-span-2"
            />
            <FormField
              as="select"
              label="Devizanem"
              name="devizanem"
              value={form.devizanem}
              onChange={handleFormChange}
            >
              <option value="HUF">HUF</option>
              <option value="EUR">EUR</option>
            </FormField>
            <FormField
              type="number"
              label="Súly (kg)"
              name="suly_kg"
              value={form.suly_kg}
              onChange={handleFormChange}
            />
          </FormSection>

          <FormField
            label="Rakomány leírása"
            name="rakomany_leiras"
            value={form.rakomany_leiras}
            onChange={handleFormChange}
          />
          <FormField
            as="textarea"
            label="Megjegyzés"
            name="megjegyzes"
            value={form.megjegyzes}
            onChange={handleFormChange}
            rows="2"
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Mentés..." : editingId ? "Mentés" : "Hozzáadás"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
