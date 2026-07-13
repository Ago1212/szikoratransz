import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiUsersLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiCalendarBlankLight,
  PiWarningCircleLight,
  PiTrendUpLight,
  PiCoinsLight,
  PiArrowRightLight,
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
            className="flex flex-col items-center gap-0.5 rounded-xl bg-white py-2 shadow-soft ring-1 ring-ink-100 transition-transform duration-150 active:scale-95"
          >
            <card.icon className="h-4 w-4 flex-shrink-0 text-brand-600" />
            <span className="font-display text-base font-bold tabular-nums text-brand-900">
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

      {/* Asztalon (md+) a Nettó eredmény a 4 statisztika MELLETT, egy közös
          sorban él (korábban egy külön, teljes szélességű sorban, a 4
          kártya alatt) — így egy pillantásra összetartoznak, de a
          cashflow-szám a legfontosabb infó itt, ezért nagyobb (flex-[3])
          hányadot kap, mint a 4 statisztika együttes 2×2-es blokkja
          (flex-[2]). `flex-wrap` + `min-w` a két blokkon: keskenyebb (pl.
          tablet-szélességű, md-de-nem-lg) képernyőn a két blokk NEM
          zsugorodik a CardStats-tartalmat összenyomó, egymásra csúszó
          szélességre, hanem egymás alá esik (Nettó teljes szélességben
          felül, a 4 statisztika alatta) — csak elég széles (kb. lg+)
          képernyőn marad a két blokk egymás mellett. */}
      <div className="hidden flex-shrink-0 flex-wrap items-stretch gap-4 md:mb-4 md:flex">
        {!cashflowLoading && (
          <NettoCard
            className="min-w-[320px] flex-[3]"
            cashflow={cashflow}
            onClick={() => navigateTo("/admin/koltsegek")}
          />
        )}

        <div className="grid min-w-[320px] flex-[2] grid-cols-2 gap-3">
          {cards.map((card) => (
            <CardStats
              key={card.title}
              statSubtitle={card.title}
              statTitle={card.value}
              statIcon={card.icon}
              onClick={() => navigateTo(card.path)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-3xl border border-ink-100 bg-white shadow-soft md:min-h-[420px] md:flex-1 md:overflow-hidden">
        <div className="flex-shrink-0 border-b border-ink-100 px-4 py-3 md:px-6 md:py-4">
          <h3 className="font-display text-base font-semibold text-brand-900 md:text-lg">
            Eseménynaptár
          </h3>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <CardCalender />
        </div>
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
