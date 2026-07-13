import React, { useEffect, useState } from "react";
import {
  PiDownloadSimpleLight,
  PiTrashLight,
  PiUploadSimpleLight,
  PiFileLight,
  PiFilePdfLight,
  PiFileXlsLight,
  PiFileImageLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";
import { toast } from "utils/toast";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";

const getFileIcon = (filename) => {
  const ext = filename.split(".").pop().toLowerCase();

  switch (ext) {
    case "pdf":
      return <PiFilePdfLight className="h-5 w-5 text-red-600" />;
    case "xls":
    case "xlsx":
    case "csv":
      return <PiFileXlsLight className="h-5 w-5 text-emerald-600" />;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return <PiFileImageLight className="h-5 w-5 text-violet-600" />;
    default:
      return <PiFileLight className="h-5 w-5 text-brand-600" />;
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

const PAGE_SIZE = 10;

export default function CardTableForFajlok({ id, tabla }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const storedUserData = sessionStorage.getItem("user");
  const admin = storedUserData ? JSON.parse(storedUserData).ceg_id : "0";
  // A lapozás/keresés csak az admin saját, önálló "Fájlok" listaoldalán
  // (tabla === "admin") aktív — a komponens más kontextusban (pl.
  // Karbantartasok.js egy adott karbantartáshoz tartozó pár fájlja) egy
  // eleve kicsi, beágyazott listát mutat, ahol ez felesleges lenne.
  const isListPage = tabla === "admin";
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const result = await fetchAction("getFiles", {
        id,
        tabla,
        ...(isListPage ? { search: search || undefined, page, pageSize: PAGE_SIZE } : {}),
      });
      if (result?.success) {
        setFiles(result.files);
        if (isListPage) setTotal(result.total ?? (result.files || []).length);
      } else {
        toast.error(result?.message || "Fájlok betöltése sikertelen.");
        if (isListPage) setTotal(0);
      }
    } catch (error) {
      console.error("Hiba történt a fájlok betöltésekor:", error);
      toast.error("Hiba történt a fájlok betöltésekor.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, search]);


  const handleFileDelete = async (file_id) => {
    if (!window.confirm("Biztosan törölni szeretné ezt a fájlt?")) return;

    try {
      const result = await fetchAction("deleteFile", { id: file_id });
      if (result?.success) {
        fetchFiles();
      } else {
        toast.error(result?.message || "Hiba történt a törlés során");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      toast.error("Hiba történt a törlés során.");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("A fájl mérete túl nagy! Maximális megengedett méret: 10MB");
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
          toast.error(result?.message || "Fájl feltöltési hiba!");
        }
      } catch (error) {
        console.error("Fájl feltöltési hiba:", error);
        toast.error("Fájl feltöltése sikertelen.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setIsLoading(false);
      toast.error("Hiba történt a fájl olvasása során.");
    };

    reader.readAsDataURL(file);
  };

  const handleFileDownload = async (fileId, filename) => {
    try {
      await downloadFileAction(fileId, filename);
    } catch (error) {
      console.error("Letöltési hiba:", error);
      toast.error("A fájl letöltése sikertelen.");
    }
  };

  const columns = [
    {
      key: "filename",
      label: "Fájlnév",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
            {getFileIcon(row.filename)}
          </div>
          <div className="max-w-xs truncate text-sm font-medium text-brand-900">
            {row.filename}
          </div>
        </div>
      ),
    },
    {
      key: "filesize",
      label: "Méret",
      className: "text-ink-500",
      render: (row) => formatFileSize(row.filesize),
    },
    {
      key: "feltoltve",
      label: "Feltöltve",
      className: "text-ink-500",
      render: (row) => formatDate(row.feltoltve),
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon
            icon={<PiDownloadSimpleLight />}
            onClick={() => handleFileDownload(row.sorszam, row.filename)}
            title="Letöltés"
          />
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleFileDelete(row.sorszam)}
            title="Törlés"
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      icon={PiFileLight}
      title="Fájlok kezelése"
      headerAction={
        <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700">
          <PiUploadSimpleLight className="h-4 w-4" />
          Új fájl feltöltése
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isLoading}
          />
        </label>
      }
      columns={columns}
      rows={files}
      rowKey={(row, index) => row.sorszam ?? index}
      loading={isLoading}
      emptyState={
        <div className="p-10 text-center text-ink-400">
          <PiFileLight className="mx-auto h-10 w-10 text-ink-300" />
          <p className="mt-2 text-sm">Nincsenek feltöltött fájlok</p>
        </div>
      }
      {...(isListPage
        ? {
            searchable: true,
            searchPlaceholder: "Keresés fájlnév szerint...",
            serverSide: true,
            totalRows: total,
            page,
            pageSize: PAGE_SIZE,
            onPageChange: setPage,
            onSearchChange: setSearch,
          }
        : {})}
    />
  );
}
