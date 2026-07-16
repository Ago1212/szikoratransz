import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PiWarningCircleLight,
  PiChatCircleTextLight,
  PiBellSlashLight,
  PiTruckLight,
  PiCheckCircleLight,
  PiXCircleLight,
} from "react-icons/pi";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";
import { getDocumentTone } from "utils/documentStatus.js";
import { useSajatErtesitesek } from "utils/useSajatErtesitesek.js";

// Az értesítések listája korábban nem tett különbséget "ezt már láttam"
// és "ez új azóta, hogy legutóbb megnéztem" között — minden megnyitáskor
// ugyanúgy nézett ki, hiába gyűltek fel napok óta ugyanazok a tételek.
// A `localStorage`-ban (nem a szerveren, mert ez tisztán kliens-oldali
// "megnéztem" jelzés, semmilyen más nézetet/felhasználót nem érint)
// eszköz+fiók szerint (`user.id`) tároljuk a legutóbbi látogatáskor
// látott elemek azonosítóit. A "snapshot BEFORE frissítés" trükk fontos:
// a jelenlegi látogatás "új" jelzéseit a MEGELŐZŐ látogatás mentett
// állapotához képest számoljuk, utána azonnal felülírjuk a tárolt
// állapotot a jelenlegi teljes listával — így a jelzés csak a
// legközelebbi megnyitásig marad, nem tűnik el a jelen látogatás alatt.
const seenStorageKey = (userId) => `sofor_ertesitesek_latott_${userId}`;

function useUjElemek(dokumentumEsemenyek, bejelentesEsemenyek, jarmuValtasok, loading) {
  const [ujIdk, setUjIdk] = useState(null);

  useEffect(() => {
    if (loading) return;
    let user = null;
    try {
      user = JSON.parse(sessionStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    if (!user?.id) {
      setUjIdk(new Set());
      return;
    }

    const key = seenStorageKey(user.id);
    let korabbanLatott = [];
    try {
      korabbanLatott = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      korabbanLatott = [];
    }
    const korabbanLatottSet = new Set(korabbanLatott);

    const jelenlegiIdk = [
      ...dokumentumEsemenyek.map((d) => `doc-${d.key}`),
      ...bejelentesEsemenyek.map((b) => `bej-${b.id}`),
      ...jarmuValtasok.map((k) => `jv-${k.id}`),
    ];

    setUjIdk(new Set(jelenlegiIdk.filter((id) => !korabbanLatottSet.has(id))));
    localStorage.setItem(key, JSON.stringify(jelenlegiIdk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return ujIdk;
}

function UjPont() {
  return <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />;
}

export default function Ertesitesek() {
  const { lejaratok: dokumentumEsemenyek, bejelentesValaszok: bejelentesEsemenyek, jarmuValtasok, loading } =
    useSajatErtesitesek();
  const ujIdk = useUjElemek(dokumentumEsemenyek, bejelentesEsemenyek, jarmuValtasok, loading);

  const isEmpty = dokumentumEsemenyek.length === 0 && bejelentesEsemenyek.length === 0 && jarmuValtasok.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Értesítések" back={false} />

      {loading || !ujIdk ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiBellSlashLight className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-400">Nincs új értesítésed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dokumentumEsemenyek.map((d) => (
            <Link
              key={d.key}
              to="/user/profil"
              className="relative flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft"
            >
              {ujIdk.has(`doc-${d.key}`) && <UjPont />}
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  d.status === "expired" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                }`}
              >
                <PiWarningCircleLight className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{d.label}</p>
                <p className="text-xs text-ink-500">
                  {d.status === "expired" ? "Lejárt — pótlás szükséges" : `${d.days} nap múlva lejár`}
                </p>
              </div>
              <StatusBadge tone={getDocumentTone(d.status)}>
                {d.status === "expired" ? "Lejárt" : "Hamarosan"}
              </StatusBadge>
            </Link>
          ))}

          {bejelentesEsemenyek.map((b) => (
            <Link
              key={b.id}
              to="/user/bejelentesek"
              className="relative flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft"
            >
              {ujIdk.has(`bej-${b.id}`) && <UjPont />}
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <PiChatCircleTextLight className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{b.cim}</p>
                <p className="truncate text-xs text-ink-500">
                  {b.statusz === "lezart" ? "Bejelentésed lezárva" : "Bejelentésed folyamatban van"}
                  {b.admin_valasz ? " — válasz érkezett" : ""}
                </p>
              </div>
            </Link>
          ))}

          {jarmuValtasok.map((k) => {
            const jovahagyva = k.allapot === "jovahagyva";
            return (
              <Link
                key={k.id}
                to={k.tipus === "kamion" ? "/user/jarmu-valaszto" : "/user/potkocsi-valaszto"}
                className="relative flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft"
              >
                {ujIdk.has(`jv-${k.id}`) && <UjPont />}
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                    jovahagyva ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  }`}
                >
                  {jovahagyva ? (
                    <PiCheckCircleLight className="h-5 w-5" />
                  ) : (
                    <PiXCircleLight className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {k.tipus === "kamion" ? "Kamion" : "Pótkocsi"}-váltási kérésed {jovahagyva ? "jóváhagyva" : "elutasítva"}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {k.jarmu_rendszam ? `Kért jármű: ${k.jarmu_rendszam}` : " "}
                  </p>
                </div>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-ink-400">
                  <PiTruckLight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
