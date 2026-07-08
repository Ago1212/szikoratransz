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
      <div className="mx-auto w-full max-w-7xl">
        <div className="w-full">
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-100">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
              Kamion kiválasztása
            </h3>
            <select
              className="w-full rounded-xl border border-ink-100 bg-sand-50 px-4 py-3 text-sm text-brand-900 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
