import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { PiSteeringWheelLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";
import StatusBadge from "components/UI/StatusBadge.js";

const STATUSZ_TONE = { rendben: "success", figyelmeztetes: "warning", sertes: "danger" };
const STATUSZ_LABEL = { rendben: "Rendben", figyelmeztetes: "Figyelmeztetés", sertes: "Túllépés" };

const ma = () => new Date().toISOString().slice(0, 10);

export default function VezetesiIdo() {
  const history = useHistory();
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [form, setForm] = useState({ datum: ma(), vezetes_ora: "", pihenes_ora: "", megjegyzes: "" });
  const [saving, setSaving] = useState(false);
  const [naplo, setNaplo] = useState([]);
  const [aktualisHet, setAktualisHet] = useState(null);

  const load = () => {
    fetchAction("getSajatVezetesiNaplo", { sofor_id: user.id }).then((result) => {
      if (result?.success) setNaplo((result.naplo || []).slice(0, 7));
    });
    fetchAction("getSajatVezetesiAllapot", { sofor_id: user.id, hetek: 1 }).then((result) => {
      if (result?.success) setAktualisHet(result.hetek?.[0] || null);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (form.vezetes_ora === "" || form.pihenes_ora === "") {
      toast.error("Add meg a vezetett és a pihenő órák számát!");
      return;
    }
    setSaving(true);
    try {
      const result = await fetchAction("newVezetesiNaplo", {
        ceg_id: user.admin,
        sofor_id: user.id,
        datum: form.datum,
        vezetes_ora: form.vezetes_ora,
        pihenes_ora: form.pihenes_ora,
        megjegyzes: form.megjegyzes || null,
      });
      if (!result?.success) {
        throw new Error(result?.message || "Mentés sikertelen.");
      }
      toast.success("Napi bejegyzés rögzítve!");
      setForm({ datum: ma(), vezetes_ora: "", pihenes_ora: "", megjegyzes: "" });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Vezetési idő" />

      <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-ink-500">
        Tájékoztató jellegű becslés a napi összesítőid alapján — nem hivatalos tachográf-nyilvántartás.
      </p>

      {aktualisHet && (
        <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-soft">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Ezen a héten</p>
            <p className="text-sm font-semibold text-ink-900">{aktualisHet.vezetes_ossz} óra vezetés</p>
          </div>
          <StatusBadge tone={STATUSZ_TONE[aktualisHet.statusz] || "neutral"}>
            {STATUSZ_LABEL[aktualisHet.statusz] || aktualisHet.statusz}
          </StatusBadge>
        </div>
      )}

      <FormSection icon={PiSteeringWheelLight} columns={2}>
        <FormField
          type="date"
          label="Dátum"
          name="datum"
          value={form.datum}
          onChange={handleChange}
          required
        />
        <div />
        <FormField
          type="number"
          label="Vezetett ma (óra)"
          name="vezetes_ora"
          value={form.vezetes_ora}
          onChange={handleChange}
          placeholder="pl. 8.5"
          required
        />
        <FormField
          type="number"
          label="Pihent ma (óra)"
          name="pihenes_ora"
          value={form.pihenes_ora}
          onChange={handleChange}
          placeholder="pl. 11"
          required
        />
      </FormSection>
      <FormField
        as="textarea"
        label="Megjegyzés (opcionális)"
        name="megjegyzes"
        value={form.megjegyzes}
        onChange={handleChange}
        rows="2"
      />

      <SaveButton
        onClick={handleSave}
        isSaving={saving}
        label="Napi bejegyzés mentése"
        savingLabel="Mentés…"
        className="w-full justify-center py-3.5"
      />

      {naplo.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Utolsó napjaid</h2>
          <div className="flex flex-col gap-2">
            {naplo.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 shadow-soft">
                <span className="text-sm font-medium text-ink-700">{n.datum}</span>
                <span className="text-xs text-ink-500">
                  {n.vezetes_ora}ó vezetés / {n.pihenes_ora}ó pihenő
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => history.push("/user/dashboard")}
        className="text-center text-sm font-semibold text-brand-600"
      >
        Vissza a kezdőlapra
      </button>
    </div>
  );
}
