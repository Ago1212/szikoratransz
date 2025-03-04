import React, { useState ,useEffect} from "react";
import CardJarmuAdatokForm from "./CardJarmuAdatokForm";
import CardJarmuEsemenyekForm from "./CardJarmuEsemenyekForm";
import CardJarmuFajlok from "./CardJarmuFajlok";
import { fetchAction } from "utils/fetchAction";

export default function CardKamion({initialKamion}) {
  const [kamion, setKamion] = useState(initialKamion || {});
  const [activeTab, setActiveTab] = useState(1);
  const [formData, setFormData] = useState({
    id: kamion.id || '',
    rendszam: kamion.rendszam || '',
    potkocsi: kamion.potkocsi || '',
    muszaki_lejarat: kamion.muszaki_lejarat || '',
    adr_lejarat: kamion.adr_lejarat || '',
    taograf_illesztes: kamion.taograf_illesztes || '',
    emelohatfal_vizsga: kamion.emelohatfal_vizsga || '',
    porolto_lejarat: kamion.porolto_lejarat || '',
    porolto_lejarat_2: kamion.porolto_lejarat_2 || '',
    kot_biztositas: kamion.kot_biztositas || '',
    kot_biz_dij: kamion.kot_biz_dij || '',
    kot_biz_utem: kamion.kot_biz_utem || '',
    kaszko_biztositas: kamion.kaszko_biztositas || '',
    kaszko_dij: kamion.kaszko_dij || '',
    kaszko_fizetesi_utem: kamion.kaszko_fizetesi_utem || '',
  });
  const handleSave = async () => {
    const storedUserData = JSON.parse(sessionStorage.getItem("user"));
    const action = formData.id ? "saveKamionData" : "newKamion";
    const result = await fetchAction(action, { admin: storedUserData.id, ...formData });
    if (result && result.success && action === "newKamion") {
      alert("Új kamion rögzítése sikeres!");
      
      setKamion(result.kamion); 
      setFormData({ ...formData, id: result.kamion.id });
    }else if(result && result.success){
      alert("Mentés sikeres!");
    } else {
      alert(result.message || "Mentés sikertelen.");
    }
  };
  if (Object.keys(kamion).length === 0) {
    return <>
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-blueGray-100 border-0">
        <div className="rounded-t bg-white mb-0 px-6 py-6">
          <div className="flex justify-between items-center">
          <h6 className="text-blueGray-700 text-xl font-bold">Kamion</h6>
              <button
                className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                type="button"
                onClick={handleSave}
              >
                Új kamion rögzítése
              </button>
          </div>
        </div>

        <div className="flex-auto px-4 lg:px-10 py-10 pt-0">
          <CardJarmuAdatokForm kamion={formData} setFormData ={setFormData} handleSave={handleSave}/>
        </div>
      </div>
    </>
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
                  Kamion adatok
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
          {activeTab === 1 && <CardJarmuAdatokForm kamion={formData} setFormData ={setFormData} handleSave={handleSave}/>}
          {activeTab === 2 && <CardJarmuEsemenyekForm kamion_id={kamion.id}/>}
          {activeTab === 3 && <CardJarmuFajlok kamion_id={kamion.id}/>}
        </div>
      </div>
    </>
  );
}
