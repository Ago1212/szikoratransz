import React, { useState, useEffect } from "react";
import {
  FaFilter,
  FaPlus,
  FaEdit,
  FaTrash,
  FaArrowRight,
  FaArrowLeft,
  FaTimes,
} from "react-icons/fa";
import { fetchAction } from "utils/fetchAction";

const Karbantartasok = () => {
  return <div>Folyamatban...</div>;
};
/* const [karbantartasok, setKarbantartasok] = useState([]);
  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [filter, setFilter] = useState({
    kamion_id: "",
    potkocsi_id: "",
    elvegzett: "",
    datumTol: "",
    datumIg: "",
  });
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [openDialog, setOpenDialog] = useState(false);
  const [newKarbantartas, setNewKarbantartas] = useState({
    id: user.id,
    kamion_id: "",
    potkocsi_id: "",
    datum: "",
    log: "",
    elvegzett: false,
  });

  // Kamionok és pótkocsik betöltése
  useEffect(() => {
    const fetchJarmuvek = async () => {
      // Kamionok betöltése
      const kamionResult = await fetchAction("getKamionRendszamok", {
        id: user.id,
      });
      if (kamionResult?.success) {
        setKamionok(kamionResult.kamionok);
      }

      // Pótkocsik betöltése
      const potkocsiResult = await fetchAction("getPotkocsiRendszamok", {
        id: user.id,
      });
      if (potkocsiResult?.success) {
        setPotkocsik(potkocsiResult.potkocsik);
      }
    };

    fetchJarmuvek();
  }, [user.id]);

  // Karbantartások betöltése szűréssel
  useEffect(() => {
    const fetchKarbantartasok = async () => {
      const result = await fetchAction("getKarbantartasok", {
        id: user.id,
        ...filter,
      });
      if (result?.success) {
        setKarbantartasok(result.karbantartasok);
      }
    };
    fetchKarbantartasok();
  }, [filter, user.id]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewKarbantartasChange = (e) => {
    const { name, value } = e.target;
    setNewKarbantartas((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddKarbantartas = async (e) => {
    e.preventDefault();
    const result = await fetchAction("addKarbantartas", newKarbantartas);
    if (result?.success) {
      setOpenDialog(false);
      setNewKarbantartas({
        id: user.id,
        kamion_id: "",
        potkocsi_id: "",
        datum: "",
        log: "",
        elvegzett: false,
      });
      // Frissítjük a listát az aktuális szűrőkkel
      const updatedResult = await fetchAction("getKarbantartasok", {
        id: user.id,
        ...filter,
      });
      if (updatedResult?.success) {
        setKarbantartasok(updatedResult.karbantartasok);
      }
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    const result = await fetchAction("setKarbantartasKesz", {
      id,
      elvegzett: !currentStatus,
    });
    if (result?.success) {
      const updatedResult = await fetchAction("getKarbantartasok", {
        id: user.id,
        ...filter,
      });
      if (updatedResult?.success) {
        setKarbantartasok(updatedResult.karbantartasok);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Biztosan törölni szeretnéd a karbantartást?")) {
      const result = await fetchAction("deleteKarbantartas", { id });
      if (result?.success) {
        const updatedResult = await fetchAction("getKarbantartasok", {
          id: user.id,
          ...filter,
        });
        if (updatedResult?.success) {
          setKarbantartasok(updatedResult.karbantartasok);
        }
      }
    }
  };

  // Jármű megjelenítése rendszám alapján
  const getJarmuRendszam = (id, isPotkocsi = false) => {
    const jarmuLista = isPotkocsi ? potkocsik : kamionok;
    const jarmu = jarmuLista.find((j) => j.id === id);
    return jarmu ? `${jarmu.rendszam} (${jarmu.tipus})` : "Ismeretlen";
  };

  return (
    <div className="mx-auto py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Karbantartások Kezelése</h1>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="flex items-center mb-4">
            <FaFilter className="mr-2" />
            <h2 className="text-lg font-semibold">Szűrők</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kamion
              </label>
              <select
                name="kamion_id"
                value={filter.kamion_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Összes kamion</option>
                {kamionok.map((kamion) => (
                  <option key={kamion.id} value={kamion.id}>
                    {kamion.rendszam} ({kamion.tipus})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pótkocsi
              </label>
              <select
                name="potkocsi_id"
                value={filter.potkocsi_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Összes pótkocsi</option>
                {potkocsik.map((potkocsi) => (
                  <option key={potkocsi.id} value={potkocsi.id}>
                    {potkocsi.rendszam} ({potkocsi.tipus})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Státusz
              </label>
              <select
                name="elvegzett"
                value={filter.elvegzett}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Összes</option>
                <option value="false">Tervezett</option>
                <option value="true">Elvégzett</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dátumtól
              </label>
              <input
                type="date"
                name="datumTol"
                value={filter.datumTol}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dátumig
              </label>
              <input
                type="date"
                name="datumIg"
                value={filter.datumIg}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Karbantartások listája</h2>
          <button
            onClick={() => setOpenDialog(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
          >
            <FaPlus className="mr-2" /> Új karbantartás
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jármű típusa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rendszám
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dátum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leírás
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Státusz
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {karbantartasok.length > 0 ? (
                karbantartasok.map((karb) => (
                  <tr key={karb.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {karb.potkocsi_id ? "Pótkocsi" : "Kamion"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {karb.potkocsi_id
                        ? getJarmuRendszam(karb.potkocsi_id, true)
                        : getJarmuRendszam(karb.kamion_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {karb.datum}
                    </td>
                    <td className="px-6 py-4">{karb.log}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          karb.elvegzett
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {karb.elvegzett ? "Elvégzett" : "Tervezett"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() =>
                            handleStatusChange(karb.id, karb.elvegzett)
                          }
                          className={`p-1 rounded-md ${
                            karb.elvegzett
                              ? "text-yellow-600 hover:bg-yellow-100"
                              : "text-green-600 hover:bg-green-100"
                          }`}
                          title={
                            karb.elvegzett
                              ? "Tervezettként jelöl"
                              : "Elvégzettként jelöl"
                          }
                        >
                          {karb.elvegzett ? <FaArrowLeft /> : <FaArrowRight />}
                        </button>
                        <button
                          onClick={() => handleDelete(karb.id)}
                          className="text-red-600 hover:bg-red-100 p-1 rounded-md"
                          title="Törlés"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Nincsenek megjeleníthető karbantartások
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Új karbantartás</h3>
              <button
                onClick={() => setOpenDialog(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleAddKarbantartas}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jármű típusa
                  </label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="jarmu_tipus"
                        value="kamion"
                        checked={!newKarbantartas.potkocsi_id}
                        onChange={() =>
                          setNewKarbantartas((prev) => ({
                            ...prev,
                            kamion_id: "",
                            potkocsi_id: "",
                          }))
                        }
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Kamion</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="jarmu_tipus"
                        value="potkocsi"
                        checked={!!newKarbantartas.potkocsi_id}
                        onChange={() =>
                          setNewKarbantartas((prev) => ({
                            ...prev,
                            kamion_id: "",
                            potkocsi_id: "",
                          }))
                        }
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Pótkocsi
                      </span>
                    </label>
                  </div>
                </div>

                {!newKarbantartas.potkocsi_id ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kamion
                    </label>
                    <select
                      name="kamion_id"
                      value={newKarbantartas.kamion_id}
                      onChange={handleNewKarbantartasChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required={!newKarbantartas.potkocsi_id}
                    >
                      <option value="">Válassz kamiont</option>
                      {kamionok.map((kamion) => (
                        <option key={kamion.id} value={kamion.id}>
                          {kamion.rendszam} ({kamion.tipus})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pótkocsi
                    </label>
                    <select
                      name="potkocsi_id"
                      value={newKarbantartas.potkocsi_id}
                      onChange={handleNewKarbantartasChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required={!!newKarbantartas.potkocsi_id}
                    >
                      <option value="">Válassz pótkocsit</option>
                      {potkocsik.map((potkocsi) => (
                        <option key={potkocsi.id} value={potkocsi.id}>
                          {potkocsi.rendszam} ({potkocsi.tipus})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dátum
                  </label>
                  <input
                    type="date"
                    name="datum"
                    value={newKarbantartas.datum}
                    onChange={handleNewKarbantartasChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leírás
                  </label>
                  <textarea
                    name="log"
                    value={newKarbantartas.log}
                    onChange={handleNewKarbantartasChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="4"
                    required
                  />
                </div>
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="elvegzett"
                      checked={newKarbantartas.elvegzett}
                      onChange={(e) =>
                        setNewKarbantartas((prev) => ({
                          ...prev,
                          elvegzett: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Elvégzett
                    </span>
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setOpenDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Mentés
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};*/

export default Karbantartasok;
