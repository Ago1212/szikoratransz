import React, { useEffect, useState, useCallback, useRef } from "react";
import { useHistory } from "react-router-dom";
import { PiClipboardTextLight, PiMapTrifoldLight, PiFileTextLight, PiCheckCircleFill, PiWifiSlashLight } from "react-icons/pi";
import MobileHeader from "components/UI/MobileHeader.js";
import Spinner from "components/UI/Spinner.js";
import HibaKartya from "components/UI/HibaKartya.js";
import { gyorsitotarazottLekeres, offlineCimke } from "utils/soforCache";
import { csoportositottFuvarok, fuvarKezdoDatum, utvonalUrl } from "utils/fuvarIdo";
import { formatDatumRovid, napokMaihoz } from "utils/formatDatum";

function FuvarKartya({ fuvar, onOpen, lezart }) {
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam;
  const kezdo = fuvarKezdoDatum(fuvar);
  const lerakasMult = (napokMaihoz(fuvar.lerakas_datuma) ?? 1) < 0;
  const menetlevelHianyzik = !lezart && !fuvar.dokumentum_feltoltve && lerakasMult;
  const url = utvonalUrl(fuvar);
  const meta = [
    kezdo && `${kezdo === fuvar.felrakas_datuma ? "Felrakás" : "Lerakás"}: ${formatDatumRovid(kezdo)}`,
    jarmu,
    fuvar.megbizo_nev,
  ].filter(Boolean);

  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      <button type="button" onClick={() => onOpen(fuvar)} className="flex min-w-0 flex-1 flex-col gap-1 p-3.5 text-left active:bg-slate-50">
        <p className="truncate text-base font-semibold text-ink-900">
          {fuvar.felrako_ceg || "—"} → {fuvar.lerako_ceg || "—"}
        </p>
        <p className="truncate text-sm text-ink-500">{meta.length ? meta.join(" · ") : "Nincs dátum megadva"}</p>
        {lezart ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
            <PiCheckCircleFill className="h-4 w-4" /> {fuvar.dokumentum_feltoltve ? "Dokumentálva" : "Lezárva"}
          </p>
        ) : menetlevelHianyzik ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-amber-700">
            <PiFileTextLight className="h-4 w-4" /> Menetlevél hiányzik
          </p>
        ) : null}
      </button>
      {url && !lezart && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Útvonal: ${fuvar.felrako_ceg || ""} → ${fuvar.lerako_ceg || ""}`}
          className="flex w-16 flex-shrink-0 flex-col items-center justify-center gap-1 border-l border-ink-100 text-xs font-semibold text-brand-600 active:bg-brand-50"
        >
          <PiMapTrifoldLight className="h-6 w-6" />
          Útvonal
        </a>
      )}
    </div>
  );
}

export default function Fuvarok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [ful, setFul] = useState("aktiv");
  const [fuvarok, setFuvarok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hiba, setHiba] = useState(null);
  const [offlineIdo, setOfflineIdo] = useState(null);
  const keresSzamlalo = useRef(0);

  const load = useCallback(async () => {
    const sajat = ++keresSzamlalo.current;
    setLoading(true);
    setHiba(null);
    const { result, offlineIdo: ido } = await gyorsitotarazottLekeres(
      ful === "aktiv" ? "aktiv_fuvarok" : "lezart_fuvarok",
      "getSajatFuvarok",
      { sofor_id: user.id, aktivOnly: ful === "aktiv" },
    );
    if (sajat !== keresSzamlalo.current) return;
    if (result?.success) setFuvarok(result.fuvarok || []);
    else {
      setFuvarok([]);
      setHiba(result?.message || "Nem sikerült betölteni a fuvarjaidat.");
    }
    setOfflineIdo(ido);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ful]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = (fuvar) => {
    history.push(`/user/fuvarReszletek?id=${fuvar.id}`, { data: fuvar });
  };

  const csoportok = ful === "aktiv" ? csoportositottFuvarok(fuvarok) : [{ kulcs: "lezart", cim: null, fuvarok }];

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Fuvarjaim" back={false} />

      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Fuvarok szűrése">
        {[
          { kulcs: "aktiv", cim: "Aktívak" },
          { kulcs: "lezart", cim: "Lezártak" },
        ].map((f) => (
          <button
            key={f.kulcs}
            type="button"
            role="tab"
            aria-selected={ful === f.kulcs}
            onClick={() => setFul(f.kulcs)}
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition-colors ${
              ful === f.kulcs ? "bg-white text-brand-700 shadow-soft" : "text-ink-600"
            }`}
          >
            {f.cim}
          </button>
        ))}
      </div>

      {offlineIdo && (
        <p className="flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm text-white">
          <PiWifiSlashLight className="h-4 w-4 flex-shrink-0" />
          {offlineCimke(offlineIdo)}
        </p>
      )}

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : hiba ? (
        <HibaKartya uzenet={hiba} onRetry={load} />
      ) : fuvarok.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiClipboardTextLight className="h-8 w-8 text-ink-400" />
          <p className="text-sm text-ink-500">
            {ful === "aktiv" ? "Nincs aktív fuvarod. Ha a diszpécser kioszt egyet, értesítést kapsz." : "Még nincs lezárt fuvarod."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {csoportok.map((cs) => (
            <section key={cs.kulcs} className="flex flex-col gap-2">
              {cs.cim && (
                <h2 className={`text-xs font-bold uppercase tracking-wider ${cs.kulcs === "ma" ? "text-brand-600" : "text-ink-500"}`}>
                  {cs.cim} <span className="font-semibold text-ink-400">({cs.fuvarok.length})</span>
                </h2>
              )}
              {cs.fuvarok.map((f) => (
                <FuvarKartya key={f.id} fuvar={f} onOpen={handleOpen} lezart={ful === "lezart"} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
