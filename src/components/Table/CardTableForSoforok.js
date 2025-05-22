import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
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
const CardTable = ({ soforok }) => {
  const history = useHistory();

  const handleNewSofor = () => {
    history.push("/admin/soforForm", { data: {} });
  };

  const handleEditClick = (sofor) => {
    history.push("/admin/soforForm", { data: sofor });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Biztosan törölni szeretnéd a sofőrt?")) return;

    try {
      const result = await fetchAction("deleteSofor", { id });

      if (result?.success) {
        // Refresh the page after deletion
        history.push("/admin");
        setTimeout(() => history.replace("/admin/soforok"), 0);
        alert("A sofőr sikeresen törölve.");
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
              <h3 className="font-semibold text-xl text-white">Sofőrök</h3>
              <button
                className="bg-white text-blue-600 hover:bg-blue-50 active:bg-blue-100 font-bold uppercase text-sm px-4 py-2 rounded-lg shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 flex items-center"
                type="button"
                onClick={handleNewSofor}
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
              <TableHeader>Név</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>Telefon</TableHeader>
              <TableHeader>Lakcím</TableHeader>
              <TableHeader align="right">Műveletek</TableHeader>
            </tr>
          </thead>
          <tbody>
            {soforok.length > 0 ? (
              soforok.map((sofor, index) => (
                <TableRow key={index} index={index}>
                  <TableCell>{sofor.name}</TableCell>
                  <TableCell>{sofor.email}</TableCell>
                  <TableCell>{sofor.phone}</TableCell>
                  <TableCell>{sofor.lakcim}</TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end space-x-4">
                      <ActionButton
                        icon={<FaEdit />}
                        color="text-blue-500 hover:text-blue-700"
                        onClick={() => handleEditClick(sofor)}
                        title="Szerkesztés"
                      />
                      <ActionButton
                        icon={<FaTrash />}
                        color="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(sofor.id)}
                        title="Törlés"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  className="py-8 text-gray-500 w-full"
                >
                  Nincsenek sofőrök megjelenítve
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

CardTable.propTypes = {
  soforok: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      phone: PropTypes.string.isRequired,
      lakcim: PropTypes.string.isRequired,
    })
  ).isRequired,
};

CardTable.defaultProps = {
  soforok: [],
};

export default CardTable;
