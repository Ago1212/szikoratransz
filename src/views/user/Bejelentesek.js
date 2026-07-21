import React, { useEffect, useState } from "react";
import { PiWarningCircleLight, PiChatCircleTextLight, PiPaperPlaneRightLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { useListaElemek } from "utils/useListaElemek.js";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";

const STATUSZ_TONE = { uj: "warning", folyamatban: "info", lezart: "success" };
const STATUSZ_LABEL = { uj: "Új", folyamatban: "Folyamatban", lezart: "Lezárva" };

// Valódi, backenddel rendelkező üzenetfolyam a bejelentéshez — korábban az
// admin-oldali CardBejelentesek.js egy sosem működött mock-verziót
// rajzolt ki erre, a sofőr-oldalon meg egyáltalán nem volt semmilyen
// beszélet-UI, csak az egyszeri `admin_valasz` mező (ami marad, ez alatta
// egy tényleges, kétirányú beszélgetés). Csak akkor tölt üzenetet, ha a
// sofőr ténylegesen kinyitja — nem minden kártyához előre, feleslegesen.
function BejelentesUzenetek({ bejelentesId }) {
  const [nyitva, setNyitva] = useState(false);
  const [betoltve, setBetoltve] = useState(false);
  const [uzenetek, setUzenetek] = useState([]);
  const [ujUzenet, setUjUzenet] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const betolt = async () => {
    setLoading(true);
    const result = await fetchAction("getMessages", { bejelentes_id: bejelentesId });
    if (result?.success) setUzenetek(result.uzenetek || []);
    setBetoltve(true);
    setLoading(false);
  };

  const handleToggle = () => {
    const ujAllapot = !nyitva;
    setNyitva(ujAllapot);
    if (ujAllapot && !betoltve) betolt();
  };

  const handleKuldes = async () => {
    if (!ujUzenet.trim()) return;
    setSending(true);
    try {
      const result = await fetchAction("sendMessage", { bejelentes_id: bejelentesId, szoveg: ujUzenet.trim() });
      if (result?.success) {
        setUjUzenet("");
        await betolt();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 border-t border-ink-100 pt-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-600"
      >
        <PiChatCircleTextLight className="h-4 w-4" />
        {nyitva ? "Üzenetek elrejtése" : "Üzenetek"}
      </button>

      {nyitva && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-50 p-2.5">
          {loading ? (
            <Spinner wrapperClassName="flex justify-center py-3" />
          ) : uzenetek.length === 0 ? (
            <p className="py-2 text-center text-xs text-ink-400">Még nincs üzenet.</p>
          ) : (
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {uzenetek.map((u) => (
                <div
                  key={u.id}
                  className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                    u.szerzo_tipus === "sofor" ? "self-end bg-brand-600 text-white" : "self-start bg-white text-ink-700 shadow-soft"
                  }`}
                >
                  <p className={`mb-0.5 font-semibold ${u.szerzo_tipus === "sofor" ? "text-brand-100" : "text-ink-400"}`}>
                    {u.szerzo_nev} · {(u.letrehozva || "").slice(0, 16).replace("T", " ")}
                  </p>
                  <p className="whitespace-pre-wrap">{u.szoveg}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              value={ujUzenet}
              onChange={(e) => setUjUzenet(e.target.value)}
              rows="1"
              placeholder="Írj üzenetet..."
              className="flex-1 resize-none rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="button"
              onClick={handleKuldes}
              disabled={sending || !ujUzenet.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Üzenet küldése"
            >
              <PiPaperPlaneRightLight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Bejelentesek() {
  const [bejelentesek, setBejelentesek] = useState([]);
  const [loading, setLoading] = useState(true);
  const { elemek: tipusok } = useListaElemek("bejelentes_tipus");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
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
                    {tipusok.find((t) => t.kulcs === b.tipus)?.nev || b.tipus}
                    {b.kamion_rendszam ? ` · ${b.kamion_rendszam}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {b.admin_valasz && (
                    <StatusBadge tone="success">Válaszolt</StatusBadge>
                  )}
                  <StatusBadge tone={STATUSZ_TONE[b.statusz] || "neutral"}>
                    {STATUSZ_LABEL[b.statusz] || b.statusz}
                  </StatusBadge>
                </div>
              </div>
              {b.leiras && <p className="mt-2 text-sm text-ink-600">{b.leiras}</p>}
              <div className="mt-2">
                <span className="text-xs text-ink-400">
                  {(b.bejelentve || "").slice(0, 16).replace("T", " ")}
                </span>
              </div>
              {b.admin_valasz && (
                <div className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-xs text-ink-600">
                  <span className="font-semibold text-emerald-700">Válasz: </span>
                  {b.admin_valasz}
                </div>
              )}
              <BejelentesUzenetek bejelentesId={b.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
