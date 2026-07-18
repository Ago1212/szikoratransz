import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiMapPinLight,
  PiArrowLeftLight,
  PiNotePencilLight,
  PiFolderLight,
  PiBuildingsLight,
  PiChatCircleTextLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import FormField, { FormSection } from "components/UI/FormField.js";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";
import TabButton from "components/UI/TabButton.js";
import CardHelyszinFajlok from "./CardHelyszinFajlok.js";
import HelyszinMegjegyzesek from "components/Helyszin/HelyszinMegjegyzesek.js";

const emptyHelyszin = { nev: "" };

export default function CardHelyszin({ initialHelyszin }) {
  const history = useHistory();
  const [helyszin, setHelyszin] = useState(initialHelyszin || {});
  const isNew = !helyszin?.id;
  const [formData, setFormData] = useState({ ...emptyHelyszin, ...initialHelyszin });
  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const storedUserData = JSON.parse(localStorage.getItem("user"));
      const action = formData.id ? "saveHelyszinData" : "newHelyszin";
      const result = await fetchAction(action, {
        admin: storedUserData.ceg_id,
        ...formData,
      });

      if (result?.success) {
        if (action === "newHelyszin") {
          toast.success("Új helyszín rögzítve!");
          setHelyszin(result.helyszin);
          setFormData({ ...formData, id: result.helyszin.id });
        } else {
          toast.success("Mentés sikeres!");
          setHelyszin((prev) => ({ ...prev, nev: formData.nev }));
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

  const AdatokForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="space-y-5"
    >
      <FormSection title="Alapadatok" icon={PiBuildingsLight} columns={1}>
        <FormField
          icon={PiMapPinLight}
          label="Név"
          name="nev"
          value={formData.nev || ""}
          onChange={handleChange}
          required
          placeholder="pl. Tatabánya Praktiker"
        />
      </FormSection>

      <div className="flex justify-end border-t border-ink-100 pt-4">
        <SaveButton
          onClick={handleSave}
          isSaving={isSaving}
          label={formData.id ? "Mentés" : "Helyszín rögzítése"}
        />
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/helyszinek")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a helyszínekhez
      </button>

      {isNew ? (
        <PageCard icon={PiMapPinLight} title="Új helyszín">
          <div className="px-4 py-4 lg:px-6">{AdatokForm}</div>
        </PageCard>
      ) : (
        <div className="relative flex min-w-0 flex-col rounded-3xl bg-white shadow-soft ring-1 ring-ink-100">
          <div className="flex items-center gap-2.5 px-5 pt-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <PiMapPinLight className="h-[18px] w-[18px]" />
            </span>
            <h3 className="font-display text-base font-semibold text-brand-900">{helyszin.nev}</h3>
          </div>

          <div className="mt-3 flex gap-6 border-b border-ink-100 px-5">
            <TabButton icon={PiNotePencilLight} active={activeTab === 1} onClick={() => setActiveTab(1)}>
              Adatok
            </TabButton>
            <TabButton icon={PiChatCircleTextLight} active={activeTab === 2} onClick={() => setActiveTab(2)}>
              Megjegyzések
            </TabButton>
            <TabButton icon={PiFolderLight} active={activeTab === 3} onClick={() => setActiveTab(3)}>
              Fotók / videók
            </TabButton>
          </div>

          <div className="px-4 py-4 lg:px-6">
            {activeTab === 1 && AdatokForm}
            {activeTab === 2 && (
              <HelyszinMegjegyzesek
                helyszinId={helyszin.id}
                szerzoTipus="admin"
                szerzoId={user.id}
                szerzoNev={user.name}
              />
            )}
            {activeTab === 3 && <CardHelyszinFajlok helyszin_id={helyszin.id} />}
          </div>
        </div>
      )}
    </div>
  );
}
