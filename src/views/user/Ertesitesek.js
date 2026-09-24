import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PiWarningCircleLight,
  PiChatCircleTextLight,
  PiBellSlashLight,
  PiTruckLight,
  PiVanLight,
  PiCheckCircleLight,
  PiXCircleLight,
  PiClipboardTextLight,
} from "react-icons/pi";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";
import { getDocumentTone } from "utils/documentStatus.js";
import { useSajatErtesitesek, latottKulcs, ertesitesAzonositok } from "utils/useSajatErtesitesek.js";
import HibaKartya from "components/UI/HibaKartya.js";
import { formatDatumRovid } from "utils/formatDatum";
import { fuvarKezdoDatum } from "utils/fuvarIdo";

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
function useUjElemek(adatok, loading) {
  const [ujIdk, setUjIdk] = useState(null);

  useEffect(() => {
    if (loading) return;
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    if (!user?.id) {
      setUjIdk(new Set());
      return;
    }
    const key = latottKulcs(user.id);
    let korabbanLatott = [];
    try {
      korabbanLatott = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      korabbanLatott = [];
    }
    const korabbanLatottSet = new Set(korabbanLatott);
    const jelenlegiIdk = ertesitesAzonositok(adatok);
    setUjIdk(new Set(jelenlegiIdk.filter((id) => !korabbanLatottSet.has(id))));
    try {
      localStorage.setItem(key, JSON.stringify(jelenlegiIdk));
    } catch (e) {
      // localStorage nem elérhető
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return ujIdk;
}

function UjPont() {
  return <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />;
}

export default function Ertesitesek() {
  const { lejaratok: dokumentumEsemenyek, fuvarok, bejelentesValaszok: bejelentesEsemenyek, jarmuValtasok, loading, hiba } =
    useSajatErtesitesek();
  const ujIdk = useUjElemek(
    { lejaratok: dokumentumEsemenyek, fuvarok, bejelentesValaszok: bejelentesEsemenyek, jarmuValtasok },
    loading,
  );

  const isEmpty =
    fuvarok.length === 0 && dokumentumEsemenyek.length === 0 && bejelentesEsemenyek.length === 0 && jarmuValtasok.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Értesítések" />

      {loading || !ujIdk ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : hiba && isEmpty ? (
        <HibaKartya uzenet={hiba} onRetry={() => window.location.reload()} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiBellSlashLight className="h-8 w-8 text-ink-400" />
          <p className="text-sm text-ink-500">Nincs új értesítésed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fuvarok.map((f) => (
            <Link
              key={`fuv-${f.id}`}
              to={`/user/fuvarReszletek?id=${f.id}`}
              className="relative flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft"
            >
              {ujIdk.has(`fuv-${f.id}`) && <UjPont />}
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <PiClipboardTextLight className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {ujIdk.has(`fuv-${f.id}`) ? "Új fuvar" : "Aktív fuvar"}: {f.felrako_ceg || "—"} → {f.lerako_ceg || "—"}
                </p>
                <p className="truncate text-sm text-ink-500">
                  {[
                    fuvarKezdoDatum(f) &&
                      `${fuvarKezdoDatum(f) === f.felrakas_datuma ? "Felrakás" : "Lerakás"}: ${formatDatumRovid(fuvarKezdoDatum(f))}`,
                    f.megbizo_nev,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Nincs dátum megadva"}
                </p>
              </div>
            </Link>
          ))}
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
                <p className="text-sm text-ink-500">
                  {d.status === "expired" ? "Lejárt — pótlás szükséges" : d.days === 0 ? "Ma lejár" : `${d.days} nap múlva lejár`}
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
                <p className="truncate text-sm text-ink-500">
                  {b.statusz === "lezart" ? "Bejelentésed lezárva" : b.statusz === "folyamatban" ? "Bejelentésed folyamatban van" : "Bejelentésed megtekintve"}
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
                to={
                  k.tipus === "kamion"
                    ? "/user/jarmu-valaszto"
                    : k.tipus === "furgon"
                    ? "/user/furgon-valaszto"
                    : "/user/potkocsi-valaszto"
                }
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
                    {k.tipus === "kamion" ? "Kamion" : k.tipus === "furgon" ? "Furgon" : "Pótkocsi"}-váltási kérésed {jovahagyva ? "jóváhagyva" : "elutasítva"}
                  </p>
                  <p className="truncate text-sm text-ink-500">
                    {k.jarmu_rendszam ? `Kért jármű: ${k.jarmu_rendszam}` : " "}
                  </p>
                </div>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-ink-400">
                  {k.tipus === "furgon" ? (
                    <PiVanLight className="h-4 w-4" />
                  ) : (
                    <PiTruckLight className="h-4 w-4" />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
