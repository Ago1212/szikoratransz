import React, { useEffect, useState } from "react";
import { fetchAction } from "utils/fetchAction";
import { format } from "date-fns";

export default function CardTableForEsemenyek({ id }) {
  const [esemenyek, setEsemenyek] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [currentEsemeny, setCurrentEsemeny] = useState(null);
  const [formData, setFormData] = useState({
    leiras: "",
    datum: format(new Date(), "yyyy-MM-dd"),
  });

  const storedUserData = sessionStorage.getItem("user");
  const admin = storedUserData ? JSON.parse(storedUserData).id : "0";

  const fetchEsemenyek = async () => {
    const result = await fetchAction("getEgyediHataridok", { id });
    if (result && result.success) {
      setEsemenyek(result.esemenyek);
    } else {
      alert(result.message || "Események betöltése sikertelen.");
    }
  };

  useEffect(() => {
    fetchEsemenyek();
  }, [id]);

  const handleEsemenyDelete = async (esemeny_id) => {
    const confirmed = window.confirm(
      "Biztosan törölni szeretné ezt az eseményt?"
    );
    if (!confirmed) return;

    const result = await fetchAction("deleteEgyediHatarido", {
      id: esemeny_id,
    });
    if (result && result.success) {
      fetchEsemenyek();
    } else {
      alert(result.message || "Hiba történt a törlés során");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const action = currentEsemeny
      ? "updateEgyediHatarido"
      : "createEgyediHatarido";
    const data = currentEsemeny
      ? { ...formData, id: currentEsemeny.sorszam }
      : { ...formData, id: id };

    const result = await fetchAction(action, data);
    if (result && result.success) {
      fetchEsemenyek();
      setShowDialog(false);
      setCurrentEsemeny(null);
      setFormData({ leiras: "", datum: format(new Date(), "yyyy-MM-dd") });
    } else {
      alert(result.message || "Hiba történt a művelet során");
    }
  };

  const openEditDialog = (esemeny) => {
    setCurrentEsemeny(esemeny);
    setFormData({
      leiras: esemeny.leiras,
      datum: esemeny.datum,
    });
    setShowDialog(true);
  };

  return (
    <>
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white">
        <div className="rounded-t mb-0 px-4 py-3 border-0">
          <div className="flex flex-wrap items-center">
            <div className="relative w-full px-4 max-w-full flex-grow flex-1">
              <div className="text-center flex justify-between">
                <h3 className="font-semibold text-lg text-blueGray-700">
                  Események
                </h3>
                <button
                  onClick={() => setShowDialog(true)}
                  className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150 cursor-pointer"
                >
                  Új esemény
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="block w-full overflow-x-auto">
          <table className="items-center w-full bg-transparent border-collapse">
            <thead>
              <tr>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-center bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Műveletek
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Esemény
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Dátum
                </th>
              </tr>
            </thead>
            <tbody>
              {esemenyek.map((esemeny, index) => (
                <tr key={index}>
                  <td className="border-t-0 px-6 border-l-0 border-r-0 whitespace-nowrap p-4 align-middle">
                    <i
                      className="fas fa-edit cursor-pointer text-yellow-500 hover:text-yellow-700 transition transform hover:scale-110 mr-4"
                      onClick={() => openEditDialog(esemeny)}
                      title="Szerkesztés"
                    ></i>
                    <i
                      className="fa-solid fa-trash-can cursor-pointer text-red-500 hover:text-red-700 transition transform hover:scale-110"
                      onClick={() => handleEsemenyDelete(esemeny.sorszam)}
                      title="Törlés"
                    ></i>
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {esemeny.leiras}
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {esemeny.datum}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog modal */}
      {showDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {currentEsemeny
                ? "Esemény szerkesztése"
                : "Új esemény létrehozása"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="leiras"
                >
                  Leírás
                </label>
                <input
                  type="text"
                  id="leiras"
                  name="leiras"
                  value={formData.leiras}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>

              <div className="mb-6">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="datum"
                >
                  Dátum
                </label>
                <input
                  type="date"
                  id="datum"
                  name="datum"
                  value={formData.datum}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDialog(false);
                    setCurrentEsemeny(null);
                    setFormData({
                      leiras: "",
                      datum: format(new Date(), "yyyy-MM-dd"),
                    });
                  }}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="bg-lightBlue-500 hover:bg-lightBlue-700 text-white font-bold py-2 px-4 rounded"
                >
                  {currentEsemeny ? "Mentés" : "Létrehozás"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
