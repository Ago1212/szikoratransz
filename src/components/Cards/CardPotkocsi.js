import React, { useState } from "react";
import CardPotkocsiEsemenyekForm from "./CardPotkocsiEsemenyekForm";
import CardPotkocsiFajlok from "./CardPotkocsiFajlok";
import { fetchAction } from "utils/fetchAction";
import CardPotkocsiAdatokForm from "./CardPotkocsiAdatokForm";

export default function CardPotkocsi({ initialPotkocsi }) {
  const [potkocsi, setPotkocsi] = useState(initialPotkocsi || {});
  const [activeTab, setActiveTab] = useState(1);
  const [formData, setFormData] = useState({
    id: potkocsi.id || "",
    rendszam: potkocsi.rendszam || "",
    tipus: potkocsi.tipus || "",
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

  const handleSave = async () => {
    const storedUserData = JSON.parse(sessionStorage.getItem("user"));
    const action = formData.id ? "savePotkocsiData" : "newPotkocsi";
    const result = await fetchAction(action, {
      admin: storedUserData.id,
      ...formData,
    });
    if (result && result.success && action === "newPotkocsi") {
      alert("Új pótkocsi rögzítése sikeres!");

      setPotkocsi(result.potkocsi);
      setFormData({ ...formData, id: result.potkocsi.id });
    } else if (result && result.success) {
      alert("Mentés sikeres!");
    } else {
      alert(result.message || "Mentés sikertelen.");
    }
  };
  if (Object.keys(potkocsi).length === 0) {
    return (
      <>
        <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-blueGray-100 border-0">
          <div className="rounded-t bg-white mb-0 px-6 py-6">
            <div className="flex justify-between items-center">
              <h6 className="text-blueGray-700 text-xl font-bold">Pótkocsi</h6>
              <button
                className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                type="button"
                onClick={handleSave}
              >
                Új pótkocsi rögzítése
              </button>
            </div>
          </div>

          <div className="flex-auto px-4 lg:px-10 py-10 pt-0">
            <CardPotkocsiAdatokForm
              potkocsi={formData}
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
                  Pótkocsi adatok
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
                <h6 className="text-blueGray-700 text-xl font-bold">
                  Karbantartások
                </h6>
              </button>
              <button
                onClick={() => setActiveTab(3)}
                className={`px-6 py-2 font-semibold text-sm rounded-t-md transition-all duration-300 focus:outline-none ${
                  activeTab === 3
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
    </>
  );
}
