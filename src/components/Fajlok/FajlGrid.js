import React, { useEffect, useRef, useState } from "react";
import { PiEyeLight, PiDownloadSimpleLight, PiPencilSimpleLight, PiTrashLight, PiCheckLight, PiXLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";
import { toast } from "utils/toast";
import { kategoriaInfo, formatFileSize } from "components/Fajlok/fajlKategoriaInfo.js";
import FajlGridSkeleton from "components/Fajlok/FajlGridSkeleton.js";
import FileTypeIcon from "components/Fajlok/FileTypeIcon.js";

function FajlKartya({ file, kijelolve, onToggleSelect, onOpenPreview, onDelete, onRename }) {
  const [szerkesztes, setSzerkesztes] = useState(false);
  const [nevMezo, setNevMezo] = useState(file.filename);
  const info = kategoriaInfo(file.fajl_kategoria);
  const Icon = info.icon;
  const isKep = file.fajl_kategoria === "kep";
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const thumbRef = useRef(null);

  // Kép kategóriánál a kártya valódi, kicsinyített tartalom-előnézetet mutat
  // (nem csak típus-ikont) — de csak akkor tölti le a (potenciálisan nagy)
  // base64 tartalmat, ha a kártya ténylegesen a látható területre görgetett
  // (IntersectionObserver), hogy egy hosszú lista ne indítson egyszerre
  // tucatnyi felesleges letöltést. Nem-kép fájloknál marad a `FileTypeIcon`
  // "szép logó" — oda letöltés sosem indul.
  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = thumbRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        fetchAction("downloadFile", { id: file.sorszam })
          .then((result) => {
            if (result?.success && result.mime?.startsWith("image/")) {
              setThumbSrc(`data:${result.mime};base64,${result.file}`);
            } else {
              setThumbHiba(true);
            }
          })
          .catch(() => setThumbHiba(true));
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKep, file.sorszam]);

  const mentesNev = async () => {
    const uj = nevMezo.trim();
    if (!uj || uj === file.filename) {
      setSzerkesztes(false);
      setNevMezo(file.filename);
      return;
    }
    await onRename(file.sorszam, uj);
    setSzerkesztes(false);
  };

  return (
    <div
      className={`group relative rounded-2xl border bg-white p-3 shadow-soft transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg dark:bg-ink-900 ${
        kijelolve ? "border-brand-400 ring-2 ring-brand-200 dark:border-brand-600 dark:ring-brand-900" : "border-ink-100 dark:border-ink-800"
      }`}
    >
      <input
        type="checkbox"
        checked={kijelolve}
        onChange={() => onToggleSelect(file.sorszam)}
        className={`absolute left-4 top-4 z-10 h-4 w-4 rounded transition-opacity duration-150 ${
          kijelolve
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        }`}
        aria-label={`${file.filename} kijelölése`}
      />

      <button
        type="button"
        ref={thumbRef}
        onClick={() => onOpenPreview(file)}
        className={`mb-3 flex h-20 w-full items-center justify-center overflow-hidden rounded-xl ${
          isKep ? "bg-slate-100 dark:bg-ink-800" : info.bg
        }`}
      >
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={file.filename} className="h-full w-full object-cover" />
        ) : isKep && !thumbHiba ? (
          <div className="h-6 w-6 animate-pulse rounded-full bg-violet-200 motion-reduce:animate-none dark:bg-violet-900" />
        ) : isKep ? (
          <Icon className={`h-9 w-9 ${info.szin}`} />
        ) : (
          <FileTypeIcon file={file} />
        )}
      </button>

      {szerkesztes ? (
        <div className="mb-1 flex items-center gap-1">
          <input
            autoFocus
            value={nevMezo}
            onChange={(e) => setNevMezo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") mentesNev();
              if (e.key === "Escape") {
                setSzerkesztes(false);
                setNevMezo(file.filename);
              }
            }}
            className="w-full rounded-lg border border-brand-300 bg-white px-2 py-1 text-xs text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:bg-ink-800 dark:text-ink-50"
          />
          <button type="button" onClick={mentesNev} className="flex-shrink-0 text-emerald-600">
            <PiCheckLight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSzerkesztes(false);
              setNevMezo(file.filename);
            }}
            className="flex-shrink-0 text-ink-400"
          >
            <PiXLight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="truncate text-xs font-semibold text-brand-900 dark:text-ink-50" title={file.filename}>
          {file.filename}
        </p>
      )}
      <p className="mt-0.5 text-[11px] text-ink-400 dark:text-ink-500">
        {info.label} · {formatFileSize(file.filesize)}
      </p>

      <div className="mt-2 flex items-center justify-end gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onOpenPreview(file)}
          title="Előnézet"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <PiEyeLight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => downloadFileAction(file.sorszam, file.filename).catch(() => toast.error("A fájl letöltése sikertelen."))}
          title="Letöltés"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <PiDownloadSimpleLight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setSzerkesztes(true)}
          title="Átnevezés"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <PiPencilSimpleLight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(file.sorszam)}
          title="Törlés"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600 dark:text-ink-400 dark:hover:bg-red-950/40"
        >
          <PiTrashLight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function FajlGrid({ files, loading, selectedIds, onToggleSelect, onOpenPreview, onDelete, onRename, emptyState }) {
  if (loading) return <FajlGridSkeleton />;
  if (files.length === 0) return emptyState;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {files.map((file) => (
        <FajlKartya
          key={file.sorszam}
          file={file}
          kijelolve={selectedIds.has(file.sorszam)}
          onToggleSelect={onToggleSelect}
          onOpenPreview={onOpenPreview}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
