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
      className={`group rounded-3xl bg-white p-5 text-left shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Nettó eredmény (e havi)
        </p>
        <span className="hidden flex-shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 group-hover:underline sm:flex">
          Pénzforgalom <PiArrowRightLight className="h-3.5 w-3.5" />
        </span>
      </div>
      <p
        className={`mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl ${
          cashflow.netto >= 0 ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {formatHuf(cashflow.netto)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <span className="flex items-center gap-1.5 text-ink-500">
          <PiTrendUpLight className="h-4 w-4 text-emerald-600" />
          Bevétel <span className="font-semibold tabular-nums text-ink-800">{formatHuf(cashflow.bevetel)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-500">
          <PiCoinsLight className="h-4 w-4 text-red-600" />
          Kiadás <span className="font-semibold tabular-nums text-ink-800">{formatHuf(cashflow.kiadas)}</span>
        </span>
      </div>

      {!varhatoLoading && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Várható eredmény (jövő hónap, becslés)
          </span>
          <span
            className={`font-display text-lg font-bold tabular-nums ${
              varhato.varhatoEredmeny >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {formatHuf(varhato.varhatoEredmeny)}
          </span>
        </div>
      )}
      {!varhatoLoading && (
        <p className="mt-1 text-xs text-ink-400">
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
    if (napok < 0) return { dot: "bg-red-500", label: "text-red-700", bg: "bg-red-50" };
    if (napok <= 7) return { dot: "bg-amber-500", label: "text-amber-700", bg: "bg-amber-50" };
    return { dot: "bg-ink-300", label: "text-ink-500", bg: "bg-slate-50" };
  };

  return (
    <div className={`flex flex-col rounded-3xl border border-ink-100 bg-white shadow-soft md:min-h-[420px] ${className}`}>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3 md:px-6 md:py-4">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-brand-900 md:text-lg">
          <PiCalendarCheckLight className="h-5 w-5 text-brand-600" />
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
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
        >
          Összes <PiArrowRightLight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {tetelek.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <PiCalendarCheckLight className="h-8 w-8 text-ink-300" />
            <p className="text-sm text-ink-400">Nincs közelgő határidő a következő 30 napban.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tetelek.map((e, idx) => {
              const tone = toneClass(e._napok);
              return (
                <li key={idx} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${tone.bg}`}>
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{e.title}</p>
                    <p className="text-xs text-ink-400">{moment(e.start).format("YYYY. MM. DD.")}</p>
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

// UX-redesign (2026-07-18): Sofőrök/Kamionok/Pótkocsik — ritkán változó
// leltár-számok, nem döntés-releváns KPI-k (ld. redesign-terv 3. szakasza) —
// ezért egy összevont, alacsony vizuális súlyú, egysoros sávvá szelídültek a
// korábbi 3 külön, nagy `CardStats` csempe helyett, és a lap aljára
// kerültek, hogy a valóban cselekvést igénylő tartalom (Pénzügyi állapot,
// Mire figyeljek ma) kapja a fő hangsúlyt felül.
function FlottaOsszesitoStrip({ className, items, onNavigate }) {
  return (
    <div className={`flex items-stretch divide-x divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-soft ${className}`}>
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={() => onNavigate(item.path)}
          className="flex flex-1 items-center justify-center gap-2 px-3 py-3 transition-colors duration-150 hover:bg-slate-50 sm:justify-start sm:px-5"
        >
          <item.icon className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span className="font-display text-sm font-bold tabular-nums text-ink-700">{item.value}</span>
          <span className="hidden text-xs font-medium text-ink-400 sm:inline">{item.title}</span>
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

  const navigateTo = (path) => history.push(path);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
        <PiWarningCircleLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
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
        <div className="flex flex-shrink-0 flex-col rounded-3xl border border-ink-100 bg-white shadow-soft md:order-2 md:min-h-[420px] md:overflow-hidden">
          <div className="flex-shrink-0 border-b border-ink-100 px-4 py-3 md:px-6 md:py-4">
            <h3 className="font-display text-base font-semibold text-brand-900 md:text-lg">Eseménynaptár</h3>
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
