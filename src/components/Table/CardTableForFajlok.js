import React, { useEffect, useState } from "react";
import { FiDownload, FiTrash2, FiUpload, FiFile } from "react-icons/fi";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";

export default function CardTableForFajlok({ id, tabla }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const storedUserData = sessionStorage.getItem("user");
  const admin = storedUserData ? JSON.parse(storedUserData).id : "0";

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const result = await fetchAction("getFiles", { id, tabla });
      if (result?.success) {
        setFiles(result.files);
      } else {
        alert(result?.message || "Fájlok betöltése sikertelen.");
      }
    } catch (error) {
      console.error("Hiba történt a fájlok betöltésekor:", error);
      alert("Hiba történt a fájlok betöltésekor.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [id]);

  const handleFileDelete = async (file_id) => {
    if (!window.confirm("Biztosan törölni szeretné ezt a fájlt?")) return;

    try {
      const result = await fetchAction("deleteFile", { id: file_id });
      if (result?.success) {
        fetchFiles();
      } else {
        alert(result?.message || "Hiba történt a törlés során");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      alert("Hiba történt a törlés során.");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      alert("A fájl mérete túl nagy! Maximális megengedett méret: 10MB");
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        const base64File = reader.result.split(",")[1];
        const result = await fetchAction("fileUpload", {
          admin,
          id,
          tabla,
          file: base64File,
          name: file.name,
          size: file.size,
        });

        if (result?.success) {
          fetchFiles();
        } else {
          alert(result?.message || "Fájl feltöltési hiba!");
        }
      } catch (error) {
        console.error("Fájl feltöltési hiba:", error);
        alert("Fájl feltöltése sikertelen.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setIsLoading(false);
      alert("Hiba történt a fájl olvasása során.");
    };

    reader.readAsDataURL(file);
  };

  const handleFileDownload = async (id, filename) => {
    try {
      await downloadFileAction(id, filename);
    } catch (error) {
      console.error("Letöltési hiba:", error);
      alert("A fájl letöltése sikertelen.");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat(bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString("hu-HU", options);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden w-full">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-800">Fájlok kezelése</h3>
        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer">
          <FiUpload className="mr-2" />
          Új fájl feltöltése
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isLoading}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : files.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <FiFile className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2">Nincsenek feltöltött fájlok</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fájlnév
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Méret
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Feltöltve
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.map((file, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-md flex items-center justify-center">
                        <FiFile className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {file.filename}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(file.filesize)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(file.feltoltve)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        handleFileDownload(file.sorszam, file.filename)
                      }
                      className="text-blue-600 hover:text-blue-900 mr-4 transition-colors"
                      title="Letöltés"
                    >
                      <FiDownload className="inline-block" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFileDelete(file.sorszam)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Törlés"
                    >
                      <FiTrash2 className="inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
