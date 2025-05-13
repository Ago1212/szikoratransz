import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";

// components
import { fetchAction } from "utils/fetchAction";

export default function CardTable({ bejelentesek }) {
  const history = useHistory(); // Navigációhoz

  const handleNewBejelentes = () => {
    // Navigáció az új sofőr űrlapjára
    history.push("/admin/bejelentesForm", { data: {} });
  };
  const handleEditClick = (bejelentes) => {
    // Navigáció az új sofőr űrlapjára
    history.push("/admin/bejelentesForm", { data: bejelentes });
  };
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Biztosan törölni szeretnéd a bejelentést?"
    );
    if (!confirmDelete) {
      return; // Ha nem erősíti meg, kilépünk a függvényből
    }

    try {
      // API hívás törléshez
      const result = await fetchAction("deleteBejelentes", { id });

      if (result && result.success) {
        history.push("/admin");
        setTimeout(() => {
          history.replace("/admin/bejelentesek"); // Adjust this to your actual route
        }, 0);
        alert("A bejelentés sikeresen törölve.");
      } else {
        alert(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  return (
    <>
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white">
        <div className="rounded-t mb-0 px-4 py-3 border-0">
          <div className="flex flex-wrap items-center">
            <div className="relative w-full px-4 max-w-full flex-grow flex-1">
              <div className="text-center flex justify-between">
                <h3 className="font-semibold text-lg text-blueGray-700">
                  Bejelentések
                </h3>
                <button
                  className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={handleNewBejelentes}
                >
                  Új
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="block w-full overflow-x-auto">
          {/* Projects table */}
          <table className="items-center w-full bg-transparent border-collapse">
            <thead>
              <tr>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Bejelentő
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Bejelentve
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Típus
                </th>
                <th className="px-6 align-middle flex justify-end border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody>
              {bejelentesek.map((bejelentes, index) => (
                <tr key={index}>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {bejelentes.name}
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {bejelentes.bejelentve}
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {bejelentes.tipus}
                  </td>
                  <td className="border-t-0 px-6 border-l-0 border-r-0 whitespace-nowrap p-4 align-middle flex justify-end">
                    <i
                      className="fa-solid fa-file-pen cursor-pointer text-blue-500 hover:text-blue-700 transition transform hover:scale-110 mr-4"
                      onClick={() => handleEditClick(bejelentes)}
                      title="Megnyitás"
                    ></i>
                    <i
                      className="fa-solid fa-trash-can cursor-pointer text-red-500 hover:text-red-700 transition transform hover:scale-110"
                      onClick={() => handleDelete(bejelentes.id)}
                      title="Törlés"
                    ></i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

CardTable.propTypes = {
  soforok: PropTypes.arrayOf(
    PropTypes.shape({
      nev: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      telefon: PropTypes.string.isRequired,
      lakcim: PropTypes.string.isRequired,
    })
  ),
};
