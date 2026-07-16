import React from "react";
import {
  PiTruckLight,
  PiNavigationArrowLight,
  PiPauseCircleLight,
  PiWifiSlashLight,
  PiGaugeLight,
  PiRoadHorizonLight,
} from "react-icons/pi";
import CardStats from "components/Cards/CardStats";
import { formatKm } from "utils/gpsmartHelpers.js";

// A kártyák a Dashboard-dal közös `CardStats` komponenst használják
// (`layout="row"`, ld. UX-audit: "KPI cards differ across pages") — csak
// az "Offline" kap `danger` tónust, és csak akkor, ha ténylegesen van
// offline jármű; a többi (Aktív járművek, Mozgásban, Álló, Átlagsebesség,
// Megtett út) végig semleges/informatív marad. Az üzemanyag-szint NEM
// jelenik meg (felhasználói kérésre eltávolítva) — sem itt, sem a jármű-
// listában, sem a jármű részletei panelen.
//
// "Megtett út (ma)" — a `megtettUtMa` mező a `dusitett` tömbön a hívó
// (Flottakovetes.js) egy KÜLÖN, kézi "Frissítés"-hez kötött action
// (`gpsmartMegtettUtMa`) válaszából kerül rá, NEM ennek a komponensnek a
// dolga lekérni. Csak azok a járművek számítanak bele az összegbe,
// amelyekhez van adat — egy hiányzó/lekérdezetlen jármű kimarad, nem
// nullaként számít, különben a flotta-szintű szám hamisan alacsonyabbnak
// tűnne, mint a valóság.
export default function FlottaKpiKartyak({ dusitett, megtettUtLoading, megtettUtFrissitve }) {
  const osszesen = dusitett.length;
  const mozgasban = dusitett.filter((p) => p._allapot.kulcs === "mozgasban").length;
  const allo = dusitett.filter((p) => p._allapot.kulcs === "all").length;
  const offline = dusitett.filter((p) => p._allapot.kulcs === "offline").length;

  const mozgasbanSebessegek = dusitett
    .filter((p) => p._allapot.kulcs === "mozgasban" && p._sebessegSzam !== null)
    .map((p) => p._sebessegSzam);
  const atlagSebesseg = mozgasbanSebessegek.length
    ? Math.round(
        mozgasbanSebessegek.reduce((sum, v) => sum + v, 0) / mozgasbanSebessegek.length,
      )
    : null;

  const megtettUtSorok = dusitett.filter((p) => p.megtettUtMa != null);
  const megtettUtOsszesen = megtettUtSorok.reduce((sum, p) => sum + p.megtettUtMa, 0);
  const megtettUtCaption = megtettUtLoading
    ? "frissítés…"
    : megtettUtFrissitve
      ? `${megtettUtSorok.length}/${osszesen} jármű · frissítve ${megtettUtFrissitve.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}`
      : "még nincs lekérdezve";

  const kartyak = [
    {
      icon: PiTruckLight,
      label: "Aktív járművek",
      value: osszesen,
      tone: "brand",
    },
    {
      icon: PiNavigationArrowLight,
      label: "Mozgásban",
      value: mozgasban,
      tone: "positive",
    },
    {
      icon: PiPauseCircleLight,
      label: "Álló",
      value: allo,
      tone: "neutral",
    },
    {
      icon: PiWifiSlashLight,
      label: "Offline",
      value: offline,
      caption: offline > 0 ? "30 percnél régebbi jelzés" : undefined,
      tone: offline > 0 ? "danger" : "neutral",
    },
    {
      icon: PiGaugeLight,
      label: "Átlagsebesség",
      value: atlagSebesseg !== null ? `${atlagSebesseg} km/h` : "—",
      caption: "mozgásban lévők közt",
      tone: "neutral",
    },
    {
      icon: PiRoadHorizonLight,
      label: "Megtett út (ma)",
      value:
        megtettUtLoading && megtettUtSorok.length === 0
          ? "…"
          : megtettUtSorok.length > 0
            ? `${formatKm(megtettUtOsszesen)} km`
            : "—",
      caption: megtettUtCaption,
      tone: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {kartyak.map((k) => (
        <CardStats
          key={k.label}
          layout="row"
          statIcon={k.icon}
          statSubtitle={k.label}
          statTitle={k.value}
          statCaption={k.caption}
          tone={k.tone}
        />
      ))}
    </div>
  );
}
