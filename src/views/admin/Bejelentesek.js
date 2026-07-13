import React, { useState, useEffect } from "react";
// components
import { fetchAction } from "utils/fetchAction";
import CardTable from "components/Table/CardTableForBejelentesek.js";

export default function Bejelentesek() {
  const [bejelentesek, setBejelentesek] = useState([]);
  const [kamionok, setKamionok] = useState([]);
  const [selectedKamion, setSelectedKamion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Kamionok betöltése az elején — a legördülő mostantól csak EGY OPCIONÁLIS
  // szűrő, nem előfeltétele a bejelentések megtekintésének (korábban addig
  // semmi nem látszott, amíg nem választottak kamiont).
  useEffect(() => {
    const fetchKamionok = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getKamionValaszto", { ceg_id: user.ceg_id });
      if (result.success) {
        setKamionok(result.kamionok || []);
      }
    };
    fetchKamionok();
  }, []);

  // Bejelentések betöltése — alapból a cég ÖSSZES bejelentése, a
  // `selectedKamion` csak további szűkítés, ha az admin be akarja határolni
  // egy adott járműre.
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getBejelentesek", {
        ceg_id: user.ceg_id,
        kamion: selectedKamion || undefined,
        kerelmezo_id: user.id,
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
              Szűrés kamionra (opcionális)
            </h3>
            <select
              className="w-full rounded-xl border border-ink-100 bg-slate-50 px-4 py-3 text-sm text-brand-900 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={selectedKamion}
              onChange={handleKamionChange}
            >
              <option value="">Összes kamion</option>
              {kamionok.map((kamion) => (
                <option key={kamion.id} value={kamion.id}>
                  {kamion.rendszam}
                </option>
              ))}
            </select>
          </div>

          <CardTable
            bejelentesek={bejelentesek}
            isLoading={isLoading}
            selectedKamion={selectedKamion}
          />
        </div>
      </div>
    </>
  );
}
