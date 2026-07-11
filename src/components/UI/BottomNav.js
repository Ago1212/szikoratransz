import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  PiSquaresFourLight,
  PiSquaresFourFill,
  PiWarningCircleLight,
  PiWarningCircleFill,
  PiUserLight,
  PiUserFill,
} from "react-icons/pi";

// Sofőr-oldali alsó navigáció (csak mobilon, md-től a desktop felső
// navigáció veszi át a szerepét) — a Bejelentés középen kiemelt, piros
// FAB-ként (ez az egyetlen művelet, amit vezetés közbeni vészhelyzetben
// egy kézzel, gondolkodás nélkül kell elérni). A jármű-kiválasztás,
// dokumentumok, tankolás és értesítések szándékosan nincsenek itt —
// azok a Kezdőlap gyorsműveletein keresztül érhetők el, hogy a sáv ne
// zsúfolódjon túl (ld. a sofőr UX terv 01. pontját).
const items = [
  { to: "/user/dashboard", label: "Kezdőlap", icon: PiSquaresFourLight, activeIcon: PiSquaresFourFill },
  { to: "/user/bejelentes/uj", label: "Bejelentés", icon: PiWarningCircleLight, activeIcon: PiWarningCircleFill, fab: true },
  { to: "/user/profil", label: "Profil", icon: PiUserLight, activeIcon: PiUserFill },
];

export default function BottomNav() {
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] shadow-soft-lg md:hidden"
      aria-label="Fő navigáció"
    >
      {items.map((item) => {
        const active = isActive(item.to);
        const Icon = active ? item.activeIcon : item.icon;

        if (item.fab) {
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center justify-end gap-1 pb-2 pt-1 text-[11px] font-semibold leading-none text-red-600"
            >
              <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_10px_24px_-8px_rgba(220,38,38,0.55)] transition-transform duration-200 ease-fluid active:scale-90">
                <Icon className="h-6 w-6" />
              </span>
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium leading-none transition-colors duration-150 ${
              active ? "text-brand-600" : "text-ink-400"
            }`}
          >
            <Icon className="h-6 w-6" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
