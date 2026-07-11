import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { PiGasPumpLight, PiCameraLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { fileToBase64 } from "utils/fileToBase64.js";
import MobileHeader from "components/UI/MobileHeader.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";

export default function Tankolas() {
  const history = useHistory();
  const [form, setForm] = useState({ liter: "", egysegar: "", km_oraallas: "", helyszin: "" });
  const [blokk, setBlokk] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const osszeg =
    form.liter && form.egysegar ? Math.round(Number(form.liter) * Number(form.egysegar)) : null;

  const handleSave = async () => {
    if (!form.liter) {
      toast.error("Add meg a tankolt literek számát!");
      return;
    }
    const user = JSON.parse(sessionStorage.getItem("user"));
    setSaving(true);
    try {
      const result = await fetchAction("newTankolas", {
        admin: user.admin,
        sofor_id: user.id,
        kamion_id: user.kamion || null,
        liter: form.liter,
        egysegar: form.egysegar || null,
        km_oraallas: form.km_oraallas || null,
        helyszin: form.helyszin || null,
      });

      if (!result?.success) {
        throw new Error(result?.message || "Mentés sikertelen.");
      }

      if (blokk) {
        const base64 = await fileToBase64(blokk);
        await fetchAction("fileUpload", {
          admin: user.admin,
          id: result.id,
          tabla: "tankolas",
          file: base64,
          name: blokk.name,
          size: blokk.size,
          kategoria: "tankolas",
        });
      }

      toast.success("Tankolás rögzítve!");
      history.push("/user/dashboard");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Tankolás rögzítése" />

      <FormSection icon={PiGasPumpLight} columns={2}>
        <FormField
          type="number"
          label="Mennyiség (liter)"
          name="liter"
          value={form.liter}
          onChange={handleChange}
          required
          placeholder="pl. 450"
        />
        <FormField
          type="number"
          label="Egységár (Ft/liter)"
          name="egysegar"
          value={form.egysegar}
          onChange={handleChange}
          placeholder="pl. 620"
        />
        <FormField
          type="number"
          label="Km-óraállás"
          name="km_oraallas"
          value={form.km_oraallas}
          onChange={handleChange}
          placeholder="pl. 128450"
        />
        <FormField
          label="Helyszín"
          name="helyszin"
          value={form.helyszin}
          onChange={handleChange}
          placeholder="pl. MOL Győr, M1"
        />
      </FormSection>

      {osszeg !== null && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Várható összeg</p>
          <p className="font-display text-xl font-bold text-brand-900">
            {osszeg.toLocaleString("hu-HU")} Ft
          </p>
        </div>
      )}

      <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white py-3.5 text-sm font-semibold text-ink-600">
        <PiCameraLight className="h-5 w-5" />
        {blokk ? blokk.name : "Blokk lefotózása"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setBlokk(e.target.files[0] || null)}
        />
      </label>

      <SaveButton
        onClick={handleSave}
        isSaving={saving}
        label="Tankolás mentése"
        savingLabel="Mentés…"
        className="w-full justify-center py-3.5"
      />
    </div>
  );
}
