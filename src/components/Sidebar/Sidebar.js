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
  PiMapPinLight,
  PiShieldCheckLight,
  PiListBulletsLight,
  PiMagnifyingGlassLight,
  PiCoinsLight,
  PiBellLight,
  PiPackageLight,
  PiCalendarCheckLight,
  PiSteeringWheelLight,
  PiCaretDownLight,
} from "react-icons/pi";

import NotificationDropdown from "components/Dropdowns/NotificationDropdown.js";
import GlobalSearch from "components/UI/GlobalSearch.js";
import { fetchAction } from "utils/fetchAction";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

// UX-audit alapján (2026-07) átrendezett navigáció, majd kézzel tovább
// finomítva — a korábbi 4 szekció (Áttekintés/Járművek/Csapat/Rendszer,
// összesen 19 menüpont + 4 fejléc, kb. 23 sor) helyett: egy fejléc
// nélküli, mindig látható "napi zóna" (a fájlban lentebb, a desktop JSX-
// ben kézzel testreszabott 3-4 pont) + 4 összecsukható csoport (Flotta/
// Csapat/Partnerek/Rendszer), amiből alapból csak a Flotta van nyitva.
// Cél: a leggyakoribb napi teendők egy pillantásra, asztalon lehetőség
// szerint görgetés nélkül elérhetők legyenek. A "Partnerek" (Ügyfelek,
// Helyszínek) önálló, külön nyitható/csukható csoport — nem a "Csapat"
// belsejébe rejtett divider —, mert tartalmilag külső partnerek, nem a
// cég saját csapata. Az Események és Felhasználók a "Rendszer" csoportba
// került, mert mindkettő inkább alkalmi áttekintő/adminisztrációs eszköz,
// nem napi flotta- vagy csapatmunka.
const mobileDirectLinks = [
  { to: "/admin/dashboard", icon: PiSquaresFourLight, text: "Menü" },
  { to: "/admin/fuvarok", icon: PiPackageLight, text: "Fuvarok" },
  { to: "/admin/settings", icon: PiGearLight, text: "Profil" },
];

