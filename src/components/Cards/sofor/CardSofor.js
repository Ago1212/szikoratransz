import React, { useState } from "react";
import { fetchAction } from "utils/fetchAction";
import CardSoforAdatokForm from "./CardSoforAdatokForm";
import CardSoforFajlok from "./CardSoforFajlok";

// components

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
  });

  const handleSave = async () => {
    const storedUserData = JSON.parse(sessionStorage.getItem("user"));
    const action = formData.id ? "saveSoforData" : "newSofor";
    const result = await fetchAction(action, {
      admin: storedUserData.id,
      ...formData,
    });
    if (result && result.success && action === "newKamion") {
      alert("Új sofőr rögzítése sikeres!");

      setSofor(result.sofor);
      setFormData({ ...formData, id: result.sofor.id });
    } else if (result && result.success) {
      alert("Mentés sikeres!");
    } else {
      alert(result.message || "Mentés sikertelen.");
    }
  };
  if (Object.keys(sofor).length === 0) {
    return (
      <>
        <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-blueGray-100 border-0">
          <div className="rounded-t bg-white mb-0 px-6 py-6">
            <div className="flex justify-between items-center">
              <h6 className="text-blueGray-700 text-xl font-bold">Sofőr</h6>
              <button
                className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                type="button"
                onClick={handleSave}
              >
                Új sofőr rögzítése
              </button>
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
      </>
    );
  }

  return (
    <>
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-blueGray-100 border-0">
        <div className="rounded-t bg-white mb-0 px-6 py-6">
          <div className="flex justify-between items-center">
            {/* Tabs */}
            <div className="flex justify-center pt-4 space-x-4">
              <button
                onClick={() => setActiveTab(1)}
                className={`px-6 py-2 font-semibold text-sm rounded-t-md transition-all duration-300 focus:outline-none ${
                  activeTab === 1
                    ? "bg-blue-500 text-white shadow-lg"
                    : "bg-blueGray-200 text-blueGray-600"
                }`}
              >
                <h6 className="text-blueGray-700 text-xl font-bold">
                  Sofőr adatok
                </h6>
              </button>
              <button
                onClick={() => setActiveTab(2)}
                className={`px-6 py-2 font-semibold text-sm rounded-t-md transition-all duration-300 focus:outline-none ${
                  activeTab === 2
                    ? "bg-blue-500 text-white shadow-lg"
                    : "bg-blueGray-200 text-blueGray-600"
                }`}
              >
                <h6 className="text-blueGray-700 text-xl font-bold">Fájlok</h6>
              </button>
            </div>

            {/* Save button, visible only when the first tab is active */}
            {activeTab === 1 && (
              <button
                className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                type="button"
                onClick={handleSave}
              >
                Mentés
              </button>
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
    </>
  );
}
