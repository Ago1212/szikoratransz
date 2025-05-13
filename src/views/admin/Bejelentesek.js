import React, { useState, useEffect } from "react";
// components
import { fetchAction } from "utils/fetchAction";
import CardTable from "components/Table/CardTableForBejelentesek.js";

export default function Bejelentesek() {
  const [bejelentesek, setBejelentesek] = useState([]);
  const [kamionok, setKamionok] = useState([]);
  const [selectedKamion, setSelectedKamion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Kamionok betöltése az elején
  useEffect(() => {
    const fetchKamionok = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getKamionValaszto", { user: user.id });
      if (result.success) {
        setKamionok(result.kamionok || []);
      }
    };
    fetchKamionok();
  }, []);

  // Bejelentések betöltése amikor kiválasztunk egy kamiont
  useEffect(() => {
    if (selectedKamion) {
      const fetchData = async () => {
        setIsLoading(true);
        const result = await fetchAction("getBejelentesek", {
          kamion: selectedKamion,
        });
        if (result.success) {
          setBejelentesek(result.bejelentesek || []);
        } else {
          setBejelentesek([]);
          console.error("Error fetching stats:", result.message);
        }
        setIsLoading(false);
      };
      fetchData();
    } else {
      setBejelentesek([]);
    }
  }, [selectedKamion]);

  const handleKamionChange = (event) => {
    setSelectedKamion(event.target.value);
  };

  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
          <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white">
            <div className="rounded-t mb-0 px-4 py-3 border-0">
              <div className="flex flex-wrap items-center">
                <div className="relative w-full px-4 max-w-full flex-grow flex-1">
                  <h3 className="font-semibold text-lg text-blueGray-700">
                    Kamion kiválasztása
                  </h3>
                  <select
                    className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
                    value={selectedKamion}
                    onChange={handleKamionChange}
                  >
                    <option value="">Válassz kamiont...</option>
                    {kamionok.map((kamion) => (
                      <option key={kamion.id} value={kamion.id}>
                        {kamion.rendszam}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {selectedKamion && (
            <CardTable
              bejelentesek={bejelentesek}
              isLoading={isLoading}
              selectedKamion={selectedKamion}
            />
          )}
        </div>
      </div>
    </>
  );
}
