import TableDropdown from "components/Dropdowns/TableDropdown";
import React, { useRef, useState, useEffect } from "react";

export default function CardTableForTervezettKarbantartasok() {
  const [openDialog, setOpenDialog] = useState(false);
  const dialogRef = useRef(null);

  const handleAddClick = () => setOpenDialog(true);
  const handleCloseDialog = () => setOpenDialog(false);
  const handleSave = () => {
    // Mentési logika itt
    handleCloseDialog();
  };

  // Show dialog when openDialog is true
  useEffect(() => {
    if (openDialog) {
      dialogRef.current.showModal();
    } else {
      dialogRef.current.close();
    }
  }, [openDialog]);

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white">
      <div className="block w-full overflow-x-auto">
        {/* Table */}
        <table className="items-center w-full bg-transparent border-collapse">
          <thead>
            <tr>
              <th
                key="leiras"
                className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100"
              >
                Tervezett karbantartás
              </th>
              <th
                key="datum"
                className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100"
              >
                Dátum
              </th>
              <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                <button
                  className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={handleAddClick}
                >
                  Új
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                Karbantartási leírás
              </td>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                2024-11-01
              </td>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                <TableDropdown link="" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Dialog for adding new entry */}
      <dialog
        ref={dialogRef}
        className="rounded-lg bg-white shadow-xl p-6"
        onClose={handleCloseDialog}
      >
        <h3
          className="text-base font-semibold text-gray-900 mb-4"
          id="modal-title"
        >
          Új Karbantartás
        </h3>
        {/* Input fields for description and date */}
        <label className="block text-sm font-medium mb-1">Dátum</label>
        <input
          type="date"
          className="border border-gray-300 px-3 py-2 mb-4 w-full rounded-md focus:outline-none focus:ring focus:ring-blue-500"
        />
        <label className="block text-sm font-medium mb-1">
          Tervezett karbantartás
        </label>
        <textarea
          className="border border-gray-300 px-3 py-2 mb-4 w-full rounded-md focus:outline-none focus:ring focus:ring-blue-500"
          placeholder="Leírás..."
          rows="4"
        />
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex rounded-md  px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-blue-500 mr-2"
          >
            Mentés
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current.close()}
            className="inline-flex rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Mégse
          </button>
      </dialog>
    </div>
  );
}
