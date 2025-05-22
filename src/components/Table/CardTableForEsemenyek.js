import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FaEdit, FaTrash, FaPlus, FaTimes } from "react-icons/fa";
import { format } from "date-fns";
import { fetchAction } from "utils/fetchAction";

// Reusable components
const ActionButton = ({ onClick, icon, color, title, className = "" }) => (
  <button
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

// Main component
const CardTableForEsemenyek = ({ id }) => {
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
    if (result?.success) {
      setEsemenyek(result.esemenyek);
    } else {
      alert(result?.message || "Események betöltése sikertelen.");
    }
  };

  useEffect(() => {
    fetchEsemenyek();
  }, [id]);

  const handleEsemenyDelete = async (esemeny_id) => {
    if (!window.confirm("Biztosan törölni szeretné ezt az eseményt?")) return;

    const result = await fetchAction("deleteEgyediHatarido", {
      id: esemeny_id,
    });
    if (result?.success) {
      await fetchEsemenyek();
    } else {
      alert(result?.message || "Hiba történt a törlés során");
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
      : { ...formData, id };

    const result = await fetchAction(action, data);
    if (result?.success) {
      await fetchEsemenyek();
      resetForm();
    } else {
      alert(result?.message || "Hiba történt a művelet során");
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

  const resetForm = () => {
    setShowDialog(false);
    setCurrentEsemeny(null);
    setFormData({
      leiras: "",
      datum: format(new Date(), "yyyy-MM-dd"),
    });
  };

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white overflow-hidden">
      {/* Table Header */}
      <div className="rounded-t-lg mb-0 px-6 py-4 border-0 bg-gradient-to-r from-blue-500 to-blue-700">
        <div className="flex flex-wrap items-center">
          <div className="relative w-full max-w-full flex-grow flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-xl text-white">Események</h3>
              <button
                onClick={() => setShowDialog(true)}
                className="bg-white text-blue-600 hover:bg-blue-50 active:bg-blue-100 font-bold uppercase text-sm px-4 py-2 rounded-lg shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 flex items-center"
              >
                <FaPlus className="mr-2" /> Új esemény
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="block w-full overflow-x-auto">
        <table className="items-center w-full bg-transparent border-collapse">
          <thead className="bg-blueGray-50">
            <tr>
              <TableHeader align="center">Műveletek</TableHeader>
              <TableHeader>Esemény</TableHeader>
              <TableHeader>Dátum</TableHeader>
            </tr>
          </thead>
          <tbody>
            {esemenyek.length > 0 ? (
              esemenyek.map((esemeny, index) => (
                <TableRow key={index} index={index}>
                  <TableCell align="center">
                    <div className="flex justify-center space-x-4">
                      <ActionButton
                        onClick={() => openEditDialog(esemeny)}
                        icon={<FaEdit />}
                        color="text-yellow-500 hover:text-yellow-700"
                        title="Szerkesztés"
                      />
                      <ActionButton
                        onClick={() => handleEsemenyDelete(esemeny.sorszam)}
                        icon={<FaTrash />}
                        color="text-red-500 hover:text-red-700"
                        title="Törlés"
                      />
                    </div>
                  </TableCell>
                  <TableCell>{esemeny.leiras}</TableCell>
                  <TableCell>{esemeny.datum}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  align="center"
                  className="py-8 text-gray-500"
                >
                  Nincsenek események megjelenítve
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Modal */}
      {showDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentEsemeny
                  ? "Esemény szerkesztése"
                  : "Új esemény létrehozása"}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leírás
                </label>
                <input
                  type="text"
                  name="leiras"
                  value={formData.leiras}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dátum
                </label>
                <input
                  type="date"
                  name="datum"
                  value={formData.datum}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {currentEsemeny ? "Mentés" : "Létrehozás"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

CardTableForEsemenyek.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default CardTableForEsemenyek;
