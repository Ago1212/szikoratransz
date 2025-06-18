import React, { useState, useEffect } from "react";
import {
  FaFilter,
  FaPlus,
  FaEdit,
  FaTrash,
  FaArrowRight,
  FaArrowLeft,
  FaTimes,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa";
import { fetchAction } from "utils/fetchAction";
import { useMediaQuery } from "react-responsive";
import { FiFile, FiTrash2, FiUpload } from "react-icons/fi";
import { downloadFileAction } from "utils/downloadFileAction";

const Karbantartasok = () => {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [karbantartasok, setKarbantartasok] = useState([]);
  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [filter, setFilter] = useState({
    kamion_id: "",
    potkocsi_id: "",
    datumTol: "",
    datumIg: "",
    elvegezte: "",
  });
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newKarbantartas, setNewKarbantartas] = useState({
    admin: user.id,
    kamion_id: "",
    potkocsi_id: "",
    datum: "",
    log: "",
    km_oraallas: "",
    elvegezte: "",
    kovetkezo_karbantartas: "",
  });
  const [jarmuTipus, setJarmuTipus] = useState("kamion");
  const [files, setFiles] = useState([]);
  const [isFileUploading, setIsFileUploading] = useState(false);

  const handleFileUpload = async (event, karbantartasId) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    // Check file sizes
    const oversizedFiles = selectedFiles.filter(
      (file) => file.size > 10 * 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      alert("Néhány fájl mérete túl nagy! Maximális megengedett méret: 10MB");
      return;
    }

    setIsFileUploading(true);

    try {
      const uploadPromises = selectedFiles.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64File = reader.result.split(",")[1];
            const result = await fetchAction("fileUpload", {
              admin: user.id,
              id: karbantartasId,
              tabla: "karbantartasok",
              file: base64File,
              name: file.name,
              size: file.size,
            });
            resolve(result?.success);
          };
          reader.readAsDataURL(file);
        });
      });

      const results = await Promise.all(uploadPromises);
      if (results.every(Boolean)) {
        await fetchFilesForKarbantartas(karbantartasId);
      } else {
        alert("Néhány fájl feltöltése sikertelen volt.");
      }
    } catch (error) {
      console.error("Fájl feltöltési hiba:", error);
      alert("Hiba történt a fájlok feltöltése során.");
    } finally {
      setIsFileUploading(false);
    }
  };

  const fetchFilesForKarbantartas = async (karbantartasId) => {
    try {
      const result = await fetchAction("getFiles", {
        id: karbantartasId,
        tabla: "karbantartasok",
      });
      if (result?.success) {
        setFiles((prev) => ({
          ...prev,
          [karbantartasId]: result.files || [],
        }));
      }
    } catch (error) {
      console.error("Hiba történt a fájlok betöltésekor:", error);
    }
  };

  const handleFileDelete = async (fileId, karbantartasId) => {
    if (!window.confirm("Biztosan törölni szeretné ezt a fájlt?")) return;

    try {
      const result = await fetchAction("deleteFile", { id: fileId });
      if (result?.success) {
        await fetchFilesForKarbantartas(karbantartasId);
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  // Media query to detect small screens
  const isSmallScreen = useMediaQuery({ maxWidth: 768 });

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
      result.karbantartasok.forEach(async (karb) => {
        await fetchFilesForKarbantartas(karb.id);
      });
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

  const resetForm = () => {
    setNewKarbantartas({
      admin: user.id,
      kamion_id: "",
      potkocsi_id: "",
      datum: "",
      log: "",
      km_oraallas: "",
      elvegezte: "",
      kovetkezo_karbantartas: "",
    });
    setEditingId(null);
    setJarmuTipus("kamion");
  };

  const handleEditKarbantartas = (karb) => {
    setEditingId(karb.id);
    setJarmuTipus(karb.potkocsi_id ? "potkocsi" : "kamion");
    setNewKarbantartas({
      admin: user.id,
      kamion_id: karb.kamion_id || "",
      potkocsi_id: karb.potkocsi_id || "",
      datum: karb.datum,
      log: karb.log,
      km_oraallas: karb.km_oraallas || "",
      elvegezte: karb.elvegezte || "",
      kovetkezo_karbantartas: karb.kovetkezo_karbantartas || "",
    });
    setOpenDialog(true);
  };

  const handleAddKarbantartas = async (e) => {
    e.preventDefault();
    const action =
      jarmuTipus === "kamion"
        ? "updateKarbantartas"
        : "updatePotkocsiKarbantartas";

    const data = {
      ...newKarbantartas,
      id: editingId || undefined,
    };

    const result = await fetchAction(action, data);
    if (result?.success) {
      setOpenDialog(false);
      resetForm();
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

  // Determine status based on kesz and date
  const getStatus = (karb) => {
    const today = new Date().toISOString().split("T")[0];
    if (karb.datum < today)
      return { text: "Kész", class: "bg-blue-100 text-blue-800" };
    return { text: "Tervezett", class: "bg-yellow-100 text-yellow-800" };
  };

  // Render file upload section
  const renderFileUpload = (karbantartasId) => (
    <div className="mt-4 p-3 border border-gray-200 rounded-lg">
      <div className="mb-2">
        <label className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
          <FiUpload className="mr-2" />
          Fájlok feltöltése
          <input
            type="file"
            className="hidden"
            onChange={(e) => handleFileUpload(e, karbantartasId)}
            multiple
          />
        </label>
      </div>
      <div className="space-y-2">
        {files[karbantartasId]?.map((file) => (
          <div
            key={file.sorszam}
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <div className="flex items-center">
              <FiFile className="mr-2 text-blue-500" />
              <span
                className="text-blue-600 hover:underline cursor-pointer"
                onClick={() => downloadFileAction(file.sorszam, file.filename)}
              >
                {file.filename}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFileDelete(file.sorszam, karbantartasId);
              }}
              className="text-red-500 hover:text-red-700"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // Render table row for large screens
  const renderTableRow = (karb) => {
    const status = getStatus(karb);
    return (
      <tr
        key={karb.id}
        className="hover:bg-gray-50 cursor-pointer"
        onDoubleClick={() => handleEditKarbantartas(karb)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          {karb.potkocsi_id ? "Pótkocsi" : "Kamion"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {karb.potkocsi_id
            ? getJarmuRendszam(karb.potkocsi_id, true)
            : getJarmuRendszam(karb.kamion_id)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">{karb.datum}</td>
        <td className="px-6 py-4">
          <div className="line-clamp-2">{karb.log}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">{karb.km_oraallas}</td>
        <td className="px-6 py-4 whitespace-nowrap">{karb.elvegezte}</td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}
          >
            {status.text}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => handleEditKarbantartas(karb)}
              className="text-blue-600 hover:bg-blue-100 p-1 rounded-md"
              title="Szerkesztés"
            >
              <FaEdit />
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
    );
  };

  // Render card for small screens
  const renderCard = (karb) => {
    const status = getStatus(karb);
    return (
      <div
        key={karb.id}
        className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200"
        onClick={() => handleEditKarbantartas(karb)}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold">
              {karb.potkocsi_id ? "Pótkocsi" : "Kamion"}
            </h3>
            <p className="text-sm text-gray-600">
              {karb.potkocsi_id
                ? getJarmuRendszam(karb.potkocsi_id, true)
                : getJarmuRendszam(karb.kamion_id)}
            </p>
          </div>
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}
          >
            {status.text}
          </span>
        </div>

        <div className="mb-2">
          <p className="text-sm font-medium text-gray-500">Dátum:</p>
          <p>{karb.datum}</p>
        </div>

        <div className="mb-2">
          <p className="text-sm font-medium text-gray-500">Leírás:</p>
          <p className="text-sm">{karb.log}</p>
        </div>

        <div className="mb-2">
          <p className="text-sm font-medium text-gray-500">Km óraállás:</p>
          <p className="text-sm">{karb.km_oraallas}</p>
        </div>

        <div className="mb-2">
          <p className="text-sm font-medium text-gray-500">Elvégezte:</p>
          <p className="text-sm">{karb.elvegezte}</p>
        </div>

        {karb.kovetkezo_karbantartas && (
          <div className="mb-2">
            <p className="text-sm font-medium text-gray-500">
              Következő karbantartás:
            </p>
            <p className="text-sm">{karb.kovetkezo_karbantartas}</p>
          </div>
        )}

        {renderFileUpload(karb.id)}
      </div>
    );
  };

  return (
    <div className="mx-auto py-8 h-full flex flex-col">
      <div className="bg-white rounded-lg shadow-md p-6 flex-grow flex flex-col">
        <h1 className="text-2xl font-bold mb-6">Karbantartások Kezelése</h1>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div
            className="flex items-center mb-4 cursor-pointer"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <FaFilter className="mr-2" />
            <h2 className="text-lg font-semibold">Szűrők</h2>
            <span className="ml-auto">
              {filtersOpen ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </div>

          {filtersOpen && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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
                    Elvégezte
                  </label>
                  <input
                    type="text"
                    name="elvegezte"
                    value={filter.elvegezte}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Keresés elvégzőre"
                  />
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
              <button
                onClick={() => {
                  setFilter({
                    kamion_id: "",
                    potkocsi_id: "",
                    datumTol: "",
                    datumIg: "",
                    elvegezte: "",
                  });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <FaTimes className="inline mr-1" /> Összes szűrő törlése
              </button>
            </>
          )}
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Karbantartások listája</h2>
          <button
            onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
          >
            <FaPlus className="mr-2" /> Új karbantartás
          </button>
        </div>

        {isSmallScreen ? (
          // Card view for small screens
          <div className="space-y-4">
            {karbantartasok.length > 0 ? (
              karbantartasok.map(renderCard)
            ) : (
              <div className="text-center text-gray-500 py-4">
                Nincsenek megjeleníthető karbantartások
              </div>
            )}
          </div>
        ) : (
          // Table view for larger screens
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
                    Km óraállás
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Elvégezte
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
                  karbantartasok.map(renderTableRow)
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
        )}
      </div>

      {openDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? "Karbantartás szerkesztése" : "Új karbantartás"}
              </h3>
              <button
                onClick={() => {
                  setOpenDialog(false);
                  resetForm();
                }}
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
                        checked={jarmuTipus === "kamion"}
                        onChange={() => {
                          setJarmuTipus("kamion");
                          setNewKarbantartas((prev) => ({
                            ...prev,
                            kamion_id: "",
                            potkocsi_id: null,
                          }));
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Kamion</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="jarmu_tipus"
                        value="potkocsi"
                        checked={jarmuTipus === "potkocsi"}
                        onChange={() => {
                          setJarmuTipus("potkocsi");
                          setNewKarbantartas((prev) => ({
                            ...prev,
                            kamion_id: null,
                            potkocsi_id: "",
                          }));
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Pótkocsi
                      </span>
                    </label>
                  </div>
                </div>

                {jarmuTipus === "kamion" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kamion
                    </label>
                    <select
                      name="kamion_id"
                      value={newKarbantartas.kamion_id || ""}
                      onChange={handleNewKarbantartasChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
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
                      value={newKarbantartas.potkocsi_id || ""}
                      onChange={handleNewKarbantartasChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
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
                    Km óraállás
                  </label>
                  <input
                    type="number"
                    name="km_oraallas"
                    value={newKarbantartas.km_oraallas}
                    onChange={handleNewKarbantartasChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Elvégezte
                  </label>
                  <input
                    type="text"
                    name="elvegezte"
                    value={newKarbantartas.elvegezte}
                    onChange={handleNewKarbantartasChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Következő karbantartás dátuma
                  </label>
                  <input
                    type="date"
                    name="kovetkezo_karbantartas"
                    value={newKarbantartas.kovetkezo_karbantartas}
                    onChange={handleNewKarbantartasChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {editingId && renderFileUpload(editingId)}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpenDialog(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {editingId ? "Mentés" : "Hozzáadás"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Karbantartasok;
