import React, { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import {
  PiFileLight,
  PiDownloadSimpleLight,
  PiXLight,
  PiUserLight,
  PiFolderLight,
  PiCalendarBlankLight,
  PiStackLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";
import Spinner from "components/UI/Spinner.js";
import { kategoriaInfo, formatFileSize, formatDate, MODUL_LABEL } from "components/Fajlok/fajlKategoriaInfo.js";
import FileTypeIcon from "components/Fajlok/FileTypeIcon.js";

// A `downloadFile` action-t (ugyanazt, amit `downloadFileAction.js` is
// használ) NEM egy `<a download>`-ra kattintva, hanem a visszakapott
// `{mime, file(base64)}`-ból épített `data:` URI-ként jeleníti meg — csak a
// leggyakoribb típusokhoz van valódi előnézet (kép, PDF), minden más
// típusnál egy "nincs előnézet" üzenet + Letöltés gomb. A "Hasonló fájlok"
// szekció (ugyanaz a modul + kategória, ld. filesInterface.php
// getHasonloFajlok()) tisztán SQL-egyezés, nincs mögötte AI.
function ElonezetTartalom({ file, dataUrl, mime, loading, hasonloFajlok, onValasztFajlt }) {
  const info = kategoriaInfo(file.fajl_kategoria);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 rounded-2xl bg-slate-50 p-4 dark:bg-ink-800">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : dataUrl && mime?.startsWith("image/") ? (
          <img src={dataUrl} alt={file.filename} className="mx-auto max-h-72 max-w-full rounded-xl" />
        ) : dataUrl && mime === "application/pdf" ? (
          <iframe title={file.filename} src={dataUrl} className="h-72 w-full rounded-xl border border-ink-100 dark:border-ink-700" />
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <FileTypeIcon file={file} className="h-24 w-[72px]" />
            <p className="text-xs text-ink-400 dark:text-ink-500">Nincs előnézet ehhez a fájltípushoz.</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => downloadFileAction(file.sorszam, file.filename)}
        className="mt-4 flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
      >
        <PiDownloadSimpleLight className="h-4 w-4" />
        Letöltés
      </button>

      <dl className="mt-5 flex-shrink-0 space-y-3 text-sm">
        <div className="flex items-center gap-2.5 text-ink-600 dark:text-ink-300">
          <PiFileLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span>{info.label} · {formatFileSize(file.filesize)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-ink-600 dark:text-ink-300">
          <PiCalendarBlankLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span>{formatDate(file.feltoltve)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-ink-600 dark:text-ink-300">
          <PiUserLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span>{file.feltolto_nev || (file.tabla?.endsWith("_import") ? "Rendszer" : "Ismeretlen")}</span>
        </div>
        <div className="flex items-center gap-2.5 text-ink-600 dark:text-ink-300">
          <PiFolderLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span>{MODUL_LABEL[file.tabla] || file.tabla}</span>
        </div>
        {file.cimkek && (
          <div className="flex flex-wrap gap-1.5">
            {file.cimkek.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
              <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                {c}
              </span>
            ))}
          </div>
        )}
      </dl>

      {hasonloFajlok.length > 0 && (
        <div className="mt-6 flex-1">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            <PiStackLight className="h-3.5 w-3.5" />
            Hasonló fájlok
          </h4>
          <ul className="space-y-1">
            {hasonloFajlok.map((f) => (
              <li key={f.sorszam}>
                <button
                  type="button"
                  onClick={() => onValasztFajlt(f)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
                >
                  <span className="truncate">{f.filename}</span>
                  <span className="flex-shrink-0 text-ink-400 dark:text-ink-500">{formatFileSize(f.filesize)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function FajlPreviewPanel({ file, onClose, onValasztFajlt }) {
  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState(null);
  const [mime, setMime] = useState(null);
  const [hasonloFajlok, setHasonloFajlok] = useState([]);
  const isMobile = useMediaQuery({ maxWidth: 1023 });

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    setDataUrl(null);
    setHasonloFajlok([]);
    Promise.all([
      fetchAction("downloadFile", { id: file.sorszam }),
      fetchAction("getHasonloFajlok", { id: file.sorszam }),
    ]).then(([elonezetResult, hasonloResult]) => {
      if (elonezetResult?.success) {
        setMime(elonezetResult.mime);
        setDataUrl(`data:${elonezetResult.mime};base64,${elonezetResult.file}`);
      }
      if (hasonloResult?.success) setHasonloFajlok(hasonloResult.fajlok || []);
      setLoading(false);
    });
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [file, onClose]);

  if (!file) return null;

  const tartalom = (
    <ElonezetTartalom
      file={file}
      dataUrl={dataUrl}
      mime={mime}
      loading={loading}
      hasonloFajlok={hasonloFajlok}
      onValasztFajlt={onValasztFajlt}
    />
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-ink-950" role="dialog" aria-modal="true" aria-label={file.filename}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <p className="truncate text-sm font-semibold text-brand-900 dark:text-ink-50">{file.filename}</p>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
            <PiXLight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{tartalom}</div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-950/20" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={file.filename}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-ink-100 bg-white p-5 shadow-soft-lg dark:border-ink-800 dark:bg-ink-950"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="truncate pr-2 text-sm font-semibold text-brand-900 dark:text-ink-50">{file.filename}</p>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
            <PiXLight className="h-5 w-5" />
          </button>
        </div>
        {tartalom}
      </aside>
    </>
  );
}
