import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import moment from "moment";
import {
  PiUsersLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiCalendarBlankLight,
  PiWarningCircleLight,
  PiTrendUpLight,
  PiCoinsLight,
  PiArrowRightLight,
  PiCalendarCheckLight,
} from "react-icons/pi";

// components
import CardStats from "components/Cards/CardStats";
import CardCalender from "components/Cards/CardCalender";
import { fetchAction } from "utils/fetchAction";

const formatHuf = (value) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value || 0);

// Kiemelve, mert két helyen kell megjelennie ugyanazzal a tartalommal,
// eltérő méretezéssel: mobilon önálló, teljes szélességű sorként (a
// kompakt statcsík alatt), md+ nézetben pedig a 4 statisztika MELLETT, a
// közös sor `flex-[3]` hányadú tagjaként (ld. Dashboard render lentebb).
function NettoCard({ className, cashflow, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl bg-white p-5 text-left shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Nettó eredmény (e havi)
          </p>
          <p
            className={`mt-1 font-display text-3xl font-bold tabular-nums ${
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
        </div>
        <span className="hidden flex-shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 group-hover:underline sm:flex">
          Pénzforgalom <PiArrowRightLight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

// Item 3: "várható eredmény" a következő hónapra — ld. koltsegInterface.php
// getVarhatoEredmeny komment a becslés logikájáért (6 havi bevétel-átlag
// mínusz fix költségek). A bérek csak adminnak számítanak bele a
// fixköltségekbe (a backend nem-admin hívónak már eleve nem küldi vissza az
// `aktivBer` mezőt) — a felirat ezért attól függően más ("biztosítás" vagy
// "biztosítás + bérek"), hogy a kérelmező admin-e. Item 9: a jövő hónapra
// ütemezett, még el nem végzett karbantartások becsült költsége (nem
// privát adat, mindenkinek látszik) csak akkor kerül a feliratba, ha
// ténylegesen van ilyen tétel — üres flottánál ne zavarjon egy "+
// karbantartás" felirat, ha épp semmi nincs betervezve.
function VarhatoCard({ className, adat, onClick, isAdmin }) {
  const vanKarbantartas = adat.tervezettKarbantartasTetelSzam > 0;
  const fixKoltsegLabel = [
    "biztosítás",
    vanKarbantartas ? "karbantartás" : null,
    isAdmin ? "bérek" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl bg-white p-5 text-left shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Várható eredmény (jövő hónap, becslés)
          </p>
          <p
            className={`mt-1 font-display text-3xl font-bold tabular-nums ${
              adat.varhatoEredmeny >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {formatHuf(adat.varhatoEredmeny)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-ink-500">
              <PiTrendUpLight className="h-4 w-4 text-emerald-600" />
              Bevétel (6 havi átlag){" "}
              <span className="font-semibold tabular-nums text-ink-800">
                {formatHuf(adat.atlagBevetel)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-ink-500">
              <PiCoinsLight className="h-4 w-4 text-red-600" />
              Fix költségek ({fixKoltsegLabel}){" "}
              <span className="font-semibold tabular-nums text-ink-800">
                {formatHuf(adat.fixKoltsegek)}
              </span>
            </span>
          </div>
          {vanKarbantartas && (
            <p className="mt-2 text-xs text-ink-400">
              Ebből {formatHuf(adat.tervezettKarbantartas)} {adat.tervezettKarbantartasTetelSzam} tervezett, még el nem végzett karbantartás becsült költsége (jármű saját, vagy annak hiányában a flotta átlagos karbantartás-ára alapján).
            </p>
          )}
        </div>
        <span className="hidden flex-shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 group-hover:underline sm:flex">
          Pénzforgalom <PiArrowRightLight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

// A naptár mellett (md+, fél szélesség) megjelenő lista — a "Lejáró
// határidők" statkártya eddig csak egy csupasz számot mutatott (pl. "9"),
// a mögötte lévő tételeket csak az Események oldalra belépve lehetett
// megnézni. Ugyanazt az `events` tömböt használja, amit a CardCalender már
// amúgy is lekért (ld. `onEventsChange` callback lent) — nincs külön
// backend-hívás. Lejárt (start < ma) → piros "Lejárt", 7 napon belüli →
// amber (ugyanaz a figyelmeztetés-nyelv, mint a statkártyákon), távolabbi →
// semleges — csak a ténylegesen közelgő/lejárt tételek kapnak hangsúlyt.
function KozelgoHataridokCard({ events, onNavigate, className = "" }) {
  const ma = moment().startOf("day");
  const tetelek = events
    .map((e) => ({ ...e, _napok: moment(e.start).startOf("day").diff(ma, "days") }))
    .filter((e) => e._napok <= 30)
    .sort((a, b) => a._napok - b._napok)
    .slice(0, 8);

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
    <div
      className={`flex flex-col rounded-3xl border border-ink-100 bg-white shadow-soft md:min-h-[420px] ${className}`}
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3 md:px-6 md:py-4">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-brand-900 md:text-lg">
          <PiCalendarCheckLight className="h-5 w-5 text-brand-600" />
          Közelgő határidők
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
                <li
                  key={idx}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${tone.bg}`}
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{e.title}</p>
                    <p className="text-xs text-ink-400">
                      {moment(e.start).format("YYYY. MM. DD.")}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold ${tone.label}`}>
                    {napCimke(e._napok)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const history = useHistory();
  const [stats, setStats] = useState({
    soforok: 0,
    kamionok: 0,
    potkocsik: 0,
    hatarido: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Nettó eredmény — az e havi cashflow gyors áttekintése (nem
  // mindenkori összesítés, mint a Pénzforgalom oldal alap nézete, hanem
  // szándékosan a folyó hónapra szűkítve, hogy egy "hogy állunk most"
  // pillanatkép legyen, ne egy lassan változó, nagy kumulált szám).
  // Korábban ez a Pénzforgalom oldal tetején álló hero-kártya volt —
  // ide került át, mert ez a valódi "hogy állunk" kezdőoldal.
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
  const isOwnerAdmin =
    JSON.parse(sessionStorage.getItem("user") || "null")?.szerepkor === "admin";

  // A CardCalender saját maga tölti be az eseményeket (getEsemenyek) — ezt
  // a callback-et adja neki, hogy a "Közelgő határidők" oldalsáv ugyanazt a
  // listát használhassa fel, külön backend-hívás nélkül.
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem("user"));
        const result = await fetchAction("getSum", { id: user.ceg_id });

        if (result.success) {
          setStats({
            soforok: result.sofor || 0,
            kamionok: result.kamion || 0,
            potkocsik: result.potkocsi || 0,
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
    const user = JSON.parse(sessionStorage.getItem("user"));
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
    const user = JSON.parse(sessionStorage.getItem("user"));
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

  const cards = [
    {
      title: "Sofőrök",
      value: stats.soforok,
      icon: PiUsersLight,
      path: "/admin/soforok",
    },
    {
      title: "Kamionok",
      value: stats.kamionok,
      icon: PiTruckLight,
      path: "/admin/kamionok",
    },
    {
      title: "Pótkocsik",
      value: stats.potkocsik,
      icon: PiTruckTrailerLight,
      path: "/admin/potkocsi",
    },
    {
      title: "Lejáró határidők",
      value: stats.hatarido,
      icon: PiCalendarBlankLight,
      path: "/admin/esemenyek",
      // UX-audit: ez az egyetlen a négy közül, ami valódi, cselekvést
      // igénylő állapotot jelez, nem semleges létszámot — csak akkor kap
      // amber hangsúlyt, ha ténylegesen van lejáró tétel.
      tone: stats.hatarido > 0 ? "warning" : "brand",
    },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
      {/* Statisztikák — mobilon egy nagyon kompakt, egysoros csík (csak
          ikon+szám+apró felirat), hogy a "Lejáró határidők" azért egy
          pillantásra látszódjon anélkül, hogy be kellene lépni az Események
          menübe, de ne foglalja el a kezdőoldal nagy részét. Asztalin
          (md+) marad a teljes méretű CardStats-rács, változatlanul. */}
      <div className="grid grid-cols-4 gap-2 flex-shrink-0 mb-4 md:hidden">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => navigateTo(card.path)}
            className={`flex flex-col items-center gap-0.5 rounded-xl bg-white py-2 shadow-soft ring-1 transition-transform duration-150 active:scale-95 ${
              card.tone === "warning" ? "ring-amber-200" : "ring-ink-100"
            }`}
          >
            <card.icon
              className={`h-4 w-4 flex-shrink-0 ${card.tone === "warning" ? "text-amber-600" : "text-brand-600"}`}
            />
            <span
              className={`font-display text-base font-bold tabular-nums ${
                card.tone === "warning" ? "text-amber-700" : "text-brand-900"
              }`}
            >
              {card.value}
            </span>
            <span className="w-full px-0.5 text-center text-[8px] font-semibold uppercase leading-tight tracking-wide text-ink-400">
              {card.title}
            </span>
          </button>
        ))}
      </div>

      {/* Mobilon a Nettó eredmény változatlanul közvetlenül a kompakt
          statcsík alatt, önálló, teljes szélességű sorként jelenik meg —
          ott nincs hely a md+ nézet "mellette" elrendezéséhez. */}
      {!cashflowLoading && (
        <NettoCard
          className="mb-4 md:hidden"
          cashflow={cashflow}
          onClick={() => navigateTo("/admin/koltsegek")}
        />
      )}

      {/* Asztalon (md+) a Nettó eredmény és a Várható eredmény EGYMÁS
          MELLETT, egy közös sorban (a két "hogy állunk" kártya egyforma
          súllyal, flex-1 mindkettőn) — a 4 statisztika ez alatt, saját,
          teljes szélességű 4-oszlopos sorban. `flex-wrap` + `min-w` a két
          eredmény-kártyán: keskenyebb (pl. tablet-szélességű, md-de-nem-lg)
          képernyőn NEM zsugorodnak egymásra csúszó szélességre, hanem
          egymás alá esnek — csak elég széles (kb. lg+) képernyőn marad a
          két kártya egymás mellett. */}
      <div className="hidden flex-shrink-0 flex-wrap items-stretch gap-4 md:mb-4 md:flex">
        {!cashflowLoading && (
          <NettoCard
            className="min-w-[320px] flex-1"
            cashflow={cashflow}
            onClick={() => navigateTo("/admin/koltsegek")}
          />
        )}
        {!varhatoLoading && (
          <VarhatoCard
            className="min-w-[320px] flex-1"
            adat={varhato}
            isAdmin={isOwnerAdmin}
            onClick={() => navigateTo("/admin/koltsegek")}
          />
        )}
      </div>

      {/* Statisztikák (md+) — a fenti két eredmény-kártya alatt, önálló,
          teljes szélességű 4-oszlopos sorban (korábban a Nettó eredmény
          mellett, egy 2×2-es blokkban élt — a Várható eredmény kártya
          bevezetése után a sor túlzsúfolt lett volna hárommal, ezért ez a
          blokk saját sort kapott). */}
      <div className="hidden flex-shrink-0 grid-cols-4 gap-3 md:mb-4 md:grid">
        {cards.map((card) => (
          <CardStats
            key={card.title}
            statSubtitle={card.title}
            statTitle={card.value}
            statIcon={card.icon}
            onClick={() => navigateTo(card.path)}
            tone={card.tone}
          />
        ))}
      </div>

      {/* Várható eredmény — mobilon önálló, teljes szélességű sor a Nettó
          eredmény alatt (md+ nézetben már a fenti sorban, a Nettó eredmény
          mellett jelenik meg, ld. fent). */}
      {!varhatoLoading && (
        <VarhatoCard
          className="mb-4 flex-shrink-0 md:hidden"
          adat={varhato}
          isAdmin={isOwnerAdmin}
          onClick={() => navigateTo("/admin/koltsegek")}
        />
      )}

      {/* md+: a naptár és a "Közelgő határidők" lista egymás mellett, fél-
          fél szélességben (2-oszlopos grid — a grid `items-stretch` alap
          viselkedése miatt automatikusan egyenlő magasak, nem kell külön
          flex-trükk hozzá). Mobilon a lista rejtve marad (`hidden md:...`):
          a CardCalender saját mobil-ága már megjeleníti a kiválasztott nap
          eseményeit a naptár alatt, egy külön "Közelgő" lista csak
          duplikálná ugyanazt a szűk mobil képernyőn. */}
      <div className="flex flex-1 flex-col md:grid md:min-h-0 md:grid-cols-2 md:gap-6">
        <div className="flex flex-col rounded-3xl border border-ink-100 bg-white shadow-soft md:min-h-[420px] md:overflow-hidden">
          <div className="flex-shrink-0 border-b border-ink-100 px-4 py-3 md:px-6 md:py-4">
            <h3 className="font-display text-base font-semibold text-brand-900 md:text-lg">
              Eseménynaptár
            </h3>
          </div>
          <div className="min-h-0 flex-1 p-2">
            <CardCalender onEventsChange={setCalendarEvents} />
          </div>
        </div>

        <KozelgoHataridokCard
          className="hidden md:flex md:h-full"
          events={calendarEvents}
          onNavigate={() => navigateTo("/admin/esemenyek")}
        />
      </div>

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
