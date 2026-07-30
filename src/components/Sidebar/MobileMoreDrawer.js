import React from "react";
import { Link } from "react-router-dom";
import {
  PiMagnifyingGlassLight,
  PiCaretDownLight,
  PiGearLight,
  PiSignOutLight,
  PiSunLight,
  PiMoonLight,
} from "react-icons/pi";

// Mobil navigáció újratervezés (2026-07-30) — teljes képernyős "Több"
// drawer: kereső + személyre szabható Kedvencek (a desktop napi zóna
// pin-rendszerének újrahasznosítása) + 5 lenyitható csoport (ugyanaz az
// accordion-minta, mint a desktop sidebar `GroupHeader`-je) + fiók-sor
// (Profil/Sötét mód/Kijelentkezés — ezek korábban önálló bottom nav
// helyet/akció-elemet foglaltak, most ide költöztek).
const GROUP_ORDER = [
  { key: "flotta", label: "Flotta" },
  { key: "csapat", label: "Csapat" },
  { key: "partnerek", label: "Partnerek" },
  { key: "penzugyek", label: "Pénzügyek" },
  { key: "rendszer", label: "Rendszerbeállítások" },
];

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

export default function MobileMoreDrawer({
  open,
  onClose,
  onSearchOpen,
  pinnedItems,
  badgeByPath,
  groups,
  isAdmin,
  hasAccess,
  isActive,
  user,
  szerepkorNev,
  onLogout,
  isDark,
  onToggleDark,
}) {
  const [openGroups, setOpenGroups] = React.useState({});
  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!open) return null;

  const groupByKey = Object.fromEntries(groups.map((g) => [g.key, g]));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-ink-900 md:hidden">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-ink-100 px-3 py-3 dark:border-ink-800">
        <button
          type="button"
          onClick={onClose}
          aria-label="Bezárás"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-ink-500 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <PiCaretDownLight className="h-5 w-5 rotate-90" />
        </button>
        <h2 className="text-base font-semibold text-brand-900 dark:text-ink-50">Több</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            onSearchOpen();
          }}
          className="mb-3 flex min-h-11 w-full items-center gap-2 rounded-xl border border-ink-100 bg-slate-50 px-3 py-2 text-left text-ink-400 dark:border-ink-700 dark:bg-ink-800"
        >
          <PiMagnifyingGlassLight className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-sm">Keresés</span>
        </button>

        {pinnedItems.length > 0 && (
          <div className="mb-3 rounded-2xl bg-brand-50/70 p-2 dark:bg-brand-950/40">
            <p className="mb-1 px-1.5 pt-0.5 text-xs font-bold uppercase tracking-[0.1em] text-brand-700 dark:text-brand-300">
              Kedvencek
            </p>
            <ul className="space-y-0.5">
              {pinnedItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                      isActive(item.to)
                        ? "bg-white text-brand-700 dark:bg-ink-800 dark:text-brand-300"
                        : "text-ink-600 dark:text-ink-300"
                    }`}
                  >
                    <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                    {item.text}
                    {badgeByPath[item.to] > 0 && (
                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {badgeByPath[item.to]}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {GROUP_ORDER.map(({ key, label }) => {
          const group = groupByKey[key];
          if (!group) return null;
          const visibleItems = group.items.filter(
            (item) => (!item.adminOnly || isAdmin) && hasAccess(item.to),
          );
          if (visibleItems.length === 0) return null;
          const isOpen = !!openGroups[key];
          return (
            <div key={key} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-ink-800"
              >
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500 dark:text-ink-400">
                  {label}
                </span>
                <PiCaretDownLight
                  className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {isOpen && (
                <ul className="space-y-0.5 py-1">
                  {visibleItems.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onClose}
                        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 pl-6 text-sm font-medium ${
                          isActive(item.to)
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                            : "text-ink-600 dark:text-ink-300"
                        }`}
                      >
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                        {item.text}
                        {badgeByPath[item.to] > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {badgeByPath[item.to]}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 border-t border-ink-100 px-4 py-4 dark:border-ink-800">
        <Link
          to="/admin/settings"
          onClick={onClose}
          className="group -mx-1 mb-2 flex items-center gap-2.5 rounded-xl px-1 py-1.5 hover:bg-slate-100 dark:hover:bg-ink-800"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials(user?.name || user?.nev)}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold text-brand-900 dark:text-ink-50">
              {user?.name || user?.nev || "Fiók"}
            </span>
            <span className="block truncate text-xs text-ink-400 dark:text-ink-500">{szerepkorNev}</span>
          </span>
          <PiGearLight className="h-4 w-4 flex-shrink-0 text-ink-300 dark:text-ink-500" />
        </Link>
        <button
          type="button"
          onClick={onToggleDark}
          className="mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          {isDark ? <PiSunLight className="h-4 w-4" /> : <PiMoonLight className="h-4 w-4" />}
          {isDark ? "Világos mód" : "Sötét mód"}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <PiSignOutLight className="h-4 w-4" />
          Kijelentkezés
        </button>
      </div>
    </div>
  );
}
