import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiBuildingsLight,
  PiArrowLeftLight,
  PiHashLight,
  PiMapPinLight,
  PiUserLight,
  PiEnvelopeSimpleLight,
  PiPhoneLight,
  PiTruckLight,
  PiNoteLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import FormField, { FormSection } from "components/UI/FormField.js";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";

const emptyUgyfel = {
  nev: "",
  adoszam: "",
  cim: "",
  irsz: "",
  varos: "",
  kapcsolattarto_nev: "",
  kapcsolattarto_email: "",
  kapcsolattarto_telefon: "",
  fizetesi_hatarido_nap: "",
  felrako_ceg: "",
  felrako_cim: "",
  lerako_ceg: "",
  lerako_cim: "",
  megjegyzes: "",
};

export default function CardUgyfel({ initialUgyfel }) {
  const history = useHistory();
  const isNew = !initialUgyfel?.id;
  const [formData, setFormData] = useState({ ...emptyUgyfel, ...initialUgyfel });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const storedUserData = JSON.parse(localStorage.getItem("user"));
      const action = formData.id ? "saveUgyfelData" : "newUgyfel";
      const result = await fetchAction(action, {
        admin: storedUserData.ceg_id,
        ceg_id: storedUserData.ceg_id,
        ...formData,
        kerelmezo_id: storedUserData.id,
      });

      if (result?.success) {
        if (action === "newUgyfel") {
          toast.success("Új ügyfél rögzítése sikeres!");
          setFormData(result.ugyfel);
        } else {
          toast.success("Mentés sikeres!");
        }
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/ugyfelek")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza az ügyfelekhez
      </button>

      <PageCard icon={PiBuildingsLight} title={isNew ? "Új ügyfél" : "Ügyfél szerkesztése"}>
        <div className="px-4 py-4 lg:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-5"
          >
            <FormSection title="Cégadatok" icon={PiBuildingsLight} columns={4}>
              <FormField
                icon={PiBuildingsLight}
                label="Név"
                name="nev"
                value={formData.nev || ""}
                onChange={handleChange}
                required
                className="md:col-span-2"
              />
              <FormField
                icon={PiHashLight}
                label="Adószám"
                name="adoszam"
                value={formData.adoszam || ""}
                onChange={handleChange}
              />
              <FormField
                type="number"
                label="Fizetési határidő (nap)"
                name="fizetesi_hatarido_nap"
                value={formData.fizetesi_hatarido_nap || ""}
                onChange={handleChange}
              />
            </FormSection>

            <FormSection title="Cím" icon={PiMapPinLight} columns={4}>
              <FormField
                label="Város"
                name="varos"
                value={formData.varos || ""}
                onChange={handleChange}
              />
              <FormField
                label="Irányítószám"
                inputMode="numeric"
                name="irsz"
                value={formData.irsz || ""}
                onChange={handleChange}
              />
              <FormField
                label="Cím"
                name="cim"
                value={formData.cim || ""}
                onChange={handleChange}
                className="md:col-span-2"
              />
            </FormSection>

            <FormSection title="Kapcsolattartó" icon={PiUserLight} columns={4}>
              <FormField
                icon={PiUserLight}
                label="Név"
                name="kapcsolattarto_nev"
                value={formData.kapcsolattarto_nev || ""}
                onChange={handleChange}
                className="md:col-span-2"
              />
              <FormField
                icon={PiEnvelopeSimpleLight}
                type="email"
                label="Email cím"
                name="kapcsolattarto_email"
                value={formData.kapcsolattarto_email || ""}
                onChange={handleChange}
              />
              <FormField
                icon={PiPhoneLight}
                type="tel"
                label="Telefonszám"
                name="kapcsolattarto_telefon"
                value={formData.kapcsolattarto_telefon || ""}
                onChange={handleChange}
              />
            </FormSection>

            <FormSection title="Felrakó / Lerakó (alapértelmezett)" icon={PiTruckLight} columns={4}>
              <FormField
                label="Felrakó cég"
                name="felrako_ceg"
                value={formData.felrako_ceg || ""}
                onChange={handleChange}
              />
              <FormField
                label="Felrakó cím"
                name="felrako_cim"
                value={formData.felrako_cim || ""}
                onChange={handleChange}
              />
              <FormField
                label="Lerakó cég"
                name="lerako_ceg"
                value={formData.lerako_ceg || ""}
                onChange={handleChange}
              />
              <FormField
                label="Lerakó cím"
                name="lerako_cim"
                value={formData.lerako_cim || ""}
                onChange={handleChange}
              />
            </FormSection>

            <FormSection title="Megjegyzés" icon={PiNoteLight} columns={1}>
              <FormField
                as="textarea"
                label="Megjegyzés"
                name="megjegyzes"
                value={formData.megjegyzes || ""}
                onChange={handleChange}
                rows="3"
              />
            </FormSection>

            <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
              <SaveButton
                onClick={handleSave}
                isSaving={isSaving}
                label={formData.id ? "Mentés" : "Ügyfél rögzítése"}
              />
            </div>
          </form>
        </div>
      </PageCard>
    </div>
  );
}
