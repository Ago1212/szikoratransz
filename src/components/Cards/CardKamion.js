import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiTruckLight,
  PiArrowLeftLight,
  PiNotePencilLight,
  PiFolderLight,
} from "react-icons/pi";
import CardJarmuAdatokForm from "./CardJarmuAdatokForm";
import CardJarmuEsemenyekForm from "./CardJarmuEsemenyekForm";
import CardJarmuFajlok from "./CardJarmuFajlok";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageCard from "components/UI/PageCard.js";
import TabButton from "components/UI/TabButton.js";

export default function CardKamion({ initialKamion }) {
  const history = useHistory();
  const [kamion, setKamion] = useState(initialKamion || {});
  const [activeTab, setActiveTab] = useState(1);

  const [formData, setFormData] = useState({
    id: kamion.id || null,
    rendszam: kamion.rendszam || null,
    potkocsi: kamion.potkocsi || null,
    meret: kamion.meret || null,
    tipus: kamion.tipus || null,
    allapot: kamion.allapot || "szabad",
    aktualis_km: kamion.aktualis_km || null,
    muszaki_lejarat: kamion.muszaki_lejarat || null,
    adr_lejarat: kamion.adr_lejarat || null,
    taograf_illesztes: kamion.taograf_illesztes || null,
    emelohatfal_vizsga: kamion.emelohatfal_vizsga || null,
    porolto_lejarat: kamion.porolto_lejarat || null,
    porolto_lejarat_2: kamion.porolto_lejarat_2 || null,
    kot_biztositas: kamion.kot_biztositas || null,
    kot_biz_nev: kamion.kot_biz_nev || null,
    kot_biz_dij: kamion.kot_biz_dij || null,
    kot_biz_utem: kamion.kot_biz_utem || null,
    kaszko_biztositas: kamion.kaszko_biztositas || null,
    kaszko_nev: kamion.kaszko_nev || null,
    kaszko_dij: kamion.kaszko_dij || null,
    kaszko_fizetesi_utem: kamion.kaszko_fizetesi_utem || null,
  });

  const handleSave = async () => {
    try {
      const storedUserData = JSON.parse(localStorage.getItem("user"));
      const action = formData.id ? "saveKamionData" : "newKamion";
      const result = await fetchAction(action, {
        admin: storedUserData.ceg_id,
        ...formData,
        kerelmezo_id: storedUserData.id,
      });

      if (result?.success) {
        if (action === "newKamion") {
          toast.success("Új kamion rögzítése sikeres!");
          setKamion(result.kamion);
          setFormData({ ...formData, id: result.kamion.id });
        } else {
          toast.success("Mentés sikeres!");
        }
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isNew = Object.keys(kamion).length === 0;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/kamionok")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a kamionokhoz
      </button>

      {isNew ? (
        <PageCard icon={PiTruckLight} title="Új kamion">
          <div className="px-4 py-4 lg:px-6">
            <CardJarmuAdatokForm
              kamion={formData}
              setFormData={setFormData}
              handleSave={handleSave}
            />
          </div>
        </PageCard>
      ) : (
        <div className="relative flex min-w-0 flex-col rounded-3xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
          <div className="flex items-center gap-2.5 px-5 pt-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <PiTruckLight className="h-[18px] w-[18px]" />
            </span>
            <h3 className="font-display text-base font-semibold text-brand-900 dark:text-ink-50">
              {kamion.rendszam}
            </h3>
          </div>

          <div className="mt-3 flex gap-6 border-b border-ink-100 px-5 dark:border-ink-800">
            <TabButton
              icon={PiNotePencilLight}
              active={activeTab === 1}
              onClick={() => setActiveTab(1)}
            >
              Adatok
            </TabButton>
            <TabButton
              icon={PiFolderLight}
              active={activeTab === 3}
              onClick={() => setActiveTab(3)}
            >
              Fájlok
            </TabButton>
          </div>

          <div className="px-4 py-4 lg:px-6">
            {activeTab === 1 && (
              <CardJarmuAdatokForm
                kamion={formData}
                setFormData={setFormData}
                handleSave={handleSave}
              />
            )}
            {activeTab === 2 && <CardJarmuEsemenyekForm kamion_id={kamion.id} />}
            {activeTab === 3 && <CardJarmuFajlok kamion_id={kamion.id} />}
          </div>
        </div>
      )}
    </div>
  );
}
