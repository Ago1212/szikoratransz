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
  PiSignOutLight,
  PiListMagnifyingGlassLight,
  PiBuildingsLight,
  PiUsersFourLight,
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

const mobileDirectLinks = [
  { to: "/admin/dashboard", icon: PiSquaresFourLight, text: "Főmenü" },
  { to: "/admin/settings", icon: PiGearLight, text: "Saját adatok" },
  { to: "/admin/felhasznalok", icon: PiUsersFourLight, text: "Felhasználók" },
];

const mobileGroups = [
  {
    key: "jarmuvek",
    label: "Járművek",
    icon: PiTruckLight,
    items: [
      { to: "/admin/kamionok", icon: PiTruckLight, text: "Kamionok" },
      {
        to: "/admin/potkocsi",
        icon: PiTruckTrailerLight,
        text: "Pótkocsik",
      },
      {
        to: "/admin/karbantartasok",
        icon: PiWrenchLight,
        text: "Karbantartások",
      },
    ],
  },
  {
    key: "alkalmazottak",
    label: "Alkalmazottak",
    icon: PiUsersLight,
    items: [
      { to: "/admin/soforok", icon: PiUsersLight, text: "Sofőrök" },
      {
        to: "/admin/bejelentesek",
        icon: PiChatCircleTextLight,
        text: "Bejelentések",
      },
      {
        to: "/admin/szabadsagok",
        icon: PiCalendarBlankLight,
        text: "Szabadságok",
      },
    ],
  },
  {
    key: "egyeb",
    label: "Egyéb",
    icon: PiFilesLight,
    items: [
      { to: "/admin/ugyfelek", icon: PiBuildingsLight, text: "Ügyfelek" },
      { to: "/admin/fajlok", icon: PiFilesLight, text: "Fájlok" },
      { to: "/admin/naplo", icon: PiListMagnifyingGlassLight, text: "Napló" },
      {
        to: "/admin/esemenyek",
        icon: PiCalendarBlankLight,
        text: "Események",
      },
    ],
  },
];

const TIPUS_LABEL = { kamion: "kamiont", potkocsi: "pótkocsit" };

export default function Sidebar() {
  const [openGroup, setOpenGroup] = React.useState(null);
  const [kerelmek, setKerelmek] = React.useState([]);
  const location = useLocation();
  const history = useHistory();

  const isActive = (path) => location.pathname.includes(path);

  let user = null;
  try {
    user = JSON.parse(sessionStorage.getItem("user"));
  } catch (e) {
    user = null;
  }

  const loadKerelmek = React.useCallback(() => {
    if (!user?.ceg_id) return;
    fetchAction("getFuggoJarmuValtasok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setKerelmek(result.kerelmek || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.ceg_id]);

  React.useEffect(() => {
    loadKerelmek();
  }, [loadKerelmek]);

  const handleElbiral = async (id, allapot) => {
    const result = await fetchAction("elbiralJarmuValtas", { id, allapot, admin: user.ceg_id });
    if (result?.success) {
      loadKerelmek();
    }
  };

  const kerelemNotifications = kerelmek.map((k) => ({
    id: k.id,
    text: `${k.sofor_nev || "Egy sofőr"} másik ${TIPUS_LABEL[k.tipus] || "járművet"} kér: ${k.jarmu_rendszam || "?"}`,
    meta: k.indoklas || null,
    actions: [
      { label: "Jóváhagyás", onClick: () => handleElbiral(k.id, "jovahagyva") },
      { label: "Elutasítás", tone: "danger", onClick: () => handleElbiral(k.id, "elutasitva") },
    ],
  }));

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
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-ink-100 bg-white md:flex">
        {/* Fejléc — logó + név, mindig fixen fent */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <img
              src="/logo2.svg"
              alt="Szikora Transz Kft"
              className="h-8 w-auto"
            />
          </Link>
          <NotificationDropdown notifications={kerelemNotifications} />
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
            <NavItem
              to="/admin/felhasznalok"
              icon={PiUsersFourLight}
              text="Felhasználók"
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
            <NavItem
              to="/admin/szabadsagok"
              icon={PiCalendarBlankLight}
              text="Szabadságok"
            />
          </ul>

          <SectionHeader>Egyéb</SectionHeader>
          <ul className="space-y-0.5">
            <NavItem to="/admin/ugyfelek" icon={PiBuildingsLight} text="Ügyfelek" />
            <NavItem to="/admin/fajlok" icon={PiFilesLight} text="Fájlok" />
            <NavItem
              to="/admin/naplo"
              icon={PiListMagnifyingGlassLight}
              text="Napló"
            />
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

      {/* Háttér — a nyitott csoport listája alatt, kattintásra bezár */}
      {openGroup && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/30 md:hidden"
          onClick={() => setOpenGroup(null)}
        />
      )}

      {/* Mobil alsó navigáció — a fő csoportok mindig lent, kompakt sávban */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        {/* Csoport lista — felfelé nyílik, a sáv fölött */}
        <div
          className={`overflow-hidden rounded-t-2xl border-t border-ink-100 bg-white shadow-soft-lg transition-all duration-300 ease-fluid ${
            openGroup ? "max-h-64" : "max-h-0"
          }`}
        >
          {mobileGroups
            .filter((group) => group.key === openGroup)
            .map((group) => (
              <ul key={group.key} className="px-2 py-1.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium ${
                          active
                            ? "bg-brand-50 text-brand-700"
                            : "text-ink-600 hover:bg-sand-100"
                        }`}
                        onClick={() => setOpenGroup(null)}
                      >
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                        {item.text}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>

        {/* Fő linkek + csoport fülek + kompakt kilépés gomb — a korábbi
            py-1.5/h-4 ikon/text-[10px] kombináció a felhasználó szerint túl
            kicsi volt; nagyobb ikon, betűméret és érintési terület. */}
        <nav className="flex border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)]">
          {mobileDirectLinks.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium leading-none ${
                  active ? "text-brand-600" : "text-ink-400"
                }`}
                onClick={() => setOpenGroup(null)}
              >
                <item.icon className="h-5 w-5" />
                {item.text}
              </Link>
            );
          })}
          {mobileGroups.map((group) => {
            const active =
              openGroup === group.key ||
              group.items.some((item) => isActive(item.to));
            return (
              <button
                key={group.key}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium leading-none ${
                  active ? "text-brand-600" : "text-ink-400"
                }`}
                onClick={() =>
                  setOpenGroup(openGroup === group.key ? null : group.key)
                }
              >
                <group.icon className="h-5 w-5" />
                {group.label}
              </button>
            );
          })}
          <button
            className="flex w-12 flex-shrink-0 flex-col items-center justify-center py-2.5 text-red-500"
            onClick={handleLogout}
          >
            <PiSignOutLight className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </>
  );
}
