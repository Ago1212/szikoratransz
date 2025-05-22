import React, { useState, useEffect } from "react";
import { FaTruck, FaTools, FaFileAlt, FaSave } from "react-icons/fa";
import { fetchAction } from "utils/fetchAction";
import CardPotkocsiAdatokForm from "./CardPotkocsiAdatokForm";
import CardPotkocsiEsemenyekForm from "./CardPotkocsiEsemenyekForm";
import CardPotkocsiFajlok from "./CardPotkocsiFajlok";
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

const CardPotkocsi = ({ initialPotkocsi }) => {
  const [potkocsi, setPotkocsi] = useState(initialPotkocsi || {});
  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    rendszam: "",
    tipus: "",
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
    setIsSaving(true);
    try {
      const storedUserData = JSON.parse(sessionStorage.getItem("user"));
      const action = formData.id ? "savePotkocsiData" : "newPotkocsi";
      const result = await fetchAction(action, {
        admin: storedUserData.id,
        ...formData,
      });

      if (result?.success) {
        if (action === "newPotkocsi") {
          alert("Új pótkocsi rögzítése sikeres!");
          setPotkocsi(result.potkocsi);
          setFormData({ ...formData, id: result.potkocsi.id });
        } else {
          alert("Mentés sikeres!");
        }
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (Object.keys(potkocsi).length === 0) {
    return (
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-0">
        {/* Fejléc */}
        <div className="rounded-t-lg bg-blue-600 mb-0 px-6 py-4">
          <div className="flex justify-between items-center">
            <h6 className="text-white text-xl font-bold flex items-center">
              <FaTruck className="mr-2" />
              Új pótkocsi
            </h6>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`bg-white text-blue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 flex items-center ${
                isSaving ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {isSaving ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Mentés...
                </>
              ) : (
                <>
                  <FaSave className="mr-1" />
                  Pótkocsi rögzítése
                </>
              )}
            </button>
          </div>
        </div>

        {/* Űrlap */}
        <div className="flex-auto px-4 lg:px-8 py-6">
          <CardPotkocsiAdatokForm
            potkocsi={formData}
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
              <span className="text-base font-bold">Pótkocsi adatok</span>
            </button>
            <button
              onClick={() => setActiveTab(2)}
              className={`px-6 py-3 font-semibold text-sm rounded-md transition-all duration-300 focus:outline-none ${
                activeTab === 2
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-blueGray-200 text-blueGray-600 hover:bg-blueGray-300"
              }`}
            >
              <span className="text-base font-bold">Karbantartások</span>
            </button>
            <button
              onClick={() => setActiveTab(3)}
              className={`px-6 py-3 font-semibold text-sm rounded-md transition-all duration-300 focus:outline-none ${
                activeTab === 3
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

      {/* Tartalom */}
      <div className="flex-auto px-4 lg:px-8 py-6">
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
  );
};

export default CardPotkocsi;
