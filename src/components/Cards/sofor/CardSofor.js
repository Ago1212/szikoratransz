import React, { useState } from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import {
  PiUsersLight,
  PiArrowLeftLight,
  PiNotePencilLight,
  PiFolderLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import CardSoforAdatokForm from "./CardSoforAdatokForm";
import CardSoforFajlok from "./CardSoforFajlok";
import PageCard from "components/UI/PageCard.js";
import TabButton from "components/UI/TabButton.js";

export default function CardSoforok({ initSofor }) {
  const history = useHistory();
  const [sofor, setSofor] = useState(initSofor || {});
  const [activeTab, setActiveTab] = useState(1);
  const [formData, setFormData] = useState({
    id: sofor.id || "",
    name: sofor.name || "",
    email: sofor.email || "",
    phone: sofor.phone || "",
    szul_datum: sofor.szul_datum || "",
    szemelyi: sofor.szemelyi || "",
    varos: sofor.varos || "",
    irsz: sofor.irsz || "",
    cim: sofor.cim || "",
    szemelyi_lejarat: sofor.szemelyi_lejarat || "",
    jogsi_lejarat: sofor.jogsi_lejarat || "",
    gki_lejarat: sofor.gki_lejarat || "",
    adr_lejarat: sofor.adr_lejarat || "",
    kamion: sofor.kamion || "",
    aktiv_potkocsi: sofor.aktiv_potkocsi || "",
  });

  const handleSave = async () => {
    try {
      const storedUserData = JSON.parse(sessionStorage.getItem("user"));
      const action = formData.id ? "saveSoforData" : "newSofor";
      const result = await fetchAction(action, {
        admin: storedUserData.ceg_id,
        ...formData,
      });

      if (result?.success) {
        if (action === "newSofor") {
          toast.success("Új sofőr rögzítése sikeres!");
          setSofor(result.sofor);
          setFormData({ ...formData, id: result.sofor.id });
        } else {
          toast.success("Mentés sikeres!");
        }
      } else {
        throw new Error(result?.message || "Mentés sikertelen.");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isNew = Object.keys(sofor).length === 0;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/soforok")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a sofőrökhöz
      </button>

      {isNew ? (
        <PageCard icon={PiUsersLight} title="Sofőr">
          <div className="px-4 py-4 lg:px-6">
            <CardSoforAdatokForm
              sofor={formData}
              setFormData={setFormData}
              handleSave={handleSave}
            />
          </div>
        </PageCard>
      ) : (
        <div className="relative flex min-w-0 flex-col rounded-3xl bg-white shadow-soft ring-1 ring-ink-100">
          <div className="flex items-center gap-2.5 px-5 pt-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <PiUsersLight className="h-[18px] w-[18px]" />
            </span>
            <h3 className="font-display text-base font-semibold text-brand-900">
              {sofor.name}
            </h3>
          </div>

          <div className="mt-3 flex gap-6 border-b border-ink-100 px-5">
            <TabButton
              icon={PiNotePencilLight}
              active={activeTab === 1}
              onClick={() => setActiveTab(1)}
            >
              Adatok
            </TabButton>
            <TabButton
              icon={PiFolderLight}
              active={activeTab === 2}
              onClick={() => setActiveTab(2)}
            >
              Fájlok
            </TabButton>
          </div>

          <div className="px-4 py-4 lg:px-6">
            {activeTab === 1 && (
              <CardSoforAdatokForm
                sofor={formData}
                setFormData={setFormData}
                handleSave={handleSave}
              />
            )}
            {activeTab === 2 && <CardSoforFajlok sofor_id={sofor.id} />}
          </div>
        </div>
      )}
    </div>
  );
}

CardSoforok.propTypes = {
  initSofor: PropTypes.object,
};
