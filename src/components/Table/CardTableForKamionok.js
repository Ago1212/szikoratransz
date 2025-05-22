import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";

// Utils
import { fetchAction } from "utils/fetchAction";

// Icons
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

const CardTable = ({ kamionok }) => {
  const history = useHistory();

  const handleNewKamion = () => {
    history.push("/admin/kamionForm", { data: {} });
  };

  const handleEditClick = (kamion) => {
    history.push("/admin/kamionForm", { data: kamion });
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Biztosan törölni szeretnéd a kamiont?"
    );
    if (!confirmDelete) return;

    try {
      const result = await fetchAction("deleteKamion", { id });

      if (result?.success) {
        // Refresh the page after deletion
        history.push("/admin");
        setTimeout(() => history.replace("/admin/kamionok"), 0);
        alert("A kamion sikeresen törölve.");
      } else {
        alert(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white overflow-hidden">
      {/* Table Header */}
      <div className="rounded-t-lg mb-0 px-6 py-4 border-0 bg-gradient-to-r from-blue-500 to-blue-700">
        <div className="flex flex-wrap items-center">
          <div className="relative w-full max-w-full flex-grow flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-xl text-white">Kamionok</h3>
              <button
                className="bg-white text-blue-600 hover:bg-blue-50 active:bg-blue-100 font-bold uppercase text-sm px-4 py-2 rounded-lg shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 flex items-center"
                type="button"
                onClick={handleNewKamion}
              >
                <FaPlus className="mr-2" /> Új
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
              <TableHeader>Rendszám</TableHeader>
              <TableHeader>Típus</TableHeader>
              <TableHeader>Méret</TableHeader>
              <TableHeader>Pótkocsi</TableHeader>
              <TableHeader align="right">Műveletek</TableHeader>
            </tr>
          </thead>
          <tbody>
            {kamionok.length > 0 ? (
              kamionok.map((kamion, index) => (
                <TableRow key={index} index={index}>
                  <TableCell>{kamion.rendszam}</TableCell>
                  <TableCell>{kamion.tipus || "Nincs"}</TableCell>
                  <TableCell>{kamion.meret || "Nincs"}</TableCell>
                  <TableCell>{kamion.potkocsi || "Nincs"}</TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end space-x-4">
                      <ActionIcon
                        icon={<FaEdit />}
                        color="text-blue-500 hover:text-blue-700"
                        onClick={() => handleEditClick(kamion)}
                        title="Szerkesztés"
                      />
                      <ActionIcon
                        icon={<FaTrash />}
                        color="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(kamion.id)}
                        title="Törlés"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  className="py-8 text-gray-500"
                >
                  Nincsenek kamionok megjelenítve
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Reusable sub-components
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

const TableCell = ({ children, align = "left", colSpan, className = "" }) => {
  const baseClasses =
    "border-t-0 px-6 align-middle border-l-0 border-r-0 text-sm whitespace-nowrap p-4";
  const alignmentClass = `text-${align}`;

  return (
    <td
      className={`${baseClasses} ${alignmentClass} ${className}`}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
};

const ActionIcon = ({ icon, color, onClick, title }) => (
  <span
    className={`cursor-pointer ${color} transition transform hover:scale-125`}
    onClick={onClick}
    title={title}
  >
    {icon}
  </span>
);

// Prop types validation
CardTable.propTypes = {
  kamionok: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      rendszam: PropTypes.string.isRequired,
      tipus: PropTypes.string,
      meret: PropTypes.string,
      potkocsi: PropTypes.string,
    })
  ).isRequired,
};

CardTable.defaultProps = {
  kamionok: [],
};

export default CardTable;
