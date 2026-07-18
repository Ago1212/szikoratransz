import React, { useState } from "react";
import { PiGaugeLight, PiClockLight, PiPauseCircleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";

const ma = () => new Date().toISOString().slice(0, 10);

const formatOra = (ora) => (ora === null ? "—" : `${ora.toFixed(1)} ó`);

// Item 5: jármű-kihasználtsági riport — ugyanaz a GPSmart `menetido`/
// `allasido` napi összesítő, amit az ElozmenyekModal.js is használ egy-egy
// járműre, itt viszont a teljes (GPSmart-tal párosított) flottára,
// kihasználtság szerint rendezve. Ugyanaz a max. 7 napos tartomány-korlát
// vonatkozik rá, mint az útvonal-előzményre (ld.
// gpsmartInterface.php::MAX_UTVONAL_NAPOK komment — a HTML-feldolgozás
// nagyobb tartományon túllépheti a PHP végrehajtási időkorlátját).
export default function KihasznaltsagiModal({ open, onClose, cegId, kerelmezoId }) {
  const [datumTol, setDatumTol] = useState(ma());
  const [datumIg, setDatumIg] = useState(ma());
  const [loading, setLoading] = useState(false);
  const [jarmuvek, setJarmuvek] = useState(null);

  const handleLekerdezes = async () => {
    setLoading(true);
    try {
      const result = await fetchAction("getKihasznaltsagiRiport", {
        ceg_id: cegId,
        kerelmezo_id: kerelmezoId,
        datumTol,
        datumIg,
      });
      if (result?.success) {
        setJarmuvek(result.jarmuvek || []);
        if ((result.jarmuvek || []).length === 0) {
          toast.error("Nincs GPSmart-tal párosított jármű ehhez az időszakhoz.");
        }
      } else {
        toast.error(result?.message || "Nem sikerült lekérdezni a kihasználtságot.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setJarmuvek(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Jármű-kihasználtsági riport" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs text-ink-400">
          A megtett-idő (menetidő) és az állásidő aránya a GPSmart adatai alapján, legfeljebb 7
          napos tartományra — megmutatja, melyik jármű áll feleslegesen sokat.
        </p>
        <FormSection columns={3}>
          <FormField type="date" label="Dátumtól" value={datumTol} onChange={(e) => setDatumTol(e.target.value)} />
          <FormField type="date" label="Dátumig" value={datumIg} onChange={(e) => setDatumIg(e.target.value)} />
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLekerdezes}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Lekérdezés…" : "Lekérdezés"}
            </button>
          </div>
        </FormSection>

        {jarmuvek && jarmuvek.length > 0 && (
          <div className="max-h-96 overflow-y-auto rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left">Rendszám</th>
                  <th className="px-3 py-2 text-right">Menetidő</th>
                  <th className="px-3 py-2 text-right">Állásidő</th>
                  <th className="px-3 py-2 text-right">Kihasználtság</th>
                </tr>
              </thead>
              <tbody>
                {jarmuvek.map((j) => (
                  <tr key={`${j.jarmu_tipus}:${j.kamion_id ?? j.furgon_id}`} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-semibold text-ink-800">{j.rendszam}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                      <span className="inline-flex items-center gap-1">
                        <PiClockLight className="h-3.5 w-3.5 text-ink-400" />
                        {formatOra(j.menetidoOra)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                      <span className="inline-flex items-center gap-1">
                        <PiPauseCircleLight className="h-3.5 w-3.5 text-ink-400" />
                        {formatOra(j.allasidoOra)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {j.kihasznaltsagSzazalek === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                            j.kihasznaltsagSzazalek < 40
                              ? "bg-red-50 text-red-700"
                              : j.kihasznaltsagSzazalek < 65
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <PiGaugeLight className="h-3.5 w-3.5" />
                          {j.kihasznaltsagSzazalek}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
