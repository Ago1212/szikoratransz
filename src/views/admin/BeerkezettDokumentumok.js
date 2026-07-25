import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import {
  PiFileTextLight,
  PiUploadLight,
  PiWarningCircleLight,
  PiCheckCircleLight,
} from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";

const OCR_ALLAPOT_LABEL = {
  kesz: "Feldolgozva",
  hiba: "OCR sikertelen",
  feldolgozatlan: "Feldolgozás alatt",
};

const OCR_ALLAPOT_TONE = {
  kesz: "text-emerald-600",
  hiba: "text-amber-600",
  feldolgozatlan: "text-ink-400",
};

export default function BeerkezettDokumentumok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [dokumentumok, setDokumentumok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAction("getBeerkezettDokumentumok", {
      ceg_id: user.ceg_id,
    });
    setDokumentumok(result?.success ? result.dokumentumok || [] : []);
    setLoading(false);
  }, [user.ceg_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await fetchAction("elemezBeerkezettDokumentum", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        base64,
        fajlnev: file.name,
      });
      if (result?.success) {
        toast.success(
          result.dokumentum.ocr_allapot === "kesz"
            ? "Dokumentum feltöltve és feldolgozva."
            : "Dokumentum feltöltve, de az automatikus feldolgozás sikertelen — töltsd ki kézzel.",
        );
        load();
      } else {
        toast.error(result?.message || "A feltöltés sikertelen.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleFuvarLetrehozasa = (dokumentum) => {
    history.push("/admin/fuvarForm", {
      dokumentumId: dokumentum.id,
      ocrAdatok: dokumentum.ocr_adatok || {},
    });
  };

  return (
    <>
      <PageHeader eyebrow="Fuvarok" title="Beérkezett dokumentumok" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <div className="mb-4 rounded-2xl border border-dashed border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700">
              <PiUploadLight className="h-4 w-4" />
              {uploading ? "Feldolgozás..." : "Dokumentum feltöltése"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-ink-400">Betöltés...</p>
          ) : dokumentumok.length === 0 ? (
            <p className="text-sm text-ink-400">
              Nincs feldolgozásra váró dokumentum.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dokumentumok.map((dok) => (
                <div
                  key={dok.id}
                  className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-semibold text-ink-500">
                      <PiFileTextLight className="h-4 w-4" />
                      {dok.filename}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold ${OCR_ALLAPOT_TONE[dok.ocr_allapot]}`}
                    >
                      {dok.ocr_allapot === "hiba" ? (
                        <PiWarningCircleLight className="h-4 w-4" />
                      ) : (
                        <PiCheckCircleLight className="h-4 w-4" />
                      )}
                      {OCR_ALLAPOT_LABEL[dok.ocr_allapot]}
                    </span>
                  </div>
                  <select
                    className="mb-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:bg-ink-800"
                    value={dok.tipus}
                    onChange={async (e) => {
                      const ujTipus = e.target.value;
                      const result = await fetchAction("updateBeerkezettDokumentumTipus", {
                        ceg_id: user.ceg_id,
                        id: dok.id,
                        tipus: ujTipus,
                      });
                      if (result?.success) {
                        setDokumentumok((prev) =>
                          prev.map((d) => (d.id === dok.id ? { ...d, tipus: ujTipus } : d)),
                        );
                      } else {
                        toast.error(result?.message || "A típus módosítása sikertelen.");
                      }
                    }}
                  >
                    <option value="fuvarlevel">Fuvarlevél</option>
                    <option value="szallitolevel">Szállítólevél</option>
                    <option value="ismeretlen">Ismeretlen típus</option>
                  </select>
                  {dok.ocr_adatok && (
                    <ul className="mb-3 space-y-0.5 text-sm text-ink-700 dark:text-ink-200">
                      {dok.ocr_adatok.felrako && <li>Felrakó: {dok.ocr_adatok.felrako}</li>}
                      {dok.ocr_adatok.lerako && <li>Lerakó: {dok.ocr_adatok.lerako}</li>}
                      {dok.ocr_adatok.megbizo && <li>Megbízó: {dok.ocr_adatok.megbizo}</li>}
                      {dok.ocr_adatok.datum && <li>Dátum: {dok.ocr_adatok.datum}</li>}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => handleFuvarLetrehozasa(dok)}
                    className="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700"
                  >
                    Fuvar létrehozása
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
