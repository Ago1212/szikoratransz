import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import {
  PiTruckTrailerLight,
  PiArrowLeftLight,
  PiNotePencilLight,
  PiFolderLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import CardPotkocsiAdatokForm from "./CardPotkocsiAdatokForm";
import CardPotkocsiEsemenyekForm from "./CardPotkocsiEsemenyekForm";
import CardPotkocsiFajlok from "./CardPotkocsiFajlok";
import PageCard from "components/UI/PageCard.js";
import TabButton from "components/UI/TabButton.js";

const CardPotkocsi = ({ initialPotkocsi }) => {
  const history = useHistory();
  const [potkocsi, setPotkocsi] = useState(initialPotkocsi || {});
  const [activeTab, setActiveTab] = useState(1);

  const [formData, setFormData] = useState({
    id: "",
    rendszam: "",
    tipus: "",
    teherbiras: "",
    allapot: "szabad",
    aktualis_km: "",
    muszaki_lejarat: "",
    adr_lejarat: "",
    taograf_illesztes: "",
    emelohatfal_vizsga: "",
    porolto_lejarat: "",
    porolto_lejarat_2: "",
    kot_biztositas: "",
    kot_biz_nev: "",
    kot_biz_dij: "",
    kot_biz_utem: "",
    kaszko_biztositas: "",
    kaszko_nev: "",
    kaszko_dij: "",
    kaszko_fizetesi_utem: "",
  });

  useEffect(() => {
    if (Object.keys(potkocsi).length > 0) {
      setFormData({
        id: potkocsi.id || "",
        rendszam: potkocsi.rendszam || "",
        tipus: potkocsi.tipus || "",
        teherbiras: potkocsi.teherbiras || "",
        allapot: potkocsi.allapot || "szabad",
        aktualis_km: potkocsi.aktualis_km || "",
        muszaki_lejarat: potkocsi.muszaki_lejarat || "",
        adr_lejarat: potkocsi.adr_lejarat || "",
        taograf_illesztes: potkocsi.taograf_illesztes || "",
        emelohatfal_vizsga: potkocsi.emelohatfal_vizsga || "",
        porolto_lejarat: potkocsi.porolto_lejarat || "",
        porolto_lejarat_2: potkocsi.porolto_lejarat_2 || "",
        kot_biztositas: potkocsi.kot_biztositas || "",
        kot_biz_nev: potkocsi.kot_biz_nev || "",
        kot_biz_dij: potkocsi.kot_biz_dij || "",
        kot_biz_utem: potkocsi.kot_biz_utem || "",
        kaszko_biztositas: potkocsi.kaszko_biztositas || "",
        kaszko_nev: potkocsi.kaszko_nev || "",
        kaszko_dij: potkocsi.kaszko_dij || "",
        kaszko_fizetesi_utem: potkocsi.kaszko_fizetesi_utem || "",
      });
    }
  }, [potkocsi]);

  const handleSave = async () => {
    try {
      const storedUserData = JSON.parse(localStorage.getItem("user"));
      const action = formData.id ? "savePotkocsiData" : "newPotkocsi";
      const result = await fetchAction(action, {
        admin: storedUserData.ceg_id,
        ...formData,
        kerelmezo_id: storedUserData.id,
      });

      if (result?.success) {
        if (action === "newPotkocsi") {
          toast.success("Új pótkocsi rögzítése sikeres!");
          setPotkocsi(result.potkocsi);
          setFormData({ ...formData, id: result.potkocsi.id });
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

  const isNew = Object.keys(potkocsi).length === 0;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/potkocsi")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a pótkocsikhoz
      </button>

      {isNew ? (
        <PageCard icon={PiTruckTrailerLight} title="Új pótkocsi">
          <div className="px-4 py-4 lg:px-6">
            <CardPotkocsiAdatokForm
              potkocsi={formData}
              setFormData={setFormData}
              handleSave={handleSave}
            />
          </div>
        </PageCard>
      ) : (
        <div className="relative flex min-w-0 flex-col rounded-3xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
          <div className="flex items-center gap-2.5 px-5 pt-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <PiTruckTrailerLight className="h-[18px] w-[18px]" />
            </span>
            <h3 className="font-display text-base font-semibold text-brand-900 dark:text-ink-50">
              {potkocsi.rendszam}
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
              <CardPotkocsiAdatokForm
                potkocsi={formData}
                setFormData={setFormData}
                handleSave={handleSave}
              />
            )}
            {activeTab === 2 && (
              <CardPotkocsiEsemenyekForm potkocsi_id={potkocsi.id} />
            )}
            {activeTab === 3 && <CardPotkocsiFajlok potkocsi_id={potkocsi.id} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default CardPotkocsi;
