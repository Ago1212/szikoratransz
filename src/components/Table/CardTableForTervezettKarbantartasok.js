import React, { useRef, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaEdit, FaTrash, FaPlus, FaArrowRight, FaTimes } from "react-icons/fa";
import { fetchAction } from "utils/fetchAction";

const ActionButton = ({ onClick, icon, color, title, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`${color} cursor-pointer transition transform hover:scale-125 ${className}`}
  >
    {icon}
  </button>
);

const TableHeader = ({ children, align = "left" }) => (
  <th
    className={`px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-${align} bg-blueGray-50 text-blueGray-500 border-blueGray-100`}
  >
    {children}
  </th>
);

const TableRow = ({ children, index }) => (
  <tr className={index % 2 === 0 ? "bg-white" : "bg-blueGray-50"}>
    {children}
  </tr>
);

const TableCell = ({ children, align = "left", className = "" }) => {
  const baseClasses =
    "border-t-0 px-6 align-middle border-l-0 border-r-0 text-sm whitespace-nowrap p-4";
  const alignmentClass = `text-${align}`;

  return (
    <td className={`${baseClasses} ${alignmentClass} ${className}`}>
      {children}
    </td>
  );
};

const CardTableForTervezettKarbantartasok = ({
  kamion_id,
  refresh,
  onRefresh,
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [karbantartasok, setKarbantartasok] = useState([]);
  const [selectedKarbantartas, setSelectedKarbantartas] = useState(null);
  const dialogRef = useRef(null);

  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getKarbantartas", {
      kamion_id: kamion_id,
      elvegzett: false,
    });

    if (result?.success) {
      setKarbantartasok(result.karbantartas);
    } else {
      alert(result?.message || "Karbantartások betöltése sikertelen.");
    }
  };

  const handleAddClick = () => {
    setSelectedKarbantartas(null);
    setOpenDialog(true);
  };

  const handleEditClick = (karbantartas) => {
    setSelectedKarbantartas(karbantartas);
    setOpenDialog(true);
  };

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setKarbantartasKesz", {
      id: karbantartasId,
      elvegzett: true,
    });

    if (result?.success) {
      await fetchKarbantartasok();
      onRefresh?.();
    } else {
      alert(result?.message || "Hiba történt a státusz frissítésekor.");
    }
  };

  const handleKarbantartasDelete = async (id) => {
    if (!window.confirm("Biztosan törölni szeretnéd a karbantartást?")) return;

    try {
      const result = await fetchAction("deleteKarbantartas", { id });

      if (result?.success) {
        alert("A karbantartás sikeresen törölve.");
        await fetchKarbantartasok();
      } else {
        alert(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault(); // Megakadályozzuk az alapértelmezett form küldést

    const dataToSave = {
      id: selectedKarbantartas?.id,
      datum: selectedKarbantartas?.datum,
      log: selectedKarbantartas?.log,
      kamion_id: kamion_id,
    };

    const result = await fetchAction("updateKarbantartas", dataToSave);

    if (result?.success) {
      await fetchKarbantartasok();
      setOpenDialog(false);
    } else {
      alert(result?.message || "Módosítás sikertelen.");
    }
  };

  useEffect(() => {
    fetchKarbantartasok();
  }, [kamion_id, refresh]);

  useEffect(() => {
    if (dialogRef.current) {
      openDialog ? dialogRef.current.showModal() : dialogRef.current.close();
    }
  }, [openDialog]);

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white overflow-hidden">
      <div className="block w-full overflow-x-auto">
        <table className="items-center w-full bg-transparent border-collapse">
          <thead>
            <tr>
              <TableHeader align="center">Műveletek</TableHeader>
              <TableHeader align="center">Tervezett karbantartás</TableHeader>
              <TableHeader align="left">Dátum</TableHeader>
              <TableHeader align="right">
                <button
                  className="bg-blue-500 text-white font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 flex items-center"
                  onClick={handleAddClick}
                >
                  <FaPlus className="mr-1" /> Új
                </button>
              </TableHeader>
            </tr>
          </thead>
          <tbody>
            {karbantartasok.length > 0 ? (
              karbantartasok.map((karbantartas, index) => (
                <TableRow key={karbantartas.id} index={index}>
                  <TableCell align="center">
                    <div className="flex justify-center space-x-4">
                      <ActionButton
                        onClick={() => handleEditClick(karbantartas)}
                        icon={<FaEdit />}
                        color="text-blue-500 hover:text-blue-700"
                        title="Szerkesztés"
                      />
                      <ActionButton
                        onClick={() =>
                          handleKarbantartasDelete(karbantartas.id)
                        }
                        icon={<FaTrash />}
                        color="text-red-500 hover:text-red-700"
                        title="Törlés"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words max-w-xs">
                    {karbantartas.log}
                  </TableCell>
                  <TableCell>{karbantartas.datum}</TableCell>
                  <TableCell align="right">
                    <ActionButton
                      onClick={() => handleSetKarbantartasKesz(karbantartas.id)}
                      icon={<FaArrowRight />}
                      color="text-green-500 hover:text-green-700"
                      title="Elvégzettként jelöl"
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  align="center"
                  className="py-8 text-gray-500"
                >
                  Nincsenek tervezett karbantartások
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </table>
      </div>
      {openDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative rounded-lg bg-white shadow-xl p-6 w-full max-w-md">
            <button
              type="button"
              onClick={() => setOpenDialog(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <FaTimes />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedKarbantartas
                ? "Karbantartás módosítása"
                : "Új karbantartás"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dátum
                </label>
                <input
                  type="date"
                  value={selectedKarbantartas?.datum || ""}
                  onChange={(e) =>
                    setSelectedKarbantartas((prev) => ({
                      ...prev,
                      datum: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leírás
                </label>
                <textarea
                  value={selectedKarbantartas?.log || ""}
                  onChange={(e) =>
                    setSelectedKarbantartas((prev) => ({
                      ...prev,
                      log: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="5"
                  placeholder="Karbantartás leírása..."
                  required
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

CardTableForTervezettKarbantartasok.propTypes = {
  kamion_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  refresh: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default CardTableForTervezettKarbantartasok;
