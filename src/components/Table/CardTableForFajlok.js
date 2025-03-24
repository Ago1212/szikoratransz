import React, { useEffect, useState } from "react";

import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";

export default function CardTableForFajlok({ id, tabla }) {
  const [files, setFiles] = useState([]);
  const storedUserData = sessionStorage.getItem("user");
  const admin = storedUserData ? JSON.parse(storedUserData).id : "0";

  const fetchFiles = async () => {
    const result = await fetchAction("getFiles", {
      id,
      tabla,
    });
    if (result && result.success) {
      setFiles(result.files);
    } else {
      alert(result.message || "Fileok betöltése sikertelen.");
    }
  };
  useEffect(() => {
    fetchFiles();
  }, [id]);

  const handleFileDelete = async (file_id) => {
    const confirmed = window.confirm("Biztosan törölni szeretné ezt a fájlt?");

    if (!confirmed) return; // Ha a felhasználó mégsem szeretné törölni, kilépünk

    const result = await fetchAction("deleteFile", { id: file_id });

    if (result && result.success) {
      fetchFiles(); // Frissíti a listát
    } else {
      alert(result.message || "Hiba történt a törlés során");
    }
  };

  // Feltöltés kezelése
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64File = reader.result.split(",")[1]; // Az adat URL-ből kivesszük a base64 kódolt részt

      const result = await fetchAction("fileUpload", {
        admin,
        id,
        tabla,
        file: base64File, // Base64 kódolt fájl küldése
        name: file.name,
        size: file.size,
      });

      if (result && result.success) {
        fetchFiles();
      } else {
        console.error("Fájl feltöltési hiba!");
      }
    };

    reader.readAsDataURL(file);
  };

  // Fájl letöltése
  const handleFileDownload = async (id, filename) => {
    await downloadFileAction(id, filename);
  };

  return (
    <>
      <div
        className={
          "relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-white"
        }
      >
        <div className="rounded-t mb-0 px-4 py-3 border-0">
          <div className="flex flex-wrap items-center">
            <div className="relative w-full px-4 max-w-full flex-grow flex-1">
              <div className="text-center flex justify-between">
                <h3 className={"font-semibold text-lg text-blueGray-700"}>
                  Fájlok
                </h3>
                <label className="bg-lightBlue-500 text-white active:bg-lightBlue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150 cursor-pointer">
                  Új
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="block w-full overflow-x-auto">
          {/* Projects table */}
          <table className="items-center w-full bg-transparent border-collapse">
            <thead>
              <tr>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-center bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Műveletek
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  File név
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Méret
                </th>
                <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
                  Feltöltve
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => (
                <tr key={index}>
                  <td className="border-t-0 px-6 border-l-0 border-r-0 whitespace-nowrap p-4 align-middle">
                    <i
                      className="fa-solid fa-download cursor-pointer text-blue-500 hover:text-blue-700 transition transform hover:scale-110 mr-4"
                      onClick={() =>
                        handleFileDownload(file.sorszam, file.filename)
                      }
                      title="Download"
                    ></i>
                    <i
                      className="fa-solid fa-trash-can cursor-pointer text-red-500 hover:text-red-700 transition transform hover:scale-110"
                      onClick={() => handleFileDelete(file.sorszam)}
                      title="Delete"
                    ></i>
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {file.filename}
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {file.filesize}
                  </td>
                  <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    {file.feltoltve}
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
