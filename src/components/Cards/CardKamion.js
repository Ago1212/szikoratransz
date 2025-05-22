import React, { useState } from "react";
import { FaTruck, FaTools, FaFileAlt, FaSave } from "react-icons/fa";
import CardJarmuAdatokForm from "./CardJarmuAdatokForm";
import CardJarmuEsemenyekForm from "./CardJarmuEsemenyekForm";
import CardJarmuFajlok from "./CardJarmuFajlok";
import { fetchAction } from "utils/fetchAction";

export default function CardKamion({ initialKamion }) {
  const [kamion, setKamion] = useState(initialKamion || {});
  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: kamion.id || "",
    rendszam: kamion.rendszam || "",
    // ... other fields ...
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const storedUserData = JSON.parse(sessionStorage.getItem("user"));
      const action = formData.id ? "saveKamionData" : "newKamion";
      const result = await fetchAction(action, {
        admin: storedUserData.id,
        ...formData,
      });

      if (result?.success) {
        if (action === "newKamion") {
          alert("Új kamion rögzítése sikeres!");
          setKamion(result.kamion);
          setFormData({ ...formData, id: result.kamion.id });
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

  if (Object.keys(kamion).length === 0) {
    return (
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-0">
        {/* Header */}
        <div className="rounded-t-lg bg-blue-600 mb-0 px-6 py-4">
          <div className="flex justify-between items-center">
            <h6 className="text-white text-xl font-bold flex items-center">
              <FaTruck className="mr-2" />
              Új kamion
            </h6>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`bg-white text-blue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150 flex items-center ${
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
                  Kamion rögzítése
                </>
              )}
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-auto px-4 lg:px-8 py-6">
          <CardJarmuAdatokForm
            kamion={formData}
            setFormData={setFormData}
            handleSave={handleSave}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-0">
      {/* Header with Tabs */}
      <div className="rounded-t-lg bg-blue-600 mb-0 px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Tabs */}
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab(1)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                activeTab === 1
                  ? "bg-white text-blue-600"
                  : "text-blue-100 hover:bg-blue-500 hover:text-white"
              }`}
            >
              <FaTruck className="mr-2" />
              Kamion adatok
            </button>
            <button
              onClick={() => setActiveTab(2)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                activeTab === 2
                  ? "bg-white text-blue-600"
                  : "text-blue-100 hover:bg-blue-500 hover:text-white"
              }`}
            >
              <FaTools className="mr-2" />
              Karbantartások
            </button>
            <button
              onClick={() => setActiveTab(3)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                activeTab === 3
                  ? "bg-white text-blue-600"
                  : "text-blue-100 hover:bg-blue-500 hover:text-white"
              }`}
            >
              <FaFileAlt className="mr-2" />
              Fájlok
            </button>
          </div>

          {/* Save button */}
          {activeTab === 1 && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`bg-white text-blue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150 flex items-center ${
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
                  Mentés
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-auto px-4 lg:px-8 py-6">
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
  );
}
