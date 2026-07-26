import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { PiCameraLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";

// Sofőr-oldali, kizárólag feltöltésre szolgáló oldal — a sofőr lefotózza a
// fuvarlevelet/szállítólevelet, ez bekerül az admin-oldali "Beérkezett
// dokumentumok" inboxba (Task 12) OCR-feldolgozásra/fuvar-létrehozásra.
// A sofőrnek magának NINCS betekintése az inboxba/az OCR eredményébe —
// ez szándékos hatókör-döntés (ld. a terv), nem hiányzó funkció.
//
// `user.admin`/`user.id` — NEM `user.ceg_id` — ugyanaz a sofőr-munkamenet
// mezőnév-minta, mint amit Tankolas.js/BejelentesUj.js is használ: a
// driver-oldali `user` objektum `admin`-t (a tulajdonos cég admin.id-ja)
// és `id`-t (a sofőr saját user.id-ja) hordoz, `ceg_id` mezőt nem.
export default function DokumentumFeltoltes() {
  const history = useHistory();
  const [uploading, setUploading] = useState(false);

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
        toast.success("Dokumentum feltöltve, az admin fogja feldolgozni.");
        history.push("/user/dashboard");
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
          {uploading ? "Feldolgozás folyamatban…" : "Fotó készítése / kiválasztása"}
        </span>
        {/* A feltöltés maga gyors, de a szerver ezután egy Gemini OCR-hívást
            futtat a képen (dokumentáltan ~3-13 másodperc, néha több egy
            rate-limit-retry miatt) — enélkül a szöveg nélkül a sofőr úgy
            látná, mintha a feltöltés elakadt volna. */}
        {uploading && <span className="text-xs text-ink-400">Ez néhány másodpercig eltarthat, ne zárd be az oldalt.</span>}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}
