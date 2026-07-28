import React, { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { PiXLight, PiWarningCircleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import Spinner from "components/UI/Spinner.js";
import AutocompleteSelect from "components/UI/AutocompleteSelect.js";

const TIPUS_OPTIONS = [
  { value: "fuvarlevel", label: "Fuvarlevél" },
  { value: "szallitolevel", label: "Szállítólevél" },
  { value: "ismeretlen", label: "Ismeretlen típus" },
];

function ElonezetKep({ dataUrl, mime, loading, filename }) {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 dark:bg-ink-800">
        <Spinner />
      </div>
    );
  }
  if (dataUrl && mime?.startsWith("image/")) {
    return <img src={dataUrl} alt={filename} className="mx-auto max-h-96 max-w-full rounded-xl" />;
  }
  if (dataUrl && mime === "application/pdf") {
    return (
      <iframe
        title={filename}
        src={dataUrl}
        className="h-96 w-full rounded-xl border border-ink-100 dark:border-ink-700"
      />
    );
  }
  return (
    <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-xs text-ink-400 dark:bg-ink-800 dark:text-ink-500">
      Nincs előnézet ehhez a fájltípushoz.
    </div>
  );
}

export default function DokumentumReviewPanel({ dokumentum, soforok = [], onClose, onDiscarded, onCreateFuvar, onAttached, onSoforAssigned }) {
  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState(null);
  const [mime, setMime] = useState(null);
  const [tipus, setTipus] = useState(dokumentum?.tipus || "ismeretlen");
  const [soforId, setSoforId] = useState(dokumentum?.hozzarendelt_sofor_id || "");
  const [discarding, setDiscarding] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 1023 });
  const ocr = dokumentum?.ocr_adatok || {};

  // Gyakori, hogy egy fuvarhoz KÉT dokumentum is tartozik (fuvarlevél +
  // szállítólevél, külön feltöltve) — ez a panel emellett kínálja fel egy
  // MÁR LÉTEZŐ fuvarhoz való csatolást is (nem csak új fuvar létrehozását).
  // A fuvarok teljes listája csak a picker MEGNYITÁSAKOR töltődik be (nem a
  // panel megnyitásakor), hogy a gyakoribb "Fuvar létrehozása" út ne fizessen
  // rá egy felesleges lekérdezésre.
  const [csatolasNyitva, setCsatolasNyitva] = useState(false);
  const [fuvarOptions, setFuvarOptions] = useState([]);
  const [fuvarOptionsLoading, setFuvarOptionsLoading] = useState(false);
  const [kivalasztottFuvarId, setKivalasztottFuvarId] = useState("");
  const [csatolasFolyamatban, setCsatolasFolyamatban] = useState(false);

  useEffect(() => {
    if (!dokumentum) return;
    setTipus(dokumentum.tipus);
    setSoforId(dokumentum.hozzarendelt_sofor_id || "");
    setLoading(true);
    setDataUrl(null);
    fetchAction("downloadFile", { id: dokumentum.fajl_id }).then((result) => {
      if (result?.success) {
        setMime(result.mime);
        setDataUrl(`data:${result.mime};base64,${result.file}`);
      }
      setLoading(false);
    });
  }, [dokumentum]);

  useEffect(() => {
    if (!dokumentum) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dokumentum, onClose]);

  useEffect(() => {
    setCsatolasNyitva(false);
    setKivalasztottFuvarId("");
  }, [dokumentum]);

  if (!dokumentum) return null;

  const handleCsatolasMegnyitasa = async () => {
    setCsatolasNyitva(true);
    if (fuvarOptions.length > 0) return;
    setFuvarOptionsLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getFuvarok", { ceg_id: user.ceg_id });
    if (result?.success) {
      setFuvarOptions(
        (result.fuvarok || []).map((f) => ({
          value: f.id,
          label: `${f.teljesites_datuma || "?"} · ${f.felrako || "?"} → ${f.lerako || "?"}${f.megbizo_nev ? ` (${f.megbizo_nev})` : ""}`,
          searchText: [f.teljesites_datuma, f.felrako, f.lerako, f.megbizo_nev, f.sofor_nev, f.kamion_rendszam, f.furgon_rendszam]
            .filter(Boolean)
            .join(" "),
        })),
      );
    }
    setFuvarOptionsLoading(false);
  };

  const handleCsatolas = async () => {
    if (!kivalasztottFuvarId) return;
    setCsatolasFolyamatban(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("csatolBeerkezettDokumentumotFuvarhoz", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      dokumentumId: dokumentum.id,
      fuvarId: kivalasztottFuvarId,
    });
    setCsatolasFolyamatban(false);
    if (result?.success) {
      toast.success("Dokumentum csatolva a fuvarhoz.");
      onAttached?.(dokumentum.id);
    } else {
      toast.error(result?.message || "A csatolás sikertelen.");
    }
  };

  const handleTipusChange = async (ujTipus) => {
    setTipus(ujTipus);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("updateBeerkezettDokumentumTipus", {
      ceg_id: user.ceg_id,
      id: dokumentum.id,
      tipus: ujTipus,
    });
    if (!result?.success) {
      toast.error(result?.message || "A típus módosítása sikertelen.");
      setTipus(dokumentum.tipus);
    }
  };

  const handleSoforChange = async (ujSoforId) => {
    setSoforId(ujSoforId);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("updateBeerkezettDokumentumSofor", {
      ceg_id: user.ceg_id,
      id: dokumentum.id,
      soforId: ujSoforId || undefined,
    });
    if (result?.success) {
      onSoforAssigned?.();
    } else {
      toast.error(result?.message || "A sofőr hozzárendelése sikertelen.");
      setSoforId(dokumentum.hozzarendelt_sofor_id || "");
    }
  };

  const handleElvetes = async () => {
    if (!(await confirmDialog("Biztosan elveted ezt a dokumentumot? Ez nem hozható létre belőle fuvar a jövőben."))) {
      return;
    }
    setDiscarding(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("torolBeerkezettDokumentum", { ceg_id: user.ceg_id, id: dokumentum.id });
    setDiscarding(false);
    if (result?.success) {
      toast.success("Dokumentum elvetve.");
      onDiscarded(dokumentum.id);
    } else {
      toast.error(result?.message || "A dokumentum elvetése sikertelen.");
    }
  };

  const bizonytalan = ocr.egyeb_megjegyzes && /bizonytalan/i.test(ocr.egyeb_megjegyzes);

  const tartalom = (
    <>
      <ElonezetKep dataUrl={dataUrl} mime={mime} loading={loading} filename={dokumentum.filename} />

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400">
          Típus
          <select
            value={tipus}
            onChange={(e) => handleTipusChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm normal-case tracking-normal text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            {TIPUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400">
          Sofőr
          <select
            value={soforId}
            onChange={(e) => handleSoforChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm normal-case tracking-normal text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            <option value="">Nincs hozzárendelve</option>
            {soforok.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {ocr.sofor_neve && (
            <span className="mt-1 block text-[11px] font-normal normal-case text-ink-400">
              OCR szerint: {ocr.sofor_neve}
            </span>
          )}
        </label>

        <dl className="space-y-1 text-sm text-ink-700 dark:text-ink-200">
          {ocr.felrako && <div><dt className="inline font-semibold text-ink-400">Felrakó: </dt><dd className="inline">{ocr.felrako}</dd></div>}
          {ocr.lerako && <div><dt className="inline font-semibold text-ink-400">Lerakó: </dt><dd className="inline">{ocr.lerako}</dd></div>}
          {ocr.megbizo && <div><dt className="inline font-semibold text-ink-400">Megbízó: </dt><dd className="inline">{ocr.megbizo}</dd></div>}
          {ocr.datum && <div><dt className="inline font-semibold text-ink-400">Dátum: </dt><dd className="inline">{ocr.datum}</dd></div>}
          {ocr.rendszam && <div><dt className="inline font-semibold text-ink-400">Rendszám: </dt><dd className="inline">{ocr.rendszam}</dd></div>}
          {ocr.tavolsag_km != null && <div><dt className="inline font-semibold text-ink-400">Távolság: </dt><dd className="inline">{ocr.tavolsag_km} km</dd></div>}
          {ocr.tomeg_kg != null && <div><dt className="inline font-semibold text-ink-400">Tömeg: </dt><dd className="inline">{ocr.tomeg_kg} kg</dd></div>}
        </dl>

        {bizonytalan && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <PiWarningCircleLight className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {ocr.egyeb_megjegyzes}
          </p>
        )}
      </div>

      {csatolasNyitva && (
        <div className="mt-4 rounded-xl border border-ink-100 bg-sand-50 p-3 dark:border-ink-800 dark:bg-ink-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Csatolás meglévő fuvarhoz
          </p>
          <AutocompleteSelect
            options={fuvarOptions}
            value={kivalasztottFuvarId}
            onChange={setKivalasztottFuvarId}
            placeholder={fuvarOptionsLoading ? "Fuvarok betöltése…" : "Keresés útvonal, megbízó, sofőr szerint…"}
            disabled={fuvarOptionsLoading}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCsatolasNyitva(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-700"
            >
              Mégse
            </button>
            <button
              type="button"
              onClick={handleCsatolas}
              disabled={!kivalasztottFuvarId || csatolasFolyamatban}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Csatolás
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
        <button
          type="button"
          onClick={handleElvetes}
          disabled={discarding}
          className="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Elvetés
        </button>
        <div className="flex items-center gap-2">
          {!csatolasNyitva && (
            <button
              type="button"
              onClick={handleCsatolasMegnyitasa}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
            >
              Csatolás meglévő fuvarhoz
            </button>
          )}
          <button
            type="button"
            onClick={() => onCreateFuvar(dokumentum)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700"
          >
            Fuvar létrehozása →
          </button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-ink-950" role="dialog" aria-modal="true" aria-label="Dokumentum ellenőrzése">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <p className="truncate text-sm font-semibold text-brand-900 dark:text-ink-50">Dokumentum ellenőrzése</p>
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
        aria-label="Dokumentum ellenőrzése"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-ink-100 bg-white p-5 shadow-soft-lg dark:border-ink-800 dark:bg-ink-950"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="truncate pr-2 text-sm font-semibold text-brand-900 dark:text-ink-50">Dokumentum ellenőrzése</p>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
            <PiXLight className="h-5 w-5" />
          </button>
        </div>
        {tartalom}
      </aside>
    </>
  );
}
