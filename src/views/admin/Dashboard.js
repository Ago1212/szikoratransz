import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiUsersLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiCalendarBlankLight,
  PiWarningCircleLight,
} from "react-icons/pi";

// components
import CardStats from "components/Cards/CardStats";
import CardCalender from "components/Cards/CardCalender";
import { fetchAction } from "utils/fetchAction";

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

      <div className="hidden flex-shrink-0 grid-cols-2 gap-5 md:mb-6 md:grid xl:grid-cols-4">
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
