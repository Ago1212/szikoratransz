import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiCameraLight,
  PiFilePdfLight,
  PiTrashLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";

// Sofőr-oldali, kizárólag feltöltésre szolgáló oldal — a sofőr lefotózza a
// fuvarlevelet/szállítólevelet, ez bekerül az admin-oldali "Beérkezett
// dokumentumok" inboxba (Task 12) OCR-feldolgozásra/fuvar-létrehozásra.
// A sofőrnek magának NINCS betekintése az inboxba/az OCR eredményébe —
// ez szándékos hatókör-döntés (ld. a terv), nem hiányzó funkció. A saját
// feltöltési ELŐZMÉNY (ld. lentebb) ettől független: csak azt mutatja meg,
// mit töltött fel és hol tart a feldolgozásban, az OCR-eredményt magát nem.
//
// `user.admin`/`user.id` — NEM `user.ceg_id` — ugyanaz a sofőr-munkamenet
// mezőnév-minta, mint amit Tankolas.js/BejelentesUj.js is használ: a
// driver-oldali `user` objektum `admin`-t (a tulajdonos cég admin.id-ja)
// és `id`-t (a sofőr saját user.id-ja) hordoz, `ceg_id` mezőt nem.

const OCR_STATUSZ_TONE = { feldolgozatlan: "info", kesz: "success", hiba: "danger" };
const OCR_STATUSZ_LABEL = {
  feldolgozatlan: "Feldolgozás alatt",
  kesz: "Feldolgozva",
  hiba: "Hiba – admin pótolja",
};

function DokumentumSor({ dokumentum, onDeleted }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const [torles, setTorles] = useState(false);
  const isKep = dokumentum.fajl_kategoria === "kep";
  const rowRef = useRef(null);

  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = rowRef.current;
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

  const handleDelete = async () => {
    const ok = await confirmDialog(
      `Biztosan törlöd a(z) "${dokumentum.filename || "dokumentum"}" feltöltést?`,
      { confirmLabel: "Törlés" },
    );
    if (!ok) return;
    setTorles(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("torolSajatBeerkezettDokumentum", {
      id: dokumentum.id,
      sofor_id: user.id,
    });
    if (result?.success) {
      toast.success("Dokumentum törölve.");
      onDeleted(dokumentum.id);
    } else {
      toast.error(result?.message || "A törlés sikertelen.");
      setTorles(false);
    }
  };

  return (
    <div
      ref={rowRef}
      className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-soft"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50">
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={dokumentum.filename || "dokumentum előnézet"} className="h-full w-full object-cover" />
        ) : (
          <PiFilePdfLight className="h-6 w-6 text-ink-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">
          {dokumentum.filename || "Dokumentum"}
        </p>
        <p className="text-xs text-ink-400">
          {(dokumentum.letrehozva || "").slice(0, 16).replace("T", " ")}
        </p>
      </div>
      <StatusBadge tone={OCR_STATUSZ_TONE[dokumentum.ocr_allapot] || "neutral"}>
        {OCR_STATUSZ_LABEL[dokumentum.ocr_allapot] || dokumentum.ocr_allapot}
      </StatusBadge>
      {dokumentum.torolheto && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={torles}
          aria-label="Dokumentum törlése"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <PiTrashLight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function DokumentumFeltoltes() {
  const history = useHistory();
  const [uploading, setUploading] = useState(false);
  const [elozmeny, setElozmeny] = useState([]);
  const [elozmenyBetoltve, setElozmenyBetoltve] = useState(false);

  const betoltElozmeny = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getSajatBeerkezettDokumentumok", {
      sofor_id: user.id,
    });
    if (result?.success) setElozmeny(result.dokumentumok || []);
    setElozmenyBetoltve(true);
  }, []);

  useEffect(() => {
    betoltElozmeny();
  }, [betoltElozmeny]);

  const pollSzamlalo = useRef(0);
  const POLL_KOZ_MS = 4000;
  const POLL_MAX_SZAMLALO = 15;

  useEffect(() => {
    const vanFeldolgozatlan = elozmeny.some((d) => d.ocr_allapot === "feldolgozatlan");
    if (!vanFeldolgozatlan) {
      pollSzamlalo.current = 0;
      return undefined;
    }
    if (pollSzamlalo.current >= POLL_MAX_SZAMLALO) {
      return undefined;
    }
    const idozito = setTimeout(() => {
      pollSzamlalo.current += 1;
      betoltElozmeny();
    }, POLL_KOZ_MS);
    return () => clearTimeout(idozito);
  }, [elozmeny, betoltElozmeny]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const user = JSON.parse(localStorage.getItem("user"));
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await fetchAction("elemezBeerkezettDokumentum", {
        ceg_id: user.admin,
        kerelmezo_id: user.id,
        base64,
        fajlnev: file.name,
      });
      if (result?.success) {
        toast.success("Sikeresen feltöltve! A feldolgozás a háttérben folytatódik, kiléphetsz.");
        betoltElozmeny();
      } else {
        toast.error(result?.message || "A feltöltés sikertelen.");
      }
    } catch (err) {
      toast.error(err.message || "A feltöltés sikertelen.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleted = (id) => {
    setElozmeny((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Dokumentum feltöltése" />

      <p className="text-sm text-ink-500">
        Fotózd le a fuvarlevelet vagy a szállítólevelet — az admin fogja feldolgozni és
        fuvart készíteni belőle.
      </p>

      <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-white py-8 text-center shadow-soft">
        {uploading ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        ) : (
          <PiCameraLight className="h-8 w-8 text-brand-600" />
        )}
        <span className="text-sm font-semibold text-ink-700">
          {uploading ? "Feltöltés…" : "Fotó készítése / kiválasztása"}
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />
      </label>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Korábbi feltöltéseim
        </h2>
        {!elozmenyBetoltve ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm text-ink-400 shadow-soft">
            Betöltés…
          </div>
        ) : elozmeny.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm text-ink-400 shadow-soft">
            Még nincs feltöltött dokumentumod.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {elozmeny.map((d) => (
              <DokumentumSor key={d.id} dokumentum={d} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
