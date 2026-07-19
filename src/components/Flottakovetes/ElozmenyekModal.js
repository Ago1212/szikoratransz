import React, { useState } from "react";
import { PiMapTrifoldLight, PiRoadHorizonLight, PiClockLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";

const ma = () => new Date().toISOString().slice(0, 10);

// Útvonal-előzmény — a GPSmart `waybill.pl` végpontja adja vissza egy adott
// jármű (saját GPSmart `car_id`-je) tényleges GPS-nyomvonalát egy dátum-
// tartományra, a köztes megállásokkal (szakaszokkal) és egy napi
// összesítővel együtt. A lekérdezett pontokat a hívó (Flottakovetes.js)
// jeleníti meg a térképen (`onUtvonalBetoltve`), itt csak a vezérlés és a
// szöveges összegzés/szakasz-lista él.
export default function ElozmenyekModal({
  open,
  onClose,
  jarmu,
  cegId,
  kerelmezoId,
  onUtvonalBetoltve,
}) {
  const [datumTol, setDatumTol] = useState(ma());
  const [datumIg, setDatumIg] = useState(ma());
  const [loading, setLoading] = useState(false);
  const [eredmeny, setEredmeny] = useState(null);

  if (!jarmu) return null;

  const handleLekerdezes = async () => {
    if (!jarmu.car_id) {
      toast.error("Ehhez a járműhöz nincs GPSmart azonosítója — nem kérdezhető le az útvonala.");
      return;
    }
    // Egy nagyobb (kb. 1 hónapos) tartomány feldolgozása a szerveren
    // túllépheti a PHP végrehajtási időkorlátját (ld. gpsmartInterface.php
    // komment) — a backend max. 7 napos tartományt fogad el, ezt itt is
    // ellenőrizzük, hogy a felhasználó gyors, egyértelmű visszajelzést
    // kapjon egy szerver-kör nélkül is.
    const napok = (new Date(datumIg) - new Date(datumTol)) / 86400000;
    if (napok < 0) {
      toast.error('A "dátumig" nem lehet korábbi, mint a "dátumtól".');
      return;
    }
    if (napok > 7) {
      toast.error("Legfeljebb 7 napos tartomány kérdezhető le egyszerre.");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAction("gpsmartUtvonal", {
        ceg_id: cegId,
        kerelmezo_id: kerelmezoId,
        carId: jarmu.car_id,
        datumTol,
        datumIg,
      });
      if (result?.success) {
        setEredmeny(result);
        onUtvonalBetoltve(result.pontok || []);
        if ((result.pontok || []).length === 0) {
          toast.error("Nincs rögzített útvonal ebben az időszakban.");
        }
      } else {
        toast.error(result?.message || "Nem sikerült lekérdezni az útvonalat.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEredmeny(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Útvonal-előzmény — ${jarmu.rendszam}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <FormSection columns={3}>
          <FormField
            type="date"
            label="Dátumtól"
            value={datumTol}
            onChange={(e) => setDatumTol(e.target.value)}
          />
          <FormField
            type="date"
            label="Dátumig"
            value={datumIg}
            onChange={(e) => setDatumIg(e.target.value)}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLekerdezes}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Lekérdezés..." : "Lekérdezés"}
            </button>
          </div>
        </FormSection>

        {eredmeny && (
          <>
            {eredmeny.osszesito && (
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-ink-800">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                    <PiRoadHorizonLight className="h-3.5 w-3.5" /> Megtett út
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-ink-800 dark:text-ink-100">
                    {eredmeny.osszesito.tavolsag_osszesen || "—"}
                  </p>
                  <p className="text-[11px] text-ink-400 dark:text-ink-500">
                    hivatali {eredmeny.osszesito.tavolsag_hivatali || "—"} · magán{" "}
                    {eredmeny.osszesito.tavolsag_magan || "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-ink-800">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                    <PiClockLight className="h-3.5 w-3.5" /> Menetidő
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-ink-800 dark:text-ink-100">
                    {eredmeny.osszesito.menetido || "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-ink-800">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                    <PiMapTrifoldLight className="h-3.5 w-3.5" /> Állásidő
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-ink-800 dark:text-ink-100">
                    {eredmeny.osszesito.allasido || "—"}
                  </p>
                </div>
              </div>
            )}

            {eredmeny.szakaszok?.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-100 dark:border-ink-800">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-ink-400 dark:bg-ink-800 dark:text-ink-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Kezdés</th>
                      <th className="px-3 py-2 text-left">Típus</th>
                      <th className="px-3 py-2 text-right">Táv</th>
                      <th className="px-3 py-2 text-right">Max. sebesség</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eredmeny.szakaszok.map((sz, idx) => (
                      <tr key={idx} className="border-t border-ink-100 dark:border-ink-800">
                        <td className="px-3 py-1.5 text-ink-600 dark:text-ink-300">{sz.tol}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              sz.tipus === "Hivatali"
                                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            }`}
                          >
                            {sz.tipus || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-600 dark:text-ink-300">
                          {sz.megtett_ut || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-600 dark:text-ink-300">
                          {sz.max_sebesseg || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(eredmeny.pontok || []).length > 0 && (
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {eredmeny.pontok.length} útvonalpont megjelenítve a térképen.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
