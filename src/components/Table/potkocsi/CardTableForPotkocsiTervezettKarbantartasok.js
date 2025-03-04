import React, { useRef, useState, useEffect } from "react";
import { fetchAction } from "utils/fetchAction";

export default function CardTableForPotkocsiTervezettKarbantartasok({
  potkocsi_id,
  refresh,
  onRefresh,
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [karbantartasok, setKarbantartasok] = useState([]);
  const [selectedKarbantartas, setSelectedKarbantartas] = useState(null);
  const dialogRef = useRef(null);

  const handleAddClick = () => {
    setSelectedKarbantartas(null); // Új hozzáadás esetén nincs kiválasztott elem
    setOpenDialog(true);
  };

  const handleEditClick = (karbantartas) => {
    setSelectedKarbantartas(karbantartas); // Kiválasztott elem beállítása
    setOpenDialog(true);
  };

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setPotkocsiKarbantartasKesz", {
      id: karbantartasId,
      elvegzett: true,
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

  const handleCloseDialog = () => setOpenDialog(false);

  const handleSave = async () => {
    const dataToSave = {
      id: selectedKarbantartas?.id,
      datum: selectedKarbantartas?.datum,
      log: selectedKarbantartas?.log,
      potkocsi_id: potkocsi_id,
    };

    const result = await fetchAction("updatePotkocsiKarbantartas", dataToSave);

    if (result && result.success) {
      fetchKarbantartasok(); // Újrarenderelés friss adatokkal
      handleCloseDialog();
    } else {
      alert(result.message || "Módosítás sikertelen.");
    }
  };

  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getPotkocsiKarbantartas", {
      potkocsi_id: potkocsi_id,
      elvegzett: false,
    });
    if (result && result.success) {
      setKarbantartasok(result.karbantartas);
    } else {
      alert(result.message || "Karbantartások betöltése sikertelen.");
    }
  };

  useEffect(() => {
    fetchKarbantartasok();

    if (openDialog) {
      dialogRef.current.showModal();
    } else {
      dialogRef.current.close();
    }
  }, [openDialog, potkocsi_id, refresh]);

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white">
      <div className="block w-full overflow-x-auto">
        <table className="items-center w-full bg-transparent border-collapse">
          <thead>
            <tr>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-center bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                Műveletek
              </th>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-center bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                Tervezett karbantartás
              </th>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                Dátum
              </th>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-right bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                <button
                  className="bg-lightBlue-500 text-white font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={handleAddClick}
                >
                  Új
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {karbantartasok.map((karbantartas) => (
              <tr key={karbantartas.id}>
                <td className="border-t-0 px-6 border-l-0 border-r-0 whitespace-nowrap p-4 align-middle">
                  <i
                    className="fa-solid fa-file-pen cursor-pointer text-blue-500 hover:text-blue-700 transition transform hover:scale-110 mr-4"
                    onClick={() => handleEditClick(karbantartas)}
                    title="Edit"
                  ></i>
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
                    className="fa-solid fa-angles-right cursor-pointer"
                    onClick={() => handleSetKarbantartasKesz(karbantartas.id)}
                  ></i>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dialog
        ref={dialogRef}
        className="relative rounded-lg bg-white shadow-xl p-6"
        onClose={handleCloseDialog}
      >
        <button
          type="button"
          onClick={() => dialogRef.current.close()}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          style={{ right: "0.5rem", top: "1rem" }}
        >
          &#x2715;
        </button>

        <h3 className="text-base font-semibold text-gray-900 mb-4">
          {selectedKarbantartas ? "Karbantartás Módosítása" : "Új Karbantartás"}
        </h3>

        <label className="block text-sm font-medium mb-1">Dátum</label>
        <input
          type="date"
          value={selectedKarbantartas?.datum || ""}
          onChange={(e) =>
            setSelectedKarbantartas({
              ...selectedKarbantartas,
              datum: e.target.value,
            })
          }
          className="border border-gray-300 px-3 py-2 mb-4 w-full rounded-md focus:outline-none focus:ring focus:ring-blue-500"
        />

        <label className="block text-sm font-medium mb-1">
          Tervezett karbantartás
        </label>
        <textarea
          value={selectedKarbantartas?.log || ""}
          onChange={(e) =>
            setSelectedKarbantartas({
              ...selectedKarbantartas,
              log: e.target.value,
            })
          }
          className="border border-gray-300 px-3 py-2 mb-4 w-full rounded-md focus:outline-none focus:ring focus:ring-blue-500"
          placeholder="Leírás..."
          rows="5"
        />

        <div className="flex justify-between items-center mt-4">
          {/* Törlés gomb balra igazítva */}

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex rounded-md bg-lightBlue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"
          >
            Mentés
          </button>
        </div>
      </dialog>
    </div>
  );
}
