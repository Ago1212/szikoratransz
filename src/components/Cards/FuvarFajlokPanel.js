import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { PiUploadSimpleLight, PiTrashLight, PiXLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import FileTypeIcon from "components/Fajlok/FileTypeIcon.js";

// Kompakt, előnézetes fájl-panel a Fuvar űrlaphoz — a korábbi
// CardFuvarFajlok (a Fájlok modul teljes, kereséses/lapozós DataTable-je)
// a form ALJÁN jelent meg, görgetést igényelt. Ez a panel a form MELLETT,
// jobb oldalon, sticky pozícióban ül (ld. FuvarForm.js), és csak azt
// tudja, amire itt szükség van: lista bélyegképpel + feltöltés + törlés.
// Kevés fájl várható fuvaronként (menetlevél/szállítólevél/számla), ezért
// a bélyegképek — a nagyobb listáknál (Fájlok modul, HelyszinReszletek.js)
// megszokott IntersectionObserver-es lusta betöltéssel szemben — egyből,
// mount-kor betöltődnek.
function FuvarFajlSor({ file, onOpen, onDelete }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const isKep = file.fajl_kategoria === "kep";

  useEffect(() => {
    if (!isKep) return;
    fetchAction("downloadFile", { id: file.sorszam }).then((result) => {
      if (result?.success && result.mime?.startsWith("image/")) {
        setThumbSrc(`data:${result.mime};base64,${result.file}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.sorszam]);

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-ink-100 p-2 dark:border-ink-800">
      <button
        type="button"
        onClick={() => onOpen(file)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-ink-800">
          {isKep ? (
            thumbSrc ? (
              <img src={thumbSrc} alt={file.filename} className="h-full w-full object-cover" />
            ) : (
              <span className="h-4 w-4 animate-pulse rounded-full bg-slate-300 dark:bg-ink-700" />
            )
          ) : (
            <FileTypeIcon file={file} className="h-9 w-7" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-700 dark:text-ink-200">{file.filename}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(file)}
        aria-label="Fájl törlése"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
      >
        <PiTrashLight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function FuvarFajlokPanel({ fuvar_id }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchAction("getFiles", { id: fuvar_id, tabla: "fuvar" });
    setFiles(result?.success ? result.files || [] : []);
    setLoading(false);
  }, [fuvar_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const base64 = await fileToBase64(file);
        // eslint-disable-next-line no-await-in-loop
        const result = await fetchAction("fileUpload", {
          admin: user.ceg_id,
          id: fuvar_id,
          tabla: "fuvar",
          file: base64,
          name: file.name,
          size: file.size,
        });
        if (!result?.success) {
          toast.error(`${file.name}: a feltöltés sikertelen.`);
        }
      }
      await load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (file) => {
    const ok = await confirmDialog(`Biztosan törlöd a(z) "${file.filename}" fájlt?`, { confirmLabel: "Törlés" });
    if (!ok) return;
    const result = await fetchAction("deleteFile", { id: file.sorszam });
    if (result?.success) {
      setFiles((prev) => prev.filter((f) => f.sorszam !== file.sorszam));
    } else {
      toast.error(result?.message || "A törlés sikertelen.");
    }
  };

  const openPreview = async (file) => {
    if (file.fajl_kategoria !== "kep") return;
    setPreviewLoading(true);
    const result = await fetchAction("downloadFile", { id: file.sorszam });
    setPreviewLoading(false);
    if (result?.success) {
      setPreview({ src: `data:${result.mime};base64,${result.file}`, filename: file.filename });
    } else {
      toast.error(result?.message || "A fájl nem tölthető be.");
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-900 dark:text-ink-50">Fájlok</h3>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300">
          <PiUploadSimpleLight className="h-4 w-4" />
          {uploading ? "Feltöltés…" : "Feltöltés"}
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-ink-400">Betöltés…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-ink-400">Még nincs feltöltött fájl ehhez a fuvarhoz.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <FuvarFajlSor key={f.sorszam} file={f} onOpen={openPreview} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {previewLoading &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>,
          document.body,
        )}

      {preview &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={() => setPreview(null)}>
            <div className="flex items-center justify-between p-4">
              <p className="truncate pr-4 text-sm font-semibold text-white">{preview.filename}</p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Bezárás"
              >
                <PiXLight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto p-4">
              <img
                src={preview.src}
                alt={preview.filename}
                className="max-h-full max-w-full rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
