import React from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import {
  PiSquaresFourLight,
  PiGearLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiWrenchLight,
  PiUsersLight,
  PiChatCircleTextLight,
  PiFilesLight,
  PiCalendarBlankLight,
  PiListLight,
  PiXLight,
  PiSignOutLight,
} from "react-icons/pi";

import NotificationDropdown from "components/Dropdowns/NotificationDropdown.js";
import { fetchAction } from "utils/fetchAction";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const location = useLocation();
  const history = useHistory();

  const isActive = (path) => location.pathname.includes(path);

  let user = null;
  try {
    user = JSON.parse(sessionStorage.getItem("user"));
  } catch (e) {
    user = null;
  }

  const handleLogout = async () => {
    const result = await fetchAction("logoutUser", { id: user?.id });
    sessionStorage.removeItem("user");
    if (!result?.success) {
      // Session already gone client-side regardless of server response.
      console.warn(result?.message || "Logout request failed.");
    }
    history.push("/");
  };

  const NavItem = ({ to, icon: Icon, text, subPath }) => {
    const active = isActive(subPath || to);
    return (
      <li>
        <Link
          className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 ease-fluid ${
            active
              ? "bg-brand-50 text-brand-700"
              : "text-ink-500 hover:translate-x-0.5 hover:bg-sand-100 hover:text-ink-800"
          }`}
          to={to}
          onClick={() => setIsMobileOpen(false)}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />
          )}
          <Icon
            className={`h-[18px] w-[18px] flex-shrink-0 ${
              active
                ? "text-brand-600"
                : "text-ink-400 group-hover:text-ink-600"
            }`}
          />
          {text}
        </Link>
      </li>
    );
  };

  const SectionHeader = ({ children }) => (
    <h6 className="px-3.5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-300">
      {children}
    </h6>
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav
        className={`fixed inset-y-0 left-0 z-30 flex w-72 transform flex-col border-r border-ink-100 bg-white transition-transform duration-300 ease-fluid md:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Fejléc — logó + név, mindig fixen fent */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2.5"
            onClick={() => setIsMobileOpen(false)}
          >
            <img
              src="/logo.svg"
              alt="Szikora Transz Kft"
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationDropdown />
            <button
              className="text-ink-400 hover:text-ink-700 md:hidden"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
            >
              {isMobileOpen ? (
                <PiXLight className="h-6 w-6" />
              ) : (
                <PiListLight className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Navigáció — ha nem fér ki, ez a rész görgethető */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <SectionHeader>Saját adatok</SectionHeader>
          <ul className="space-y-0.5">
            <NavItem
              to="/admin/dashboard"
              icon={PiSquaresFourLight}
              text="Főmenü"
            />
            <NavItem
              to="/admin/settings"
              icon={PiGearLight}
              text="Saját adatok"
            />
          </ul>

          <SectionHeader>Járművek</SectionHeader>
          <ul className="space-y-0.5">
            <NavItem to="/admin/kamionok" icon={PiTruckLight} text="Kamionok" />
            <NavItem
              to="/admin/potkocsi"
              icon={PiTruckTrailerLight}
              text="Pótkocsik"
            />
            <NavItem
              to="/admin/karbantartasok"
              icon={PiWrenchLight}
              text="Karbantartások"
            />
          </ul>

          <SectionHeader>Alkalmazottak</SectionHeader>
          <ul className="space-y-0.5">
            <NavItem to="/admin/soforok" icon={PiUsersLight} text="Sofőrök" />
            <NavItem
              to="/admin/bejelentesek"
              icon={PiChatCircleTextLight}
              text="Bejelentések"
            />
          </ul>

          <SectionHeader>Egyéb</SectionHeader>
          <ul className="space-y-0.5">
            <NavItem to="/admin/fajlok" icon={PiFilesLight} text="Fájlok" />
            <NavItem
              to="/admin/esemenyek"
              icon={PiCalendarBlankLight}
              text="Események"
            />
          </ul>
        </div>

        {/* Lábléc — fiók + kijelentkezés, mindig fixen lent és mindig látszik */}
        <div className="flex-shrink-0 border-t border-ink-100 px-4 py-4">
          <div className="mb-3 flex items-center gap-2.5 px-1">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white shadow-inner-hairline">
              {initials(user?.name || user?.nev)}
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold leading-tight text-brand-900">
                {user?.name || user?.nev || "Fiók"}
              </span>
              <span className="block text-xs leading-tight text-ink-400">
                {user?.admin ? "Adminisztrátor" : "Sofőr"}
              </span>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors duration-200 hover:bg-red-50"
          >
            <PiSignOutLight className="h-4 w-4" />
            Kijelentkezés
          </button>
        </div>
      </nav>

      {/* Mobil menü nyitógomb */}
      <button
        className="fixed bottom-5 left-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft-lg transition-transform duration-300 ease-fluid active:scale-95 md:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <PiListLight className="h-5 w-5" />
      </button>
    </>
  );
}
