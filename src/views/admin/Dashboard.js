import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import moment from "moment";
import {
  PiUsersLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiWarningCircleLight,
  PiTrendUpLight,
  PiCoinsLight,
  PiArrowRightLight,
  PiCalendarCheckLight,
  PiListChecksLight,
  PiEnvelopeSimpleLight,
  PiCheckLight,
  PiXLight,
} from "react-icons/pi";

// components
import CardCalender from "components/Cards/CardCalender";
import { fetchAction } from "utils/fetchAction";

const formatHuf = (value) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value || 0);

// UX-redesign (2026-07-18): a korábbi, egyenrangú súlyú "Nettó eredmény" +
// "Várható eredmény" kártyapár most EGY kártyába olvadt — a kettő fogalmilag
// egy pár (jelen állapot vs. előrejelzés), nem két önálló téma, ezért nem
// indokolt két, egyforma vizuális súlyú, teljes szélességű kártyaként
// versengeniük a figyelemért. A Nettó eredmény marad a domináns, nagy szám;
// a Várható eredmény egy kisebb, másodlagos sorként ül alatta, elválasztóval.
function PenzugyiAllapotCard({ className, cashflow, varhato, varhatoLoading, isAdmin, onClick }) {
  const vanKarbantartas = varhato.tervezettKarbantartasTetelSzam > 0;
  const fixKoltsegLabel = ["biztosítás", vanKarbantartas ? "karbantartás" : null, isAdmin ? "bérek" : null]
    .filter(Boolean)
    .join(" + ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl bg-white p-5 text-left shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg dark:bg-ink-900 dark:ring-ink-800 sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Nettó eredmény (e havi)
        </p>
        <span className="hidden flex-shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 group-hover:underline dark:text-brand-400 sm:flex">
          Pénzforgalom <PiArrowRightLight className="h-3.5 w-3.5" />
        </span>
      </div>
      <p
        className={`mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl ${
          cashflow.netto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {formatHuf(cashflow.netto)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <span className="flex items-center gap-1.5 text-ink-500 dark:text-ink-400">
          <PiTrendUpLight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Bevétel <span className="font-semibold tabular-nums text-ink-800 dark:text-ink-100">{formatHuf(cashflow.bevetel)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-500 dark:text-ink-400">
          <PiCoinsLight className="h-4 w-4 text-red-600 dark:text-red-400" />
          Kiadás <span className="font-semibold tabular-nums text-ink-800 dark:text-ink-100">{formatHuf(cashflow.kiadas)}</span>
        </span>
      </div>

      {!varhatoLoading && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Várható eredmény (jövő hónap, becslés)
          </span>
          <span
            className={`font-display text-lg font-bold tabular-nums ${
              varhato.varhatoEredmeny >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatHuf(varhato.varhatoEredmeny)}
          </span>
        </div>
      )}
      {!varhatoLoading && (
        <p className="mt-1 text-xs text-ink-400 dark:text-ink-300">
          Bevétel (6 havi átlag): {formatHuf(varhato.atlagBevetel)} · Fix költségek ({fixKoltsegLabel}):{" "}
          {formatHuf(varhato.fixKoltsegek)}
          {vanKarbantartas &&
            ` · ebből ${formatHuf(varhato.tervezettKarbantartas)} tervezett karbantartás (${varhato.tervezettKarbantartasTetelSzam} tétel)`}
        </p>
      )}
    </button>
  );
}

