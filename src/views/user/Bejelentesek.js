import React, { useEffect, useState } from "react";
import { PiWarningCircleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";

const PRIORITAS_TONE = { magas: "danger", kozepes: "warning", alacsony: "neutral" };
const PRIORITAS_LABEL = { magas: "Sürgős", kozepes: "Közepes", alacsony: "Alacsony" };
const STATUSZ_TONE = { uj: "warning", folyamatban: "info", lezart: "success" };
const STATUSZ_LABEL = { uj: "Új", folyamatban: "Folyamatban", lezart: "Lezárva" };
const TIPUS_LABEL = {
  muszaki: "Műszaki hiba",
  serules: "Sérülés",
  baleset: "Baleset",
  gumi: "Gumiprobléma",
  szerviz: "Szerviz igény",
  felszereles: "Hiányzó felszerelés",
  rakomany: "Rakomány probléma",
  egyeb: "Egyéb",
};

export default function Bejelentesek() {
  const [bejelentesek, setBejelentesek] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    fetchAction("getBejelentesekSofor", { sofor_id: user.id }).then((result) => {
      if (result?.success) setBejelentesek(result.bejelentesek || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Bejelentéseim" back={false} />

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : bejelentesek.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiWarningCircleLight className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-400">Még nem küldtél bejelentést.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bejelentesek.map((b) => (
            <div key={b.id} className="rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{b.cim}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {TIPUS_LABEL[b.tipus] || "Egyéb"}
                    {b.kamion_rendszam ? ` · ${b.kamion_rendszam}` : ""}
                  </p>
                </div>
                <StatusBadge tone={STATUSZ_TONE[b.statusz] || "neutral"}>
                  {STATUSZ_LABEL[b.statusz] || b.statusz}
                </StatusBadge>
              </div>
              {b.leiras && <p className="mt-2 text-sm text-ink-600">{b.leiras}</p>}
              <div className="mt-2 flex items-center justify-between">
                <StatusBadge tone={PRIORITAS_TONE[b.prioritas] || "neutral"}>
                  {PRIORITAS_LABEL[b.prioritas] || b.prioritas}
                </StatusBadge>
                <span className="text-xs text-ink-400">
                  {(b.bejelentve || "").slice(0, 16).replace("T", " ")}
                </span>
              </div>
              {b.admin_valasz && (
                <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-ink-600">
                  <span className="font-semibold text-ink-700">Válasz: </span>
                  {b.admin_valasz}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