const mobileGroups = [
  {
    key: "flotta",
    label: "Flotta",
    icon: PiTruckLight,
    items: [
      {
        to: "/admin/fuvartervezo",
        icon: PiCalendarCheckLight,
        text: "Fuvartervező",
      },
      { to: "/admin/kamionok", icon: PiTruckLight, text: "Kamionok" },
      { to: "/admin/potkocsi", icon: PiTruckTrailerLight, text: "Pótkocsik" },
      {
        to: "/admin/karbantartasok",
        icon: PiWrenchLight,
        text: "Karbantartások",
      },
      { to: "/admin/koltsegek", icon: PiCoinsLight, text: "Pénzforgalom" },
    ],
  },
  {
    key: "csapat",
    label: "Csapat",
    icon: PiUsersLight,
    items: [
      { to: "/admin/soforok", icon: PiUsersLight, text: "Sofőrök" },
      {
        to: "/admin/vezetesi-ido",
        icon: PiSteeringWheelLight,
        text: "Vezetési idő",
      },
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
    key: "partnerek",
    label: "Partnerek",
    icon: PiBuildingsLight,
    items: [
      { to: "/admin/ugyfelek", icon: PiBuildingsLight, text: "Ügyfelek" },
      { to: "/admin/helyszinek", icon: PiMapPinLight, text: "Helyszínek" },
    ],
  },
  {
    key: "rendszer",
    label: "Rendszer",
    icon: PiFilesLight,
    items: [
      { to: "/admin/fajlok", icon: PiFilesLight, text: "Fájlok" },
      { to: "/admin/naplo", icon: PiListMagnifyingGlassLight, text: "Napló" },
      { to: "/admin/esemenyek", icon: PiCalendarBlankLight, text: "Események" },
      {
        to: "/admin/felhasznalok",
        icon: PiUsersFourLight,
        text: "Felhasználók",
      },
      // Csak adminisztrátor szerepkörnek jelenik meg — ő állíthatja be a
      // fuvarszervező jogosultságait, a fuvarszervezőnek maga a beállítás
      // sem lenne elérhető (a mentés akció is admin-only a backendben).
      {
        to: "/admin/jogosultsagok",
        icon: PiShieldCheckLight,
        text: "Jogosultságok",
        adminOnly: true,
      },
      // Kamionméret, jármű-állapot, bejelentés-/szabadság-típus stb.
      // egyéni bővítése — szintén csak adminisztrátornak (a szerkesztő
      // akciók is admin-only a backendben).
      {
        to: "/admin/listak",
        icon: PiListBulletsLight,
        text: "Listák",
        adminOnly: true,
      },
    ],
  },
];

const TIPUS_LABEL = { kamion: "kamiont", potkocsi: "pótkocsit" };

export default function Sidebar() {
  const [openGroup, setOpenGroup] = React.useState(null);
  const [kerelmek, setKerelmek] = React.useState([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const location = useLocation();
  const history = useHistory();

  const isActive = (path) => location.pathname.includes(path);

  let user = null;
  try {
    user = JSON.parse(sessionStorage.getItem("user"));
  } catch (e) {
    user = null;
  }
  // A gyökér (cégtulajdonos) szerepköre mindig fixen 'admin' (ld.
  // Felhasznalok.js), tehát ez a feltétel a root fiókot is helyesen lefedi.
  const isAdmin = user?.szerepkor === "admin";

  // Az összecsukható deszktop-csoportok (Flotta/Csapat/Partnerek/Rendszer)
  // nyitott/csukott állapota fiókonként megjegyzve — ha valaki gyakran
  // nyitja pl. a Csapatot, a következő belépéskor is nyitva várja, anélkül
  // hogy egy teljes, testreszabható menü-szerkesztőt kellene építeni ehhez
  // (ld. UX-audit "Kell-e önálló Kedvencek/pin funkció?" pontja — nem, ez a
  // könnyű perzisztencia elég). Alapállapot: csak a Flotta nyitva (a
  // legforgalmasabb csoport a napi zóna után), a többi három csukva.
  const [openGroups, setOpenGroups] = React.useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(`sidebar-groups-${user?.id}`) || "null",
      );
      if (stored) return stored;
    } catch (e) {
      // ignore corrupt/legacy localStorage érték
    }
    return { flotta: true, csapat: false, partnerek: false, rendszer: false };
  });
  React.useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(
      `sidebar-groups-${user.id}`,
      JSON.stringify(openGroups),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroups]);
  const toggleGroup = (key) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // A Sidebar kizárólag az Admin layoutban él (ld. layouts/Admin.js) — ide
  // sofőr (user tábla) fiók sosem jut el, tehát a lábléc korábbi
  // `user?.admin ? "Adminisztrátor" : "Sofőr"` feltétele valójában mindig
  // "Adminisztrátor"-t mutatott, MÉG egy fuvarszervező vagy egyéni
  // szerepkörű csapattagnak is (a backend `admin` mezője minden admin-tábla
  // sorra `true`, szerepkörtől függetlenül). A tényleges nevet ezért a cég
  // szerepkör-listájából kell kikeresni — ugyanaz a minta, mint
  // CardSettings.js-ben.
  const [szerepkorNev, setSzerepkorNev] = React.useState(
    isAdmin ? "Adminisztrátor" : user?.szerepkor || "",
  );
  React.useEffect(() => {
    if (!user?.ceg_id) return;
    fetchAction("getSzerepkorok", { id: user.ceg_id }).then((result) => {
      if (result?.success) {
        const talalt = (result.szerepkorok || []).find(
          (r) => r.kulcs === user.szerepkor,
        );
        if (talalt) setSzerepkorNev(talalt.nev);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Nyitott (még meg nem válaszolt) bejelentések — a haranG eddig kizárólag
  // a jármű-váltási kérelmeket mutatta, egy új bejelentésről az admin
  // sehonnan nem értesült, csak ha manuálisan megnyitotta a Bejelentések
  // oldalt és kiválasztott egy kamiont. Ugyanez a szám ad jelvényt a
  // "Bejelentések" menüpontra a napi zónában és a mobil "Csapat" fülre is.
  const [nyitottBejelentesek, setNyitottBejelentesek] = React.useState([]);
  React.useEffect(() => {
    if (!user?.ceg_id) return;
    fetchAction("getNyitottBejelentesek", { id: user.ceg_id }).then(
      (result) => {
        if (result?.success) setNyitottBejelentesek(result.bejelentesek || []);
      },
    );
  }, [user?.ceg_id]);

  // A menüpontok elrejtéséhez a fuvarszervező a SAJÁT jogosultságait kéri le
  // (nem a admin-only `getJogosultsagok`-ot) — ld. ApiHandler `getSajatJogosultsagok`
  // komment. Amíg nem admin/root, `null` marad, és minden menüpont látszik
  // (nincs "felvillanás, majd eltűnés" a betöltés alatt); adminnak/gyökérnek
  // sosem kell lekérni, ő mindig mindent lát.
  const [modulHozzaferes, setModulHozzaferes] = React.useState(null);
  React.useEffect(() => {
    if (isAdmin || !user?.id) return;
    fetchAction("getSajatJogosultsagok", { kerelmezo_id: user.id }).then(
      (result) => {
        if (result?.success) {
          const map = {};
          (result.jogosultsagok || []).forEach((row) => {
            map[row.modul] = row.hozzaferes === "I";
          });
          setModulHozzaferes(map);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.id]);

  const MODUL_PATH = {
    "/admin/kamionok": "kamionok",
    "/admin/potkocsi": "potkocsik",
    "/admin/karbantartasok": "karbantartasok",
    "/admin/soforok": "soforok",
    "/admin/vezetesi-ido": "vezetesi_ido",
    "/admin/bejelentesek": "bejelentesek",
    "/admin/szabadsagok": "szabadsagok",
    "/admin/ugyfelek": "ugyfelek",
    "/admin/naplo": "naplo",
    "/admin/koltsegek": "koltsegek",
    "/admin/fuvarok": "fuvarok",
    "/admin/fuvartervezo": "fuvarok",
  };
  // Helyszínek/Fájlok/Események szándékosan nincs a fenti térképben — ezeket
  // a backend (megosztott sofőr-hozzáférés miatt) nem korlátozza, ld.
  // ApiHandler::MODULE_PERMISSION_MAP komment, tehát a Sidebar se rejtse el.
  const hasAccess = (to) => {
    const modul = MODUL_PATH[to];
    if (!modul || isAdmin || !modulHozzaferes) return true;
    return modulHozzaferes[modul] !== false;
  };

  const handleElbiral = async (id, allapot) => {
    const result = await fetchAction("elbiralJarmuValtas", {
      id,
      allapot,
      admin: user.ceg_id,
    });
    if (result?.success) {
      loadKerelmek();
    }
  };

  const kerelemNotifications = kerelmek.map((k) => ({
    id: `jarmu-valtas-${k.id}`,
    text: `${k.sofor_nev || "Egy sofőr"} másik ${TIPUS_LABEL[k.tipus] || "járművet"} kér: ${k.jarmu_rendszam || "?"}`,
    meta: k.indoklas || null,
    actions: [
      { label: "Jóváhagyás", onClick: () => handleElbiral(k.id, "jovahagyva") },
      {
        label: "Elutasítás",
        tone: "danger",
        onClick: () => handleElbiral(k.id, "elutasitva"),
      },
    ],
  }));

  const bejelentesNotifications = nyitottBejelentesek.map((b) => ({
    id: `bejelentes-${b.id}`,
    text: `${b.sofor_nev || "Egy sofőr"} bejelentést tett: ${b.cim || "Bejelentés"}`,
    meta: b.kamion_rendszam || null,
    actions: [
      {
        label: "Megnyitás",
        onClick: () => history.push("/admin/bejelentesek"),
      },
    ],
  }));

  // Törölt (elrejtett) értesítés-kulcsok — a forrás-sorok (kérelem/
  // bejelentés) maguk nem tűnnek el a törléssel, csak ennek az admin
  // fióknak a haranG-jából, ld. ertesitesInterface.php komment.
  const [toroltKulcsok, setToroltKulcsok] = React.useState([]);
  React.useEffect(() => {
    if (!user?.id) return;
    fetchAction("getToroltErtesitesek", { kerelmezo_id: user.id }).then(
      (result) => {
        if (result?.success) setToroltKulcsok(result.kulcsok || []);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allNotifications = [
    ...bejelentesNotifications,
    ...kerelemNotifications,
  ].filter((n) => !toroltKulcsok.includes(n.id));

  const handleDismiss = (kulcsok) => {
    const lista = Array.isArray(kulcsok) ? kulcsok : [kulcsok];
    setToroltKulcsok((prev) => [...prev, ...lista]);
    fetchAction("torolErtesites", { kerelmezo_id: user.id, kulcsok: lista });
  };

  const handleLogout = async () => {
    const result = await fetchAction("logoutUser", { id: user?.id });
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("sessionToken");
    if (!result?.success) {
      // Session already gone client-side regardless of server response.
      console.warn(result?.message || "Logout request failed.");
    }
    history.push("/");
  };

  const NavItem = ({ to, icon: Icon, text, subPath, badge }) => {
    if (!hasAccess(to)) return null;
    const active = isActive(subPath || to);
    return (
      <li>
        <Link
          aria-current={active ? "page" : undefined}
          className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 ease-fluid ${
            active
              ? "bg-brand-50 text-brand-700"
              : "text-ink-500 hover:translate-x-0.5 hover:bg-slate-100 hover:text-ink-800"
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
          {badge > 0 && (
            <span className="ml-auto flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
        </Link>
      </li>
    );
  };

  // Összecsukható deszktop-szekció fejléce — a teljes sor kattintható
  // (nem csak egy kis nyíl-ikon), hogy nagy legyen a találati terület.
  // A korábbi verzió (10px szürke felirat + apró, halvány nyíl, háttér
  // nélkül) túl visszafogott volt ahhoz, hogy egyértelmű legyen: ez egy
  // lenyitható vezérlő, nem csak egy statikus szekció-címke — most van
  // hover-háttér (ugyanaz a minta, mint a NavItem-eknél), sötétebb/
  // vastagabb felirat, és egy nagyobb nyíl saját, kerek "gomb" hátérrel.
  const GroupHeader = ({ label, open, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group mt-1 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors duration-200 hover:bg-slate-100"
    >
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500 group-hover:text-ink-800">
        {label}
      </span>
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-400 transition-colors duration-200 group-hover:bg-white group-hover:text-brand-600">
        <PiCaretDownLight
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </span>
    </button>
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700"
              title="Keresés"
              aria-label="Keresés"
            >
              <PiMagnifyingGlassLight className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700"
              title="Értesítések"
              aria-label="Értesítések"
            >
              <PiBellLight className="h-[18px] w-[18px]" />
              {allNotifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-white" />
              )}
            </button>
          </div>
        </div>

        {/* Navigáció — ha nem fér ki, ez a rész görgethető.
            UX-audit alapján átrendezve (2026-07): "napi zóna" (fejléc
            nélküli, mindig nyitva, sticky a görgethető terület tetején) +
            4 összecsukható csoport (Flotta alapból nyitva, Csapat/
            Partnerek/Rendszer csukva) — ld. a fájl tetején lévő komment a
            teljes indoklásért. A saját profil (Saját adatok) a lábléc
            fiók-sorára kattintva
            érhető el, nem önálló menüpontként — ld. lentebb. */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="sticky top-0 z-10 mb-1 rounded-2xl bg-brand-50/70 p-2 backdrop-blur-sm">
            <ul className="space-y-0.5">
              <NavItem
                to="/admin/dashboard"
                icon={PiSquaresFourLight}
                text="Főmenü"
              />
              <NavItem
                to="/admin/karbantartasok"
                icon={PiWrenchLight}
                text="Karbantartások"
              />
              <NavItem
                to="/admin/bejelentesek"
                icon={PiChatCircleTextLight}
                text="Bejelentések"
                badge={nyitottBejelentesek.length}
              />
              <NavItem
                to="/admin/koltsegek"
                icon={PiCoinsLight}
                text="Pénzforgalom"
              />
            </ul>
          </div>

          <div>
            <GroupHeader
              label="Flotta"
              open={openGroups.flotta}
              onToggle={() => toggleGroup("flotta")}
            />
            {openGroups.flotta && (
              <ul className="space-y-0.5">
                <NavItem
                  to="/admin/kamionok"
                  icon={PiTruckLight}
                  text="Kamionok"
                />
                <NavItem
                  to="/admin/potkocsi"
                  icon={PiTruckTrailerLight}
                  text="Pótkocsik"
                />
                <NavItem
                  to="/admin/fuvarok"
                  icon={PiPackageLight}
                  text="Fuvarok"
                />
                <NavItem
                  to="/admin/fuvartervezo"
                  icon={PiCalendarCheckLight}
                  text="Fuvartervező"
                />
              </ul>
            )}
          </div>

          <div>
            <GroupHeader
              label="Csapat"
              open={openGroups.csapat}
              onToggle={() => toggleGroup("csapat")}
            />
            {openGroups.csapat && (
              <ul className="space-y-0.5">
                <NavItem
                  to="/admin/soforok"
                  icon={PiUsersLight}
                  text="Sofőrök"
                />
                <NavItem
                  to="/admin/vezetesi-ido"
                  icon={PiSteeringWheelLight}
                  text="Vezetési idő"
                />
                <NavItem
                  to="/admin/szabadsagok"
                  icon={PiCalendarBlankLight}
                  text="Szabadságok"
                />
              </ul>
            )}
          </div>

          <div>
            <GroupHeader
              label="Partnerek"
              open={openGroups.partnerek}
              onToggle={() => toggleGroup("partnerek")}
            />
            {openGroups.partnerek && (
              <ul className="space-y-0.5">
                <NavItem
                  to="/admin/ugyfelek"
                  icon={PiBuildingsLight}
                  text="Ügyfelek"
                />
                <NavItem
                  to="/admin/helyszinek"
                  icon={PiMapPinLight}
                  text="Helyszínek"
                />
              </ul>
            )}
          </div>

          <div>
            <GroupHeader
              label="Rendszer"
              open={openGroups.rendszer}
              onToggle={() => toggleGroup("rendszer")}
            />
            {openGroups.rendszer && (
              <ul className="space-y-0.5">
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
                <NavItem
                  to="/admin/felhasznalok"
                  icon={PiUsersFourLight}
                  text="Felhasználók"
                />
                {isAdmin && (
                  <>
                    <li
                      aria-hidden="true"
                      className="mx-3.5 my-1.5 border-t border-ink-100"
                    />
                    <NavItem
                      to="/admin/jogosultsagok"
                      icon={PiShieldCheckLight}
                      text="Jogosultságok"
                    />
                    <NavItem
                      to="/admin/listak"
                      icon={PiListBulletsLight}
                      text="Listák"
                    />
                  </>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Lábléc — fiók + kijelentkezés, mindig fixen lent és mindig látszik.
            A fiók-sor most a saját profil (Saját adatok) linkje is egyben —
            korábban ez egy külön "Saját adatok" menüpont volt fent a
            "Saját adatok" gyűjtő szekcióban, ami vegyítette a személyes
            beállítást a csapat-/admin-eszközökkel; a fogaskerék-ikon jelzi,
            hogy a sor kattintható. */}
        <div className="flex-shrink-0 border-t border-ink-100 px-4 py-4">
          <Link
            to="/admin/settings"
            className="group -mx-1 mb-3 flex items-center gap-2.5 rounded-xl px-1 py-1.5 transition-colors duration-200 hover:bg-slate-100"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white shadow-inner-hairline">
              {initials(user?.name || user?.nev)}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold leading-tight text-brand-900">
                {user?.name || user?.nev || "Fiók"}
              </span>
              <span className="block truncate text-xs leading-tight text-ink-400">
                {szerepkorNev}
              </span>
            </span>
            <PiGearLight className="h-4 w-4 flex-shrink-0 text-ink-300 transition-colors duration-200 group-hover:text-ink-500" />
          </Link>
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
        {/* Csoport lista — felfelé nyílik, a sáv fölött.
            `overflow-y-auto` a korábbi `overflow-hidden` helyett: a
            "Rendszer" csoport admin nézetben 6 elemet tartalmaz, ami a
            korábbi rögzített max-h-64 (256px) magasságnál több —
            overflow-hidden mellett ez némán LEVÁGTA a lista alját.
            A max-h-96-ra emelt korlát a jelenlegi legnagyobb csoportot még
            görgetés nélkül is kiadja, az overflow-y-auto pedig biztonsági
            háló, ha egy jövőbeli bővítés miatt mégis rövidebb lenne. */}
        <div
          className={`overflow-y-auto rounded-t-2xl border-t border-ink-100 bg-white shadow-soft-lg transition-all duration-300 ease-fluid ${
            openGroup ? "max-h-96" : "max-h-0"
          }`}
        >
          {mobileGroups
            .filter((group) => group.key === openGroup)
            .map((group) => (
              <ul
                key={group.key}
                id={`mobile-group-panel-${group.key}`}
                className="px-2 py-1.5"
              >
                {group.items
                  .filter(
                    (item) =>
                      item.type === "divider" ||
                      ((!item.adminOnly || isAdmin) && hasAccess(item.to)),
                  )
                  .map((item, i) => {
                    if (item.type === "divider") {
                      return (
                        <li
                          key={`divider-${item.label}`}
                          className={`px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 ${
                            i === 0 ? "pt-1" : "pt-3"
                          }`}
                        >
                          {item.label}
                        </li>
                      );
                    }
                    const active = isActive(item.to);
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium ${
                            active
                              ? "bg-brand-50 text-brand-700"
                              : "text-ink-600 hover:bg-slate-100"
                          }`}
                          onClick={() => setOpenGroup(null)}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                          {item.text}
                          {item.to === "/admin/bejelentesek" &&
                            nyitottBejelentesek.length > 0 && (
                              <span className="ml-auto flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {nyitottBejelentesek.length}
                              </span>
                            )}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ))}
        </div>

        {/* Fő linkek + csoport fülek + kompakt kilépés gomb — a korábbi
            py-1.5/h-4 ikon/text-[10px] kombináció a felhasználó szerint túl
            kicsi volt; nagyobb ikon, betűméret és érintési terület. A
            "Csapat" fülön egy piros pont jelzi, ha van nyitott bejelentés
            (ami a fülön belülre, a Csapat csoportba került), hogy ne kelljen
            kinyitni a listát ahhoz, hogy lássa: van tennivaló. */}
        <nav className="flex border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)]">
          {mobileDirectLinks.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[11px] font-medium leading-none ${
                  active ? "text-brand-600" : "text-ink-400"
                }`}
                onClick={() => setOpenGroup(null)}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="w-full truncate text-center">{item.text}</span>
              </Link>
            );
          })}
          {mobileGroups.map((group) => {
            const active =
              openGroup === group.key ||
              group.items.some((item) => item.to && isActive(item.to));
            const showBadge =
              group.key === "csapat" && nyitottBejelentesek.length > 0;
            return (
              <button
                key={group.key}
                type="button"
                aria-expanded={openGroup === group.key}
                aria-controls={`mobile-group-panel-${group.key}`}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[11px] font-medium leading-none ${
                  active ? "text-brand-600" : "text-ink-400"
                }`}
                onClick={() =>
                  setOpenGroup(openGroup === group.key ? null : group.key)
                }
              >
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <group.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </span>
                <span className="w-full truncate text-center">
                  {group.label}
                </span>
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

      {/* Mobil kereső- és értesítés-FAB — nem fér egy új oszlop a már
          zsúfolt alsó navigációba (7 oszlop), ezért lebegő gombként, a sáv
          fölött, egymás fölé rakva. Az értesítés-haranG korábban csak a
          deszktop Sidebar fejlécében élt — mobilon eddig sehonnan nem volt
          elérhető, most a NotificationDropdown önálló overlay-jét ez a FAB
          is meg tudja nyitni. */}
      <button
        type="button"
        onClick={() => setNotifOpen(true)}
        className="fixed bottom-36 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-500 shadow-soft-lg ring-1 ring-ink-100 md:hidden"
        title="Értesítések"
        aria-label="Értesítések"
      >
        <PiBellLight className="h-5 w-5" />
        {allNotifications.length > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-ember-500 ring-2 ring-white" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft-lg md:hidden"
        title="Keresés"
        aria-label="Keresés"
      >
        <PiMagnifyingGlassLight className="h-5 w-5" />
      </button>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationDropdown
        notifications={allNotifications}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismiss}
      />
    </>
  );
}