// UX-redesign (2026-07-18): a korábbi önálló "Lejáró határidők" statkártya
// (csupasz szám, pl. "9") és a mellette élő, kizárólag desktopon látható
// "Közelgő határidők" lista most EGY, mobilon és desktopon egyaránt látható
// kártyává olvadt — ez a legcselekvés-relevánsabb infó a Dashboardon, ezért
// nem indokolt, hogy mobilon csak egy szám erejéig fér bele. `limit` szűkíti
// a lista hosszát kis képernyőn, hogy ne foglaljon el aránytalanul sok
// helyet. A `hatarido` badge-szám külön forrásból (`getSum`) jön, a lista
// pedig a CardCalender által már amúgy is lekért `events`-ből — ugyanaz a
// két adatforrás, mint korábban, csak most egy kártyában.
function MireFigyeljekMaCard({ className, hatarido, events, limit, onNavigate }) {
  const ma = moment().startOf("day");
  const tetelek = events
    .map((e) => ({ ...e, _napok: moment(e.start).startOf("day").diff(ma, "days") }))
    .filter((e) => e._napok <= 30)
    .sort((a, b) => a._napok - b._napok)
    .slice(0, limit);

  const napCimke = (napok) => {
    if (napok < 0) return "Lejárt";
    if (napok === 0) return "Ma";
    if (napok === 1) return "Holnap";
    return `${napok} nap múlva`;
  };

  const toneClass = (napok) => {
    if (napok < 0) return { dot: "bg-red-500", label: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40" };
    if (napok <= 7) return { dot: "bg-amber-500", label: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" };
    return { dot: "bg-ink-300 dark:bg-ink-600", label: "text-ink-500 dark:text-ink-400", bg: "bg-slate-50 dark:bg-ink-800" };
  };

  return (
    <div className={`flex flex-col rounded-3xl border border-ink-100 bg-white shadow-soft dark:border-ink-800 dark:bg-ink-900 md:min-h-[420px] ${className}`}>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800 md:px-6 md:py-4">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-brand-900 dark:text-ink-50 md:text-lg">
          <PiCalendarCheckLight className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          Mire figyeljek ma
          {hatarido > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {hatarido}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Összes <PiArrowRightLight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {tetelek.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <PiCalendarCheckLight className="h-8 w-8 text-ink-300 dark:text-ink-600" />
            <p className="text-sm text-ink-400 dark:text-ink-500">Nincs közelgő határidő a következő 30 napban.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tetelek.map((e, idx) => {
              const tone = toneClass(e._napok);
              return (
                <li key={idx} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${tone.bg}`}>
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{e.title}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-300">{moment(e.start).format("YYYY. MM. DD.")}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold ${tone.label}`}>{napCimke(e._napok)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

const JARMU_TIPUS_LABEL = { kamion: "kamiont", potkocsi: "pótkocsit", furgon: "furgont" };

// Fejlesztési javaslat (2026-07-20) — "Teendők" akció-központ: a jóváhagyásra
// váró jármű-váltási kérelem, az új bejelentés és a friss ajánlatkérés eddig
// 3 különböző helyen élt (haranG-értesítés, Bejelentések lista, Ajánlatkérések
// oldal) — ez a kártya mindhármat egy helyen, inline akciókkal mutatja, hogy
// admin ne kelljen 3 külön felületet bejárnia a napi teendők feltérképezéséhez.
// Csak akkor jelenik meg, ha ténylegesen van nyitott tétel — üres állapotban
// (minden rendben) nem foglal helyet a Dashboardon, ugyanaz az elv, mint az
// "Onboarding checklist"-szerű, csak-ha-releváns kártyáknál.
function TeendokCard({ className, teendok, onElbiral, onAjanlatkeresFelvette, onNavigate, elbiralasAlatt }) {
  const osszesen = teendok.jarmuValtas.length + teendok.bejelentesek.length + teendok.ajanlatkeresek.length;
  if (osszesen === 0) return null;

  return (
    <div className={`flex flex-col rounded-3xl border border-ink-100 bg-white shadow-soft dark:border-ink-800 dark:bg-ink-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800 md:px-6 md:py-4">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-brand-900 dark:text-ink-50 md:text-lg">
          <PiListChecksLight className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          Teendők
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
            {osszesen}
          </span>
        </h3>
      </div>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800">
        {teendok.jarmuValtas.map((k) => (
          <li key={`jv-${k.id}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="flex items-start gap-2.5 min-w-0">
              <PiTruckLight className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500 dark:text-brand-400" />
              <p className="text-sm text-ink-700 dark:text-ink-100">
                <span className="font-semibold">{k.sofor_nev || "Egy sofőr"}</span> másik{" "}
                {JARMU_TIPUS_LABEL[k.tipus] || "járművet"} kér:{" "}
                <span className="font-semibold">{k.jarmu_rendszam || "?"}</span>
                {k.indoklas && <span className="block text-xs text-ink-400 dark:text-ink-500">{k.indoklas}</span>}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={elbiralasAlatt === k.id}
                onClick={() => onElbiral(k.id, "jovahagyva")}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PiCheckLight className="h-3.5 w-3.5" /> Jóváhagyás
              </button>
              <button
                type="button"
                disabled={elbiralasAlatt === k.id}
                onClick={() => onElbiral(k.id, "elutasitva")}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-950/50 dark:text-red-300"
              >
                <PiXLight className="h-3.5 w-3.5" /> Elutasítás
              </button>
            </div>
          </li>
        ))}
        {teendok.bejelentesek.map((b) => (
          <li key={`bej-${b.id}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="flex items-start gap-2.5 min-w-0">
              <PiWarningCircleLight className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <p className="min-w-0 text-sm text-ink-700 dark:text-ink-100">
                <span className="font-semibold">{b.sofor_nev || "Egy sofőr"}</span> bejelentést tett:{" "}
                <span className="font-semibold">{b.cim || "Bejelentés"}</span>
                {b.kamion_rendszam && <span className="block text-xs text-ink-400 dark:text-ink-500">{b.kamion_rendszam}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("/admin/bejelentesForm", { data: b })}
              className="flex flex-shrink-0 items-center gap-1 self-end rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 sm:self-auto"
            >
              Megnyitás <PiArrowRightLight className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {teendok.ajanlatkeresek.map((a) => (
          <li key={`ak-${a.id}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="flex items-start gap-2.5 min-w-0">
              <PiEnvelopeSimpleLight className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500 dark:text-brand-400" />
              <p className="min-w-0 text-sm text-ink-700 dark:text-ink-100">
                <span className="font-semibold">{a.nev}</span> ajánlatot kért
                {a.telefon && <span className="block text-xs text-ink-400 dark:text-ink-500">{a.telefon}</span>}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => onAjanlatkeresFelvette(a.id)}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                <PiCheckLight className="h-3.5 w-3.5" /> Felvettem
              </button>
              <button
                type="button"
                onClick={() => onNavigate("/admin/ajanlatkeresek")}
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300"
              >
                Megnyitás
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// UX-redesign (2026-07-18): Sofőrök/Kamionok/Pótkocsik — ritkán változó
// leltár-számok, nem döntés-releváns KPI-k (ld. redesign-terv 3. szakasza) —
// ezért egy összevont, alacsony vizuális súlyú, egysoros sávvá szelídültek a
// korábbi 3 külön, nagy `CardStats` csempe helyett, és a lap aljára
// kerültek, hogy a valóban cselekvést igénylő tartalom (Pénzügyi állapot,
// Mire figyeljek ma) kapja a fő hangsúlyt felül.
function FlottaOsszesitoStrip({ className, items, onNavigate }) {
  return (
    <div className={`flex items-stretch divide-x divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-soft dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900 ${className}`}>
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={() => onNavigate(item.path)}
          className="flex flex-1 items-center justify-center gap-2 px-3 py-3 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-ink-800 sm:justify-start sm:px-5"
        >
          <item.icon className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
          <span className="font-display text-sm font-bold tabular-nums text-ink-700 dark:text-ink-100">{item.value}</span>
          <span className="hidden text-xs font-medium text-ink-400 dark:text-ink-500 sm:inline">{item.title}</span>
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const history = useHistory();
  const [stats, setStats] = useState({
    soforok: 0,
    kamionok: 0,
    potkocsik: 0,
    furgonok: 0,
    hatarido: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Nettó eredmény — az e havi cashflow gyors áttekintése (nem
  // mindenkori összesítés, mint a Pénzforgalom oldal alap nézete, hanem
  // szándékosan a folyó hónapra szűkítve, hogy egy "hogy állunk most"
  // pillanatkép legyen, ne egy lassan változó, nagy kumulált szám).
  const [cashflow, setCashflow] = useState({ bevetel: 0, kiadas: 0, netto: 0 });
  const [cashflowLoading, setCashflowLoading] = useState(true);

  // Várható eredmény (Item 3) — ld. koltsegInterface.php getVarhatoEredmeny.
  const [varhato, setVarhato] = useState({
    atlagBevetel: 0,
    fixKoltsegek: 0,
    varhatoEredmeny: 0,
    tervezettKarbantartas: 0,
    tervezettKarbantartasTetelSzam: 0,
  });
  const [varhatoLoading, setVarhatoLoading] = useState(true);
  const isOwnerAdmin = JSON.parse(localStorage.getItem("user") || "null")?.szerepkor === "admin";

  // A CardCalender saját maga tölti be az eseményeket (getEsemenyek) — ezt
  // a callback-et adja neki, hogy a "Mire figyeljek ma" kártya ugyanazt a
  // listát használhassa fel, külön backend-hívás nélkül.
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user"));
        const result = await fetchAction("getSum", { id: user.ceg_id });

        if (result.success) {
          setStats({
            soforok: result.sofor || 0,
            kamionok: result.kamion || 0,
            potkocsik: result.potkocsi || 0,
            furgonok: result.furgon || 0,
            hatarido: result.hatarido || 0,
          });
        } else {
          setError(result.message || "Error fetching stats");
        }
      } catch (err) {
        setError("Failed to fetch data");
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    const ma = new Date();
    const honapEleje = new Date(ma.getFullYear(), ma.getMonth(), 1).toISOString().slice(0, 10);
    fetchAction("getKoltsegOsszesito", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      datumTol: honapEleje,
      datumIg: ma.toISOString().slice(0, 10),
    }).then((result) => {
      if (result?.success) {
        setCashflow({
          bevetel: result.osszesen.bevetel,
          kiadas: result.osszesen.kiadas,
          netto: result.osszesen.netto,
        });
      }
      setCashflowLoading(false);
    });
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getVarhatoEredmeny", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    }).then((result) => {
      if (result?.success) {
        setVarhato({
          atlagBevetel: result.atlagBevetel,
          fixKoltsegek: result.fixKoltsegek,
          varhatoEredmeny: result.varhatoEredmeny,
          tervezettKarbantartas: result.tervezettKarbantartas || 0,
          tervezettKarbantartasTetelSzam: result.tervezettKarbantartasTetelSzam || 0,
        });
      }
      setVarhatoLoading(false);
    });
  }, []);

  // "Teendők" akció-központ — ld. TeendokCard komment. Jóváhagyás/elutasítás
  // vagy ajánlatkérés-felvétel után egyszerűen újratöltjük a teljes listát
  // (ugyanaz a minta, mint a Sidebar haranG-jának `loadKerelmek()`-je),
  // nem optimista frontend-only eltávolítás — ez a kártya ritkán frissül,
  // a plusz kérés elhanyagolható áráért cserébe sosem mutat elavult állapotot.
  const [teendok, setTeendok] = useState({ jarmuValtas: [], bejelentesek: [], ajanlatkeresek: [] });
  const [elbiralasAlatt, setElbiralasAlatt] = useState(null);

  const loadTeendok = React.useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getTeendok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) {
        setTeendok({
          jarmuValtas: result.jarmuValtas || [],
          bejelentesek: result.bejelentesek || [],
          ajanlatkeresek: result.ajanlatkeresek || [],
        });
      }
    });
  }, []);

  useEffect(() => {
    loadTeendok();
  }, [loadTeendok]);

  const handleTeendokElbiral = async (id, allapot) => {
    const user = JSON.parse(localStorage.getItem("user"));
    setElbiralasAlatt(id);
    await fetchAction("elbiralJarmuValtas", { id, allapot, admin: user.ceg_id, kerelmezo_id: user.id });
    setElbiralasAlatt(null);
    loadTeendok();
  };

  const handleAjanlatkeresFelvette = async (id) => {
    await fetchAction("updateAjanlatkeresStatusz", { id, statusz: "felvette" });
    loadTeendok();
  };

  const navigateTo = (path, state) => history.push(path, state);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-900 dark:border-t-brand-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <PiWarningCircleLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const flottaTetelek = [
    { title: "Sofőrök", value: stats.soforok, icon: PiUsersLight, path: "/admin/soforok" },
    { title: "Kamionok", value: stats.kamionok, icon: PiTruckLight, path: "/admin/kamionok" },
    { title: "Pótkocsik", value: stats.potkocsik, icon: PiTruckTrailerLight, path: "/admin/potkocsi" },
    { title: "Furgonok", value: stats.furgonok, icon: PiVanLight, path: "/admin/furgonok" },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
      {/* 1 — Pénzügyi állapot: EGYETLEN, domináns kártya (Nettó eredmény +
          Várható eredmény együtt), nem két, egyenrangú súlyú, versengő
          kártya, mint korábban. */}
      {!cashflowLoading && (
        <PenzugyiAllapotCard
          className="mb-4 flex-shrink-0"
          cashflow={cashflow}
          varhato={varhato}
          varhatoLoading={varhatoLoading}
          isAdmin={isOwnerAdmin}
          onClick={() => navigateTo("/admin/koltsegek")}
        />
      )}

      {/* 1.5 — Teendők: csak akkor jelenik meg, ha ténylegesen van nyitott
          jármű-váltási kérelem/bejelentés/ajánlatkérés — üres állapotban
          nem foglal helyet, hogy egy "minden rendben" napon a Dashboard ne
          legyen zsúfoltabb, mint indokolt. */}
      <TeendokCard
        className="mb-4 flex-shrink-0"
        teendok={teendok}
        onElbiral={handleTeendokElbiral}
        onAjanlatkeresFelvette={handleAjanlatkeresFelvette}
        onNavigate={navigateTo}
        elbiralasAlatt={elbiralasAlatt}
      />

      {/* 2 — "Mire figyeljek ma" (határidők) + Naptár: a legcselekvés-
          relevánsabb tartalom, ezért mobilon és desktopon egyaránt látható,
          közvetlenül a pénzügyi kártya alatt (nem lent, elrejtve). Desktopon
          egymás mellett fél-fél szélességben, mobilon egymás alatt — előbb a
          "Mire figyeljek ma", utána a naptár, mert az előbbi a
          döntés-relevánsabb. */}
      <div className="flex flex-1 flex-col gap-4 md:grid md:min-h-0 md:grid-cols-2 md:gap-6">
        <MireFigyeljekMaCard
          className="flex-shrink-0 md:order-1 md:h-full"
          hatarido={stats.hatarido}
          events={calendarEvents}
          limit={4}
          onNavigate={() => navigateTo("/admin/esemenyek")}
        />
        <div className="flex flex-shrink-0 flex-col rounded-3xl border border-ink-100 bg-white shadow-soft dark:border-ink-800 dark:bg-ink-900 md:order-2 md:min-h-[420px] md:overflow-hidden">
          <div className="flex-shrink-0 border-b border-ink-100 px-4 py-3 dark:border-ink-800 md:px-6 md:py-4">
            <h3 className="font-display text-base font-semibold text-brand-900 dark:text-ink-50 md:text-lg">Eseménynaptár</h3>
          </div>
          <div className="min-h-0 flex-1 p-2">
            <CardCalender onEventsChange={setCalendarEvents} />
          </div>
        </div>
      </div>

      {/* 3 — Flotta összesítő: alacsony súlyú, összevont sáv a lap alján —
          ritkán döntés-releváns leltárszámok, nem KPI-k. */}
      <FlottaOsszesitoStrip
        className="mt-4 flex-shrink-0"
        items={flottaTetelek}
        onNavigate={navigateTo}
      />

      {/* Valódi (nem margin) térköz mobilon — ez a lap gyökere `h-full`, így
          egy ezen kívüli testvér-spacer (pl. Admin.js layout szinten) nem
          tolódna el a naptár esetleges túlcsordulásától (pl. sok esemény
          egy napon); csak egy ide, EZEN A DOBOZON BELÜL rakott valódi
          blokk-magasság garantálja, hogy a mobil alsó navigáció sose
          takarja el a nap-lista utolsó elemét. */}
      <div className="h-20 w-full flex-shrink-0 md:hidden" aria-hidden="true" />
    </div>
  );
}
