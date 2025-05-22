import React, { useState } from "react";
import PropTypes from "prop-types";
import { FaSave } from "react-icons/fa";
import { fetchAction } from "utils/fetchAction";
import CardSoforAdatokForm from "./CardSoforAdatokForm";
import CardSoforFajlok from "./CardSoforFajlok";

const ActionButton = ({ onClick, children, className = "", icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`bg-blue-500 text-white font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 flex items-center ${className}`}
  >
    {icon && <span className="mr-2">{icon}</span>}
    {children}
  </button>
);

export default function CardSoforok({ initSofor }) {
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
  });

  const handleSave = async () => {
    const storedUserData = JSON.parse(sessionStorage.getItem("user"));
    const action = formData.id ? "saveSoforData" : "newSofor";
    const result = await fetchAction(action, {
      admin: storedUserData.id,
      ...formData,
    });

    if (result?.success) {
      if (action === "newSofor") {
        alert("Új sofőr rögzítése sikeres!");
        setSofor(result.sofor);
        setFormData({ ...formData, id: result.sofor.id });
      } else {
        alert("Mentés sikeres!");
      }
    } else {
      alert(result?.message || "Mentés sikertelen.");
    }
  };

  if (Object.keys(sofor).length === 0) {
    return (
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white border-0">
        <div className="rounded-t bg-white mb-0 px-6 py-6">
          <div className="flex justify-between items-center">
            <h6 className="text-blueGray-700 text-xl font-bold">Sofőr</h6>
            <ActionButton onClick={handleSave} icon={<FaSave />}>
              Új sofőr rögzítése
            </ActionButton>
          </div>
        </div>

        <div className="flex-auto px-4 lg:px-10 py-10 pt-0">
          <CardSoforAdatokForm
            sofor={formData}
            setFormData={setFormData}
            handleSave={handleSave}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white border-0">
      <div className="rounded-t bg-white mb-0 px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab(1)}
              className={`px-6 py-3 font-semibold text-sm rounded-md transition-all duration-300 focus:outline-none ${
                activeTab === 1
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-blueGray-200 text-blueGray-600 hover:bg-blueGray-300"
              }`}
            >
              <span className="text-base font-bold">Sofőr adatok</span>
            </button>
            <button
              onClick={() => setActiveTab(2)}
              className={`px-6 py-3 font-semibold text-sm rounded-md transition-all duration-300 focus:outline-none ${
                activeTab === 2
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-blueGray-200 text-blueGray-600 hover:bg-blueGray-300"
              }`}
            >
              <span className="text-base font-bold">Fájlok</span>
            </button>
          </div>

          {activeTab === 1 && (
            <ActionButton onClick={handleSave} icon={<FaSave />}>
              Mentés
            </ActionButton>
          )}
        </div>
      </div>

      <div className="flex-auto px-4 lg:px-10 py-10 pt-0">
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
  );
}

CardSoforok.propTypes = {
  initSofor: PropTypes.object,
};
