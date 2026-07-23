import React, { useRef, useState } from "react";
import { PiCloudArrowUpLight, PiArrowClockwiseLight, PiXLight, PiCheckCircleLight, PiWarningCircleLight } from "react-icons/pi";
import { uploadFajlXhr } from "components/Fajlok/fajlUploadXhr.js";

const MAX_FAJLMERET_BYTE = 10 * 1024 * 1024;
let sorszamSzamlalo = 0;

function fajlBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Drag&drop feltöltési zóna + feltöltési sor (queue) — soronkénti,
// tényleges (nem kitalált) byte-alapú progresszel (ld. fajlUploadXhr.js,
// mert a megosztott `fetchAction` a `fetch()`-et használja, ami nem ad
// feltöltési progress eseményt). Hiba esetén a tétel a sorban marad,
// "Újra" gombbal — nem tűnik el nyomtalanul, mint korábban egy toast
// mögött (ld. audit #9, Error state).
export default function FajlUploadZone({ admin, id, tabla, onUploadSuccess, compact = false }) {
  const [queue, setQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const feltoltEgyet = async (tetel) => {
    setQueue((prev) => prev.map((t) => (t.kulcs === tetel.kulcs ? { ...t, statusz: "feltoltes", hiba: null, progress: 0 } : t)));
    try {
      if (tetel.file.size > MAX_FAJLMERET_BYTE) {
        throw new Error("A fájl mérete túl nagy (maximum 10MB).");
      }
      const base64 = await fajlBase64(tetel.file);
      const result = await uploadFajlXhr(
        { admin, id, tabla, file: base64, name: tetel.file.name, size: tetel.file.size },
        (progress) => setQueue((prev) => prev.map((t) => (t.kulcs === tetel.kulcs ? { ...t, progress } : t))),
      );
      if (!result?.success) {
        throw new Error(result?.message || "A feltöltés sikertelen.");
      }
      setQueue((prev) => prev.map((t) => (t.kulcs === tetel.kulcs ? { ...t, statusz: "kesz", progress: 100 } : t)));
      onUploadSuccess?.();
    } catch (error) {
      setQueue((prev) => prev.map((t) => (t.kulcs === tetel.kulcs ? { ...t, statusz: "hiba", hiba: error.message } : t)));
    }
  };

  const fajlokHozzaadasa = (fileList) => {
    const ujTetelek = Array.from(fileList).map((file) => ({
      kulcs: `f${++sorszamSzamlalo}`,
      file,
      statusz: "varakozik",
      progress: 0,
      hiba: null,
    }));
    if (ujTetelek.length === 0) return;
    setQueue((prev) => [...prev, ...ujTetelek]);
    ujTetelek.forEach((tetel) => feltoltEgyet(tetel));
  };

  const eltavolitas = (kulcs) => setQueue((prev) => prev.filter((t) => t.kulcs !== kulcs));
  const ujra = (kulcs) => {
    const tetel = queue.find((t) => t.kulcs === kulcs);
    if (tetel) feltoltEgyet(tetel);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) fajlokHozzaadasa(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors duration-150 ${
          compact ? "px-4 py-3" : "px-6 py-12"
        } ${
          dragOver
            ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/30"
            : "border-ink-200 bg-slate-50 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900"
        }`}
      >
        <PiCloudArrowUpLight className={`${compact ? "h-6 w-6" : "h-10 w-10"} text-brand-500`} />
        <p className={`text-center font-medium text-ink-700 dark:text-ink-200 ${compact ? "text-xs" : "text-sm"}`}>
          {compact ? "Húzd ide a fájlokat, vagy kattints a feltöltéshez" : "Húzd ide a fájlokat feltöltéshez"}
        </p>
        {!compact && <p className="text-xs text-ink-400 dark:text-ink-500">vagy kattints a tallózáshoz — egyszerre több fájl is</p>}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            fajlokHozzaadasa(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((tetel) => (
            <div
              key={tetel.kulcs}
              className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm dark:border-ink-800 dark:bg-ink-900"
            >
              {tetel.statusz === "kesz" && <PiCheckCircleLight className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
              {tetel.statusz === "hiba" && <PiWarningCircleLight className="h-4 w-4 flex-shrink-0 text-red-600" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink-700 dark:text-ink-200">{tetel.file.name}</p>
                {tetel.statusz === "feltoltes" && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-200 motion-reduce:transition-none"
                      style={{ width: `${tetel.progress}%` }}
                    />
                  </div>
                )}
                {tetel.statusz === "hiba" && <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{tetel.hiba}</p>}
              </div>
              {tetel.statusz === "hiba" && (
                <button
                  type="button"
                  onClick={() => ujra(tetel.kulcs)}
                  title="Újra"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-800"
                >
                  <PiArrowClockwiseLight className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => eltavolitas(tetel.kulcs)}
                title="Eltávolítás a sorból"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-slate-100 hover:text-ink-600 dark:text-ink-500 dark:hover:bg-ink-800"
              >
                <PiXLight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
