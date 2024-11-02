import React, { useState } from "react";
import CardJarmuAdatokForm from "./CardJarmuAdatokForm";
import CardJarmuEsemenyekForm from "./CardJarmuEsemenyekForm";
import CardJarmuFajlok from "./CardJarmuFajlok";

export default function CardKamion() {
  const [activeTab, setActiveTab] = useState(1);

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
              >
                Mentés
              </button>
            )}
          </div>
        </div>

        <div className="flex-auto px-4 lg:px-10 py-10 pt-0">
          {activeTab === 1 && <CardJarmuAdatokForm />}
          {activeTab === 2 && <CardJarmuEsemenyekForm />}
          {activeTab === 3 && <CardJarmuFajlok />}
        </div>
      </div>
    </>
  );
}
