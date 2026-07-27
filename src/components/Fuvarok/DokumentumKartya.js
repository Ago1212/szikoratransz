import React, { useEffect, useRef, useState } from "react";
import { PiFileTextLight, PiFilePdfLight, PiWarningCircleLight, PiCheckCircleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const OCR_ALLAPOT_LABEL = {
  kesz: "Ellenőrzésre vár",
  hiba: "Kézi kitöltés szükséges",
  feldolgozatlan: "Feldolgozás alatt",
};

// Csak kép-kiterjesztésű fájloknál töltünk le valódi bélyegképet (a Fájlok
// modul FajlGrid.js-ének IntersectionObserver-mintáját követve) — PDF-nél
// egyszerű ikon, nem a teljes FileTypeIcon kategória-rendszer (a
// beerkezett_dokumentumok sor nem hordoz fajl_kategoria mezőt).
function isKepFajlnev(filename) {
  return /\.(jpe?g|png|gif|webp)$/i.test(filename || "");
}

export default function DokumentumKartya({ dokumentum, onOpen }) {
  const isKep = isKepFajlnev(dokumentum.filename);
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const thumbRef = useRef(null);
  const hibas = dokumentum.ocr_allapot === "hiba";
  const feldolgozatlan = dokumentum.ocr_allapot === "feldolgozatlan";

  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = thumbRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        fetchAction("downloadFile", { id: dokumentum.fajl_id })
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
  }, [isKep, dokumentum.fajl_id]);

  return (
    <button
      type="button"
      ref={thumbRef}
      onClick={() => onOpen(dokumentum)}
      className={`flex w-full flex-col rounded-2xl border bg-white p-3 text-left shadow-soft transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg dark:bg-ink-900 ${
        hibas
          ? "border-amber-300 dark:border-amber-700"
          : feldolgozatlan
            ? "border-sky-200 dark:border-sky-800"
            : "border-ink-100 dark:border-ink-800"
      }`}
    >
      <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-ink-800">
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={dokumentum.filename} className="h-full w-full object-cover" />
        ) : isKep && !thumbHiba ? (
          <div className="h-6 w-6 animate-pulse rounded-full bg-violet-200 motion-reduce:animate-none dark:bg-violet-900" />
        ) : isKep ? (
          <PiFileTextLight className="h-9 w-9 text-ink-400" />
        ) : (
          <PiFilePdfLight className="h-9 w-9 text-red-500" />
        )}
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-ink-500 dark:text-ink-300">
          {dokumentum.filename}
        </span>
        <span
          className={`flex flex-shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
            hibas
              ? "text-amber-600 dark:text-amber-400"
              : feldolgozatlan
                ? "text-sky-600 dark:text-sky-400"
                : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hibas ? (
            <PiWarningCircleLight className="h-3.5 w-3.5" />
          ) : feldolgozatlan ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 dark:border-sky-900 dark:border-t-sky-400" />
          ) : (
            <PiCheckCircleLight className="h-3.5 w-3.5" />
          )}
          {OCR_ALLAPOT_LABEL[dokumentum.ocr_allapot]}
        </span>
      </div>

      {dokumentum.ocr_adatok && (
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
          {[dokumentum.ocr_adatok.felrako, dokumentum.ocr_adatok.lerako].filter(Boolean).join(" → ") ||
            dokumentum.ocr_adatok.megbizo ||
            "—"}
        </p>
      )}
    </button>
  );
}
