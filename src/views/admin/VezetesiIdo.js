import React, { useEffect, useState } from "react";
import { PiSteeringWheelLight, PiWarningCircleLight, PiTrashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import StatusBadge from "components/UI/StatusBadge.js";

const STATUSZ_TONE = { rendben: "success", figyelmeztetes: "warning", sertes: "danger" };
const STATUSZ_LABEL = { rendben: "Rendben", figyelmeztetes: "Figyelmeztetés", sertes: "Túllépés" };
const TULLEPES_LABEL = {
  napi_vezetes_tullepve: "Napi vezetési idő túllépve",
  napi_piheno_tullepve: "Napi pihenő nem elég",
  sok_hosszabbitott_nap: "Túl sok hosszabbított nap ezen a héten",
  sok_ritkitott_piheno: "Túl sok ritkított pihenő ezen a héten",
  heti_vezetes_tullepve: "Heti (56ó) vezetési limit túllépve",
  ketheti_vezetes_tullepve: "Kétheti (90ó) vezetési limit túllépve",
  heti_piheno_hianyzik: "Heti pihenő hiányzik",
  potpiheno_lejart: "Pótpihenő esedékes/lejárt",
};

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink-100">
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-0.5 truncate font-display text-xl font-bold text-brand-900">{value}</p>
      </div>
    </div>
  );
}

const emptyForm = () => ({
  sofor_id: "",
  datum: new Date().toISOString().slice(0, 10),
  vezetes_ora: "",
  pihenes_ora: "",
  megjegyzes: "",
});

export default function VezetesiIdo() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [soforok, setSoforok] = useState([]);
  const [soforValaszto, setSoforValaszto] = useState([]);
  const [kivalasztott, setKivalasztott] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    fetchAction("getVezetesiOsszesito", { ceg_id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    load();
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforValaszto(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sertesSzam = soforok.filter((s) => s.hetek?.[0]?.statusz === "sertes").length;
  const figyelmeztetesSzam = soforok.filter((s) => s.hetek?.[0]?.statusz === "figyelmeztetes").length;

  const rows = soforok.map((s) => ({
    sofor_id: s.sofor_id,
    sofor_nev: s.sofor_nev || `#${s.sofor_id}`,
    vezetes_ossz: s.hetek?.[0]?.vezetes_ossz ?? 0,
    statusz: s.hetek?.[0]?.statusz || "rendben",
    hetek: s.hetek || [],
  }));

  const columns = [
    { key: "sofor_nev", label: "Sofőr", className: "font-semibold text-brand-900" },
    { key: "vezetes_ossz", label: "Vezetés ezen a héten", render: (row) => `${row.vezetes_ossz} óra` },
    {
      key: "statusz",
      label: "Állapot",
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
        <button
          type="button"
          onClick={() => setKivalasztott(row)}
          className="rounded-lg px-2.5 py-1 text-xs font-bold text-brand-600 hover:bg-brand-50"
        >
          Heti bontás
        </button>
      ),
    },
  ];

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sofor_id || form.vezetes_ora === "" || form.pihenes_ora === "") {
      toast.error("A sofőr, a vezetett és a pihenő órák megadása kötelező!");
      return;
    }
    setIsSaving(true);
    try {
      const result = await fetchAction("newVezetesiNaplo", {
        ceg_id: user.ceg_id,
        sofor_id: form.sofor_id,
        datum: form.datum,
        vezetes_ora: form.vezetes_ora,
        pihenes_ora: form.pihenes_ora,
        megjegyzes: form.megjegyzes || null,
      });
      if (result?.success) {
        toast.success("Napi bejegyzés mentve.");
        setOpenDialog(false);
        setForm(emptyForm());
        load();
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNap = async (id) => {
    if (!window.confirm("Biztosan törlöd ezt a napi bejegyzést?")) return;
    const result = await fetchAction("deleteVezetesiNaplo", { id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Bejegyzés törölve.");
      load();
      setKivalasztott(null);
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader eyebrow="Csapat" title="Vezetési idő" />

      <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-ink-500">
        Tájékoztató jellegű becslés a sofőrök napi összesítői alapján (EU 561/2006) — nem hivatalos
        tachográf-nyilvántartás pótlása.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={PiWarningCircleLight}
          label="Túllépés ezen a héten"
          value={`${sertesSzam} sofőr`}
          tone="bg-red-50 text-red-600"
        />
        <StatCard
          icon={PiWarningCircleLight}
          label="Figyelmeztetés ezen a héten"
          value={`${figyelmeztetesSzam} sofőr`}
          tone="bg-amber-50 text-amber-600"
        />
      </div>

      <DataTable
        icon={PiSteeringWheelLight}
        title="Sofőrök"
        onAdd={() => setOpenDialog(true)}
        addLabel="Napi bejegyzés"
        exportFilename="vezetesi_ido"
        exportColumns={columns.filter((c) => c.key !== "actions")}
        columns={columns}
        rows={rows}
        mobileTitleKey="sofor_nev"
        emptyLabel="Nincs rögzített vezetési adat"
      />
      {isLoading && <p className="text-center text-sm text-ink-400">Betöltés…</p>}

      <Modal
        open={!!kivalasztott}
        onClose={() => setKivalasztott(null)}
        title={kivalasztott ? `${kivalasztott.sofor_nev} — heti bontás` : ""}
        maxWidth="max-w-2xl"
      >
        {kivalasztott && (
          <div className="flex flex-col gap-3">
            {kivalasztott.hetek.length === 0 ? (
              <p className="text-sm text-ink-400">Nincs rögzített adat.</p>
            ) : (
              kivalasztott.hetek.map((h) => (
                <div key={h.het_kezdete} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">Hét: {h.het_kezdete}</p>
                    <StatusBadge tone={STATUSZ_TONE[h.statusz] || "neutral"}>
                      {STATUSZ_LABEL[h.statusz] || h.statusz}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">Összes vezetés: {h.vezetes_ossz} óra</p>
                  {h.tullepesek.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-4 text-xs text-red-600">
                      {h.tullepesek.map((t) => (
                        <li key={t}>{TULLEPES_LABEL[t] || t}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex flex-col gap-1">
                    {h.napok.map((n) => (
                      <div key={n.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                        <span className="text-ink-600">{n.datum}</span>
                        <span className="text-ink-500">
                          {n.vezetes_ora}ó vezetés / {n.pihenes_ora}ó pihenő
                        </span>
                        <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDeleteNap(n.id)} title="Törlés" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      <Modal open={openDialog} onClose={() => setOpenDialog(false)} title="Napi bejegyzés rögzítése/javítása">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            as="select"
            label="Sofőr"
            name="sofor_id"
            value={form.sofor_id}
            onChange={handleFormChange}
            required
          >
            <option value="">Válassz sofőrt...</option>
            {soforValaszto.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FormField>
          <FormSection columns={3}>
            <FormField type="date" label="Dátum" name="datum" value={form.datum} onChange={handleFormChange} required />
            <FormField
              type="number"
              label="Vezetés (óra)"
              name="vezetes_ora"
              value={form.vezetes_ora}
              onChange={handleFormChange}
              required
            />
            <FormField
              type="number"
              label="Pihenő (óra)"
              name="pihenes_ora"
              value={form.pihenes_ora}
              onChange={handleFormChange}
              required
            />
          </FormSection>
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
              onClick={() => setOpenDialog(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Mentés..." : "Mentés"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
