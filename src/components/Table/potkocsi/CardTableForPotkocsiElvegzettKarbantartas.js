import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaTrash, FaArrowLeft } from "react-icons/fa";
import { fetchAction } from "utils/fetchAction";

// Újrahasznosított komponensek
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

const TableCell = ({ children, align = "left", className = "", colSpan }) => {
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

const CardTableForPotkocsiElvegzettKarbantartas = ({
  potkocsi_id,
  refresh,
  onRefresh,
}) => {
  const [karbantartasok, setKarbantartasok] = useState([]);

  const fetchKarbantartasok = async () => {
    const result = await fetchAction("getPotkocsiKarbantartas", {
      potkocsi_id: potkocsi_id,
      elvegzett: true,
    });

    if (result?.success) {
      setKarbantartasok(result.karbantartas);
    } else {
      alert(result?.message || "Karbantartások betöltése sikertelen.");
    }
  };

  const handleSetKarbantartasKesz = async (karbantartasId) => {
    const result = await fetchAction("setPotkocsiKarbantartasKesz", {
      id: karbantartasId,
      elvegzett: false,
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
      const result = await fetchAction("deletePotkocsiKarbantartas", { id });

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

  useEffect(() => {
    fetchKarbantartasok();
  }, [potkocsi_id, refresh]);

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white overflow-hidden">
      <div className="block w-full overflow-x-auto">
        <table className="items-center w-full bg-transparent border-collapse">
          <thead>
            <tr>
              <TableHeader align="center">Műveletek</TableHeader>
              <TableHeader align="left">Elvégzett karbantartás</TableHeader>
              <TableHeader align="left">Dátum</TableHeader>
              <TableHeader align="right">Státusz</TableHeader>
            </tr>
          </thead>
          <tbody>
            {karbantartasok.length > 0 ? (
              karbantartasok.map((karbantartas, index) => (
                <TableRow key={karbantartas.id} index={index}>
                  <TableCell align="center">
                    <ActionButton
                      onClick={() => handleKarbantartasDelete(karbantartas.id)}
                      icon={<FaTrash />}
                      color="text-red-500 hover:text-red-700"
                      title="Törlés"
                    />
                  </TableCell>
                  <TableCell className="whitespace-normal break-words max-w-xs">
                    {karbantartas.log}
                  </TableCell>
                  <TableCell>{karbantartas.datum}</TableCell>
                  <TableCell align="right">
                    <ActionButton
                      onClick={() => handleSetKarbantartasKesz(karbantartas.id)}
                      icon={<FaArrowLeft />}
                      color="text-yellow-500 hover:text-yellow-700"
                      title="Tervezettként jelöl"
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
                  Nincsenek elvégzett karbantartások
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

CardTableForPotkocsiElvegzettKarbantartas.propTypes = {
  potkocsi_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  refresh: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default CardTableForPotkocsiElvegzettKarbantartas;
