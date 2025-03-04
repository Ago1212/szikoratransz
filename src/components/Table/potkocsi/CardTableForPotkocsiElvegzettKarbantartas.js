import React, { useState, useEffect } from "react";
import { fetchAction } from "utils/fetchAction";

export default function CardTableForPotkocsiElvegzettKarbantartas({
  potkocsi_id,
  refresh,
  onRefresh,
}) {
  const [karbantartasok, setKarbantartasok] = useState([]);
  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getPotkocsiKarbantartas", {
      potkocsi_id: potkocsi_id,
      elvegzett: true,
    });
    if (result && result.success) {
      setKarbantartasok(result.karbantartas);
    } else {
      alert(result.message || "Karbantartások betöltése sikertelen.");
    }
  };
  useEffect(() => {
    fetchKarbantartasok();
  }, [potkocsi_id, refresh]);

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setPotkocsiKarbantartasKesz", {
      id: karbantartasId,
      elvegzett: false,
    });
    if (result && result.success) {
      fetchKarbantartasok(); // Frissíti a listát
      onRefresh();
    } else {
      alert(result.message || "Hiba történt a státusz frissítésekor.");
    }
  };
  const handleKarbantartasDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Biztosan törölni szeretnéd a karbantartást?"
    );
    if (!confirmDelete) {
      return; // Ha nem erősíti meg, kilépünk a függvényből
    }

    try {
      // API hívás törléshez
      const result = await fetchAction("deletePotkocsiKarbantartas", { id });

      if (result && result.success) {
        alert("A karbantartás sikeresen törölve.");
        fetchKarbantartasok(); // Frissíti a listát
      } else {
        alert(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };
  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white">
      <div className="block w-full overflow-x-auto">
        {/* Table */}
        <table className="items-center w-full bg-transparent border-collapse">
          <thead>
            <tr>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-center bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                Műveletek
              </th>
              <th
                key="leiras"
                className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100"
              >
                Elvégzett karbantartás
              </th>
              <th
                key="datum"
                className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100"
              >
                Dátum
              </th>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100"></th>
            </tr>
          </thead>
          <tbody>
            {karbantartasok.map((karbantartas) => (
              <tr key={karbantartas.id}>
                <td className="border-t-0 px-6 border-l-0 border-r-0 whitespace-nowrap p-4 align-middle">
                  <i
                    className="fa-solid fa-trash-can cursor-pointer text-red-500 hover:text-red-700 transition transform hover:scale-110"
                    onClick={() => handleKarbantartasDelete(karbantartas.id)}
                    title="Delete"
                  ></i>
                </td>

                <td className="border-t-0 px-6 border-l-0 border-r-0 text-xs whitespace-normal break-words max-w-xs p-4 align-middle">
                  {karbantartas.log}
                </td>

                <td className="border-t-0 px-6 border-l-0 border-r-0 text-xs whitespace-nowrap p-4 align-middle">
                  {karbantartas.datum}
                </td>
                <td className="border-t-0 px-6 border-l-0 border-r-0 whitespace-nowrap p-4 align-middle">
                  <i
                    className="fa-solid fa-angles-left cursor-pointer"
                    onClick={() => handleSetKarbantartasKesz(karbantartas.id)}
                  ></i>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
