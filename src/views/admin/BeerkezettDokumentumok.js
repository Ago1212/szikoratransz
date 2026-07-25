import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { PiUploadLight, PiMagnifyingGlassLight } from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import DokumentumKartya from "components/Fuvarok/DokumentumKartya.js";
import DokumentumReviewPanel from "components/Fuvarok/DokumentumReviewPanel.js";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { uploadFajlXhr } from "components/Fajlok/fajlUploadXhr.js";
import { toast } from "utils/toast";

const ARCHIVUM_OLDALMERET = 12;

export default function BeerkezettDokumentumok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

  const [nezet, setNezet] = useState("varakozik"); // "varakozik" | "archivum"
  const [dokumentumok, setDokumentumok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feltoltesSor, setFeltoltesSor] = useState([]); // [{key, nev, progress}]
  const [reviewDokumentum, setReviewDokumentum] = useState(null);

  const [kereses, setKereses] = useState("");
  const [tipusSzuro, setTipusSzuro] = useState("");
  const [archivumOldal, setArchivumOldal] = useState(1);
  const [archivumTotal, setArchivumTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    if (nezet === "varakozik") {
      const result = await fetchAction("getBeerkezettDokumentumok", {
        ceg_id: user.ceg_id,
        csakFeldolgozatlan: true,
        tipus: tipusSzuro || undefined,
        search: kereses || undefined,
      });
      setDokumentumok(result?.success ? result.dokumentumok || [] : []);
    } else {
      const result = await fetchAction("getBeerkezettDokumentumok", {
        ceg_id: user.ceg_id,
        csakFeldolgozatlan: false,
        tipus: tipusSzuro || undefined,
        search: kereses || undefined,
        page: archivumOldal,
        pageSize: ARCHIVUM_OLDALMERET,
      });
      setDokumentumok(result?.success ? result.dokumentumok || [] : []);
      setArchivumTotal(result?.success ? result.total || 0 : 0);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nezet, tipusSzuro, kereses, archivumOldal, user.ceg_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    const sorTetelek = files.map((file, i) => ({ key: `${Date.now()}-${i}`, nev: file.name, progress: 0 }));
    setFeltoltesSor((prev) => [...prev, ...sorTetelek]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const kulcs = sorTetelek[i].key;
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadFajlXhr(
          { ceg_id: user.ceg_id, kerelmezo_id: user.id, base64, fajlnev: file.name },
          (percent) => {
            setFeltoltesSor((prev) => prev.map((t) => (t.key === kulcs ? { ...t, progress: percent } : t)));
          },
          "elemezBeerkezettDokumentum",
        );
        if (result?.success) {
          toast.success(
            result.dokumentum.ocr_allapot === "kesz"
              ? `${file.name}: feldolgozva.`
              : `${file.name}: feltöltve, de az automatikus feldolgozás sikertelen — töltsd ki kézzel.`,
          );
        } else {
          toast.error(`${file.name}: ${result?.message || "a feltöltés sikertelen."}`);
        }
      } catch (error) {
        toast.error(`${file.name}: a feltöltés sikertelen.`);
      } finally {
        setFeltoltesSor((prev) => prev.filter((t) => t.key !== kulcs));
      }
    }
    load();
  };

  const handleDiscarded = (id) => {
    setDokumentumok((prev) => prev.filter((d) => d.id !== id));
    setReviewDokumentum(null);
  };

  const handleCreateFuvar = (dokumentum) => {
    history.push("/admin/fuvarForm", {
      dokumentumId: dokumentum.id,
      ocrAdatok: dokumentum.ocr_adatok || {},
    });
  };

  const hibasak = dokumentumok.filter((d) => d.ocr_allapot === "hiba");
  const keszek = dokumentumok.filter((d) => d.ocr_allapot !== "hiba");

  return (
    <>
      <PageHeader eyebrow="Fuvarok" title="Beérkezett dokumentumok" />

      <div className="mb-4 flex gap-2 rounded-full bg-slate-100 p-1 dark:bg-ink-800">
        <button
          type="button"
          onClick={() => setNezet("varakozik")}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            nezet === "varakozik" ? "bg-white text-brand-700 shadow-soft dark:bg-ink-900 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
          }`}
        >
          Feldolgozásra vár
        </button>
        <button
          type="button"
          onClick={() => {
            setNezet("archivum");
            setArchivumOldal(1);
          }}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            nezet === "archivum" ? "bg-white text-brand-700 shadow-soft dark:bg-ink-900 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
          }`}
        >
          Archívum
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-dashed border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700">
          <PiUploadLight className="h-4 w-4" />
          Dokumentum feltöltése (több is kijelölhető)
          <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFilesSelected} />
        </label>

        {feltoltesSor.length > 0 && (
          <div className="mt-3 space-y-2">
            {feltoltesSor.map((t) => (
              <div key={t.key} className="text-xs text-ink-500 dark:text-ink-400">
                <div className="mb-0.5 flex justify-between">
                  <span className="truncate">{t.nev}</span>
                  <span>{t.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${t.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <PiMagnifyingGlassLight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={kereses}
            onChange={(e) => setKereses(e.target.value)}
            placeholder="Keresés fájlnév vagy kinyert adat szerint..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          />
        </div>
        <select
          value={tipusSzuro}
          onChange={(e) => setTipusSzuro(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
        >
          <option value="">Minden típus</option>
          <option value="fuvarlevel">Fuvarlevél</option>
          <option value="szallitolevel">Szállítólevél</option>
          <option value="ismeretlen">Ismeretlen</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Betöltés...</p>
      ) : dokumentumok.length === 0 ? (
        <p className="text-sm text-ink-400">
          {nezet === "varakozik" ? "Nincs feldolgozásra váró dokumentum." : "Nincs a szűrésnek megfelelő dokumentum."}
        </p>
      ) : nezet === "varakozik" ? (
        <div className="space-y-6">
          {hibasak.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Kézi kitöltés szükséges ({hibasak.length})
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {hibasak.map((dok) => (
                  <DokumentumKartya key={dok.id} dokumentum={dok} onOpen={setReviewDokumentum} />
                ))}
              </div>
            </div>
          )}
          {keszek.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                Ellenőrzésre vár ({keszek.length})
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {keszek.map((dok) => (
                  <DokumentumKartya key={dok.id} dokumentum={dok} onOpen={setReviewDokumentum} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dokumentumok.map((dok) => (
              <DokumentumKartya key={dok.id} dokumentum={dok} onOpen={setReviewDokumentum} />
            ))}
          </div>
          {archivumTotal > ARCHIVUM_OLDALMERET && (
            <div className="mt-4 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
              <button
                type="button"
                disabled={archivumOldal <= 1}
                onClick={() => setArchivumOldal((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-ink-800"
              >
                Előző
              </button>
              <span>
                {archivumOldal}. oldal / {Math.ceil(archivumTotal / ARCHIVUM_OLDALMERET)}
              </span>
              <button
                type="button"
                disabled={archivumOldal >= Math.ceil(archivumTotal / ARCHIVUM_OLDALMERET)}
                onClick={() => setArchivumOldal((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-ink-800"
              >
                Következő
              </button>
            </div>
          )}
        </>
      )}

      <DokumentumReviewPanel
        dokumentum={reviewDokumentum}
        onClose={() => setReviewDokumentum(null)}
        onDiscarded={handleDiscarded}
        onCreateFuvar={handleCreateFuvar}
      />
    </>
  );
}
