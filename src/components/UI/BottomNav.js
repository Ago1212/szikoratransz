import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  PiSquaresFourLight,
  PiSquaresFourFill,
  PiMapPinLight,
  PiMapPinFill,
  PiClipboardTextLight,
  PiClipboardTextFill,
  PiUserLight,
  PiUserFill,
} from "react-icons/pi";

// Sofőr-oldali alsó navigáció (csak mobilon, md-től a desktop felső
// navigáció veszi át a szerepét). 2026-07-28: a középső FAB Bejelentésről
// Fuvarokra váltott (ld. docs/superpowers/specs/2026-07-28-fuvar-first-
// workflow-design.md 6.1, explicit felhasználói döntés) — a Fuvar-first
// munkafolyamatban ez lett a naponta legtöbbször használt, egy kézzel
// elérendő művelet. A Bejelentés emiatt elvesztette az "egy érintésre,
// bárhonnan" tulajdonságát (ld. a spec 10. pontjának nyitott kockázata) —
// továbbra is elérhető a Dashboard kis összegző során és a
// /user/bejelentesek oldalon, csak nem a BottomNav-on. A FAB piros
// (vészjelzés-jellegű) színe is brand-kékre váltott, mert a Fuvarok egy
// rutinszerű, nem sürgősségi művelet — a piros itt félrevezető lenne.
const items = [
  { to: "/user/dashboard", label: "Kezdőlap", icon: PiSquaresFourLight, activeIcon: PiSquaresFourFill },
  { to: "/user/helyszinek", label: "Helyszínek", icon: PiMapPinLight, activeIcon: PiMapPinFill },
  { to: "/user/fuvarok", label: "Fuvarok", icon: PiClipboardTextLight, activeIcon: PiClipboardTextFill, fab: true },
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
              className="flex flex-1 flex-col items-center justify-end gap-1 pb-2 pt-1 text-[11px] font-semibold leading-none text-brand-600"
            >
              <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_10px_24px_-8px_rgba(37,99,235,0.55)] transition-transform duration-200 ease-fluid active:scale-90">
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
