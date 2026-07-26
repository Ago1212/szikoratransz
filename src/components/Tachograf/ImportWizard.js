import React, { useState } from "react";
import { PiCheckCircleLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import Modal from "components/UI/Modal.js";
import FormField from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";
import StatusBadge from "components/UI/StatusBadge.js";

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  const ora = Math.floor(perc / 60);
  const p = perc % 60;
  return `${ora}:${String(p).padStart(2, "0")}`;
};

const fajlBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function ImportWizard({ open, onClose, soforok, onApplied }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [lepes, setLepes] = useState(1);
  const [digests, setDigests] = useState([]);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestHaladas, setDigestHaladas] = useState(null);
  const [alkalmazasLoading, setAlkalmazasLoading] = useState(false);
  const [eredmeny, setEredmeny] = useState(null);

  const reset = () => {
    setLepes(1);
    setDigests([]);
    setDigestHaladas(null);
    setEredmeny(null);
  };

  const handleBezaras = () => {
    onClose();
    reset();
  };

  const handleFajlValasztas = async (e) => {
    const fajlok = Array.from(e.target.files || []);
    if (fajlok.length === 0) return;
    setDigestLoading(true);
    setDigestHaladas({ kesz: 0, osszes: fajlok.length });
    const ujDigestek = [];
    for (const file of fajlok) {
      try {
        const base64 = await fajlBase64(file);
        const result = await fetchAction("elemezTachografDdd", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          ddd: base64,
          fajlnev: file.name,
        });
        if (result?.success) {
          const kivalasztottNapok = {};
          (result.napok || []).forEach((nap) => {
            kivalasztottNapok[nap.datum] = !nap.marImportalva;
          });
          ujDigestek.push({
            fajlnev: file.name,
            kartyabirtokos: result.kartyabirtokos,
            napok: result.napok || [],
            esemenyek: result.esemenyek || [],
            hibak: result.hibak || [],
            valasztottSoforId: result.javasoltSoforId ? String(result.javasoltSoforId) : "",
            javaslatForras: result.javaslatForras || null,
            kivalasztottNapok,
          });
        } else {
          toast.error(`${file.name}: ${result?.message || "A fájl elemzése sikertelen."}`);
        }
      } catch (err) {
        toast.error(`${file.name}: a fájl beolvasása sikertelen.`);
      }
      setDigestHaladas((prev) => ({ ...prev, kesz: (prev?.kesz || 0) + 1 }));
    }
    setDigests((prev) => [...prev, ...ujDigestek]);
    setDigestLoading(false);
    setDigestHaladas(null);
    if (ujDigestek.length > 0) setLepes(2);
  };

  const setDigestMezo = (index, mezo, ertek) => {
    setDigests((prev) => prev.map((d, i) => (i === index ? { ...d, [mezo]: ertek } : d)));
  };

  const setDigestNapKijeloles = (index, datum, ertek) => {
    setDigests((prev) =>
      prev.map((d, i) => (i === index ? { ...d, kivalasztottNapok: { ...d.kivalasztottNapok, [datum]: ertek } } : d)),
    );
  };

  const osszesito = digests.reduce(
    (acc, d) => {
      const kivalasztott = d.napok.filter((n) => d.kivalasztottNapok[n.datum]).length;
      const mar = d.napok.filter((n) => n.marImportalva).length;
      return { ujNap: acc.ujNap + kivalasztott, marImportalt: acc.marImportalt + mar };
    },
    { ujNap: 0, marImportalt: 0 },
  );

  const handleAlkalmazas = async () => {
    const erintettDigestek = digests.filter((d) => d.napok.some((nap) => d.kivalasztottNapok[nap.datum]));
    if (erintettDigestek.length === 0) {
      toast.error("Nincs kiválasztva egyetlen importálandó nap sem.");
      return;
    }
    const hianyzoSofor = erintettDigestek.find((d) => !d.valasztottSoforId);
    if (hianyzoSofor) {
      toast.error(`${hianyzoSofor.fajlnev}: válassz sofőrt az importhoz.`);
      return;
    }

    setAlkalmazasLoading(true);
    try {
      let importaltOsszesen = 0;
      let kihagyvaOsszesen = 0;
      let hibaVolt = false;
      for (const d of erintettDigestek) {
        const napok = d.napok.filter((nap) => d.kivalasztottNapok[nap.datum]);
        const esemenyekOsszefesulve = [
          ...d.esemenyek.map((e) => ({ ...e, tipus: `esemeny_${e.tipus}` })),
          ...d.hibak.map((h) => ({ ...h, tipus: `hiba_${h.tipus}` })),
        ];
        const result = await fetchAction("alkalmazTachografImport", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          napok,
          sofor_id: d.valasztottSoforId,
          kartyaszam: d.kartyabirtokos.cardNumber,
          forrasFajlnev: d.fajlnev,
          esemenyek: esemenyekOsszefesulve,
        });
        if (result?.success) {
          importaltOsszesen += result.importalt;
          kihagyvaOsszesen += result.kihagyva;
        } else {
          hibaVolt = true;
          toast.error(`${d.fajlnev}: ${result?.message || "Az import sikertelen."}`);
        }
      }
      setEredmeny({ importalt: importaltOsszesen, kihagyva: kihagyvaOsszesen, hibaVolt });
      if (importaltOsszesen > 0 || !hibaVolt) {
        toast.success(`${importaltOsszesen} nap importálva (${kihagyvaOsszesen} már korábban rögzítve volt).`);
      }
      setLepes(3);
      onApplied();
    } finally {
      setAlkalmazasLoading(false);
    }
  };

  const LEPES_LABEL = ["Feltöltés", "Áttekintés", "Megerősítés"];

  return (
    <Modal open={open} onClose={handleBezaras} title="Tachográf kártya import" maxWidth="max-w-4xl">
      <div className="mb-5 flex gap-2 font-mono text-xs">
        {LEPES_LABEL.map((label, i) => (
          <span
            key={label}
            aria-current={lepes === i + 1 ? "step" : undefined}
            className={`rounded-full px-3 py-1 ${
              lepes === i + 1
                ? "bg-brand-600 text-white"
                : lepes > i + 1
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-slate-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
            }`}
          >
            {i + 1} · {label}
          </span>
        ))}
      </div>

      {lepes === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Töltsd fel a sofőrkártya-letöltés (.ddd) fájl(oka)t — egyszerre több sofőr kártyája is kiválasztható.
            A feltöltés még nem menti el az adatokat — előbb egy előnézetet mutatunk, amit jóváhagyás után lehet alkalmazni.
          </p>
          <FormField label="Fájlok kiválasztása" type="file" accept=".ddd,.DDD" multiple onChange={handleFajlValasztas} disabled={digestLoading} />
          {digestLoading && (
            <p className="text-sm text-ink-400">
              Fájlok elemzése folyamatban… ({digestHaladas?.kesz ?? 0}/{digestHaladas?.osszes ?? 0})
            </p>
          )}
        </div>
      )}

      {lepes === 2 && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-6 rounded-xl bg-brand-50 p-4 text-sm dark:bg-brand-950/30">
            <div><b className="block font-mono text-lg text-brand-700 dark:text-brand-300">{digests.length}</b>fájl</div>
            <div><b className="block font-mono text-lg text-brand-700 dark:text-brand-300">{osszesito.ujNap}</b>új nap</div>
            <div><b className="block font-mono text-lg text-brand-700 dark:text-brand-300">{osszesito.marImportalt}</b>már importált</div>
          </div>

          {digests.map((d, index) => (
            <div key={d.fajlnev + index} className="space-y-3 rounded-2xl border border-ink-100 p-4 dark:border-ink-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">{d.fajlnev}</p>
              <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-ink-800">
                <p className="font-semibold text-brand-900 dark:text-ink-50">
                  {d.kartyabirtokos.holderSurname} {d.kartyabirtokos.holderFirstNames}
                </p>
                <p className="text-ink-500 dark:text-ink-400">Kártyaszám: {d.kartyabirtokos.cardNumber}</p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <FormField
                    label="Sofőr"
                    as="select"
                    required
                    value={d.valasztottSoforId}
                    onChange={(e) => setDigestMezo(index, "valasztottSoforId", e.target.value)}
                  >
                    <option value="">Válassz sofőrt...</option>
                    {soforok.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </FormField>
                </div>
                {d.valasztottSoforId && d.javaslatForras === "kartyaszam" && (
                  <StatusBadge tone="success">Biztos egyezés (kártyaszám)</StatusBadge>
                )}
                {d.valasztottSoforId && d.javaslatForras === "nev" && (
                  <StatusBadge tone="warning">Erősítsd meg (név alapján)</StatusBadge>
                )}
              </div>

              <div className="max-h-96 overflow-auto rounded-xl border border-ink-100 dark:border-ink-700">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-ink-800">
                    <tr>
                      <th className="p-2 text-left">Import</th>
                      <th className="p-2 text-left">Dátum</th>
                      <th className="p-2 text-left">Táv</th>
                      <th className="p-2 text-left">Vezetés</th>
                      <th className="p-2 text-left">Jármű</th>
                      <th className="p-2 text-left">Állapot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.napok.map((nap) => (
                      <tr key={nap.datum} className="border-t border-ink-100 dark:border-ink-700">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!d.kivalasztottNapok[nap.datum]}
                            disabled={nap.marImportalva}
                            onChange={(e) => setDigestNapKijeloles(index, nap.datum, e.target.checked)}
                          />
                        </td>
                        <td className="p-2">{nap.datum}</td>
                        <td className="p-2">{nap.tavolsagKm} km</td>
                        <td className="p-2">{percToOraPerc(nap.vezetesPerc)}</td>
                        <td className="p-2">{(nap.jarmuvek || []).map((j) => j.rendszam).join(", ") || "—"}</td>
                        <td className="p-2">
                          {nap.marImportalva ? (
                            <StatusBadge tone="neutral">Már importálva</StatusBadge>
                          ) : (
                            <StatusBadge tone="success"><PiCheckCircleLight className="mr-1 inline h-3 w-3" />Új</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* UX-visszajelzés: több feltöltött fájl/nap esetén a review-lista
              hosszabb, mint a Modal.js látható magassága — a gombsor korábban
              a lista alján, a modal saját overflow-y-auto tartalmán BELÜL élt,
              így görgetni kellett hozzá. `sticky bottom-0` a modal scroll-
              konténerének aljához rögzíti, mindig látható marad. */}
          <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-ink-100 bg-white px-6 py-3 dark:border-ink-800 dark:bg-ink-900">
            <button type="button" onClick={handleBezaras} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
              Mégsem
            </button>
            <SaveButton onClick={handleAlkalmazas} isSaving={alkalmazasLoading} label="Import alkalmazása" savingLabel="Alkalmazás..." />
          </div>
        </div>
      )}

      {lepes === 3 && eredmeny && (
        <div className="space-y-4 text-center">
          <PiCheckCircleLight className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-lg font-semibold text-brand-900 dark:text-ink-50">
            {eredmeny.importalt} nap importálva
          </p>
          <p className="text-sm text-ink-500 dark:text-ink-400">{eredmeny.kihagyva} nap már korábban rögzítve volt.</p>
          <button
            type="button"
            onClick={handleBezaras}
            className="mx-auto flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Bezárás
          </button>
        </div>
      )}
    </Modal>
  );
}
