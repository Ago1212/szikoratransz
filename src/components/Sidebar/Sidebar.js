import React from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import {
  PiSquaresFourLight,
  PiGearLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
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
  PiCaretDownLight,
  PiMapTrifoldLight,
  PiEnvelopeSimpleLight,
  PiChartBarLight,
  PiSunLight,
  PiMoonLight,
  PiIdentificationCardLight,
  PiClipboardTextLight,
  PiPencilSimpleLight,
  PiPlusLight,
  PiListLight,
} from "react-icons/pi";

import NotificationDropdown from "components/Dropdowns/NotificationDropdown.js";
import GlobalSearch from "components/UI/GlobalSearch.js";
import PiaciArakPanel from "components/Sidebar/PiaciArakPanel.js";
import NapiZonaEditorModal from "components/Sidebar/NapiZonaEditorModal.js";
import QuickActionSheet from "components/Sidebar/QuickActionSheet.js";
import MobileMoreDrawer from "components/Sidebar/MobileMoreDrawer.js";
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
// Mobil navigáció újratervezés (2026-07-30, ld. docs/superpowers/specs/
// 2026-07-30-mobil-navigacio-ujratervezes-design.md): a korábbi 6 fülből
// (Menü, Profil, Flotta, Csapat, Rendszer, Értesítések) 5 slot + FAB lett —
// a "Menü" Kezdőlapra, a "Profil" a "Több" drawer fiók-sorába költözött, és
// a Fuvarok (a fuvar-first munkafolyamat napi diszpécseri gerince) önálló
// direkt linkké lépett elő, kikerülve a korábbi "Flotta" divider mögül.
const mobileDirectLinks = [
  { to: "/admin/dashboard", icon: PiSquaresFourLight, text: "Kezdőlap" },
  { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
];

// A "Több" drawer (ld. MobileMoreDrawer.js) accordionja immár nincs "hány
// fér ki egy 390px-es sávban" kényszer alatt (ez volt az egyetlen oka a
// korábbi mobil-only Csapat+Partnerek összevonásnak és a Fuvarok-Flotta-
// divide-nek) — a mobil csoportosítás emiatt most megegyezik a desktop
// csoportosítással (Flotta/Csapat/Partnerek/Pénzügyek/Rendszerbeállítások).
// Nincs többé `divider`/`action` típusú elem: a Keresés/Sötét mód a drawer
// saját fejlécébe/fiók-sorába költözött, az Események menüpont pedig
// teljesen törölve (tartalma már a Dashboard "Mire figyeljek ma" widgetjén
// felszínre kerül).
const mobileGroups = [
  {
    key: "flotta",
    label: "Flotta",
    icon: PiTruckLight,
    items: [
      {
        to: "/admin/flottakovetes",
        icon: PiMapTrifoldLight,
        text: "Flottakövetés",
      },
      { to: "/admin/kamionok", icon: PiTruckLight, text: "Kamionok" },
      { to: "/admin/potkocsi", icon: PiTruckTrailerLight, text: "Pótkocsik" },
      { to: "/admin/furgonok", icon: PiVanLight, text: "Furgonok" },
      {
        to: "/admin/karbantartasok",
        icon: PiWrenchLight,
        text: "Karbantartások",
      },
      // Önálló, standalone route (`FuvarStatisztika.js`) — NEM azonos a
      // Fuvarok.js saját belső nézetváltójának "statisztika" fülével (ld.
      // CLAUDE.md figyelmeztetése erre a kettősségre). Ide, a Flotta
      // csoportba kerül, hogy ne kelljen egy külön, egyetlen elemű
      // csoportot nyitni a drawerben a Fuvarok-lista promóciója után.
      {
        to: "/admin/fuvarStatisztika",
        icon: PiChartBarLight,
        text: "Statisztikák",
      },
    ],
  },
  {
    key: "csapat",
    label: "Csapat",
    icon: PiUsersLight,
    items: [
      { to: "/admin/soforok", icon: PiUsersLight, text: "Sofőrök" },
      // A Sofőr-riport (`/admin/sofor-riport`) mostantól a Sofőrök oldal
      // saját "Riport" füle — nincs önálló nav-bejegyzése (ld. Soforok.js).
      {
        to: "/admin/tachograf",
        icon: PiIdentificationCardLight,
        text: "Tachográf",
      },
      {
        to: "/admin/szabadsagok",
        icon: PiCalendarBlankLight,
        text: "Szabadságok",
      },
      {
        to: "/admin/bejelentesek",
        icon: PiChatCircleTextLight,
        text: "Bejelentések",
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
    key: "penzugyek",
    label: "Pénzügyek",
    icon: PiCoinsLight,
    items: [
      { to: "/admin/koltsegek", icon: PiCoinsLight, text: "Pénzforgalom" },
      // Pénzforgalom deviza-kezelés (ld. koltsegInterface.php
      // resolveDevizaOsszeg) — admin-only, mert a devizakód nem
      // szlugosítható egy megjelenítendő névből (ISO 4217 kódnak kell
      // lennie az MNB-lekérdezéshez).
      {
        to: "/admin/devizak",
        icon: PiCoinsLight,
        text: "Devizák",
        adminOnly: true,
      },
    ],
  },
  {
    key: "rendszer",
    label: "Rendszerbeállítások",
    icon: PiFilesLight,
    items: [
      { to: "/admin/fajlok", icon: PiFilesLight, text: "Fájlok" },
      // Napló + Értesítési előzmények egyesítve — ld. Elozmenyek.js.
      {
        to: "/admin/elozmenyek",
        icon: PiListMagnifyingGlassLight,
        text: "Előzmények",
      },
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
      // A nyilvános Landing oldal ajánlatkérő/jelentkező űrlapjaiból beérkező
      // leadek listája (ld. ApiHandler ADMIN_ONLY_ACTIONS) — üzemeltetői
      // marketing-adat, nem egy adott bérlő-cég flotta-adata, ezért admin-only.
      {
        to: "/admin/ajanlatkeresek",
        icon: PiEnvelopeSimpleLight,
        text: "Ajánlatkérések",
        adminOnly: true,
      },
    ],
  },
];

// A desktop sidebar "napi zóna" (a görgethető nav-lista fölötti, mindig
// látható gyorselérési sáv) testreszabható: a felhasználó eldöntheti, mely
// menüpontok kerüljenek bele és milyen sorrendben (ld. docs/superpowers/specs/
// 2026-07-26-sidebar-napi-zona-testreszabas-design.md). A `PIN_REGISTRY` a
// meglévő `mobileGroups`-ból származik (minden valódi link-elemét átveszi),
// plusz 2, jelenleg csak desktopon élő elem kézzel hozzáfűzve — tudatosan
// egy harmadik, kézzel karbantartott nav-forrás, ugyanaz az elfogadott
// drift-kockázat, mint a mobil/desktop nav-taxonómia meglévő kettőssége (ld.
// a fájl korábbi megjegyzéseit). "Főmenü" (Dashboard) a desktop saját
// collapsible csoportjai közül egyikben sincs benne. "Fuvarok" (a
// Fuvarok-lista) a mobil navigáció újratervezése (2026-07-30) óta önálló
// bottom nav direkt link, nem `mobileGroups`-elem — enélkül a bejegyzés
// nélkül elveszne a desktop napi-zóna-szerkesztőben a pin-elhetősége (a
// desktop saját, önálló "Fuvarok" collapsible csoportja, `openGroups.fuvarok`,
// ettől függetlenül, változatlanul megmarad).
const EXTRA_PINNABLE_ITEMS = [
  {
    to: "/admin/dashboard",
    icon: PiSquaresFourLight,
    text: "Főmenü",
    group: "Áttekintés",
  },
  {
    to: "/admin/fuvarok",
    icon: PiClipboardTextLight,
    text: "Fuvarok",
    group: "Fuvarok",
  },
];

function buildPinRegistry() {
  const fromGroups = mobileGroups.flatMap((group) =>
    group.items
      .filter((item) => item.to)
      .map((item) => ({ ...item, group: group.label })),
  );
  return [...EXTRA_PINNABLE_ITEMS, ...fromGroups];
}
const PIN_REGISTRY = buildPinRegistry();

// Alapértelmezett napi zóna — a jelenlegi, korábban kódban rögzített 6 elem,
// jelenlegi sorrendben. Ez biztosítja, hogy a testreszabás bevezetése
// meglévő felhasználóknak ne változtasson semmit, amíg meg nem nyitják a
// szerkesztőt.
const DEFAULT_PIN_PATHS = [
  "/admin/dashboard",
  "/admin/karbantartasok",
  "/admin/bejelentesek",
  "/admin/koltsegek",
  "/admin/flottakovetes",
  "/admin/tachograf",
];

const TIPUS_LABEL = {
  kamion: "kamiont",
  potkocsi: "pótkocsit",
  furgon: "furgont",
};

// Mobil navigáció újratervezés (2026-07-30) — a bottom nav FAB-jának négy
// gyorsművelete. A "Karbantartás rögzítése" nem egy önálló route-ra navigál
// (nincs "/admin/karbantartasokForm" — a Karbantartasok.js az "Új
// karbantartás" létrehozást mindig egy in-page Modal-lal oldja meg), ezért
// router state-tel jelzi a szándékot; a Karbantartasok.js egy erre figyelő
// `useEffect`-tel nyitja meg automatikusan a modalt (ld. a fájl saját
// komментja).
const quickActions = (nyitottBejelentesek, kerelmek) => [
  { key: "uj-fuvar", to: "/admin/fuvarForm", icon: PiClipboardTextLight, text: "Új fuvar" },
  {
    key: "bejelentes-valasz",
    to: "/admin/bejelentesek",
    icon: PiChatCircleTextLight,
    text: "Bejelentés megválaszolása",
    badge: nyitottBejelentesek.length,
  },
  {
    key: "jarmu-valtas",
    action: "kerelmek",
    icon: PiTruckLight,
    text: "Jármű-váltás jóváhagyása",
    badge: kerelmek.length,
  },
  {
    key: "uj-karbantartas",
    to: { pathname: "/admin/karbantartasok", state: { ujKarbantartas: true } },
    icon: PiWrenchLight,
    text: "Karbantartás rögzítése",
  },
];

// A lista- és a hozzá tartozó "form" (létrehozás/szerkesztés) route neve nem
// áll substring-relációban (pl. `/admin/kamionok` vs. `/admin/kamionForm`) —
// a nyers `.includes()`-es `isActive` emiatt egyik nav-itemet sem jelölte
// aktívnak pont a form-oldalakon, ahol a leginkább kellene tudni, hol
// vagyunk (ld. UX-audit). Ez a leképezés adja vissza az adott form-route-hoz
// tartozó lista-route-ot.
const FORM_ROUTE_TO_LIST_ROUTE = {
  "/admin/kamionForm": "/admin/kamionok",
  "/admin/potkocsiForm": "/admin/potkocsi",
  "/admin/furgonForm": "/admin/furgonok",
  "/admin/soforForm": "/admin/soforok",
  "/admin/bejelentesForm": "/admin/bejelentesek",
  "/admin/ugyfelForm": "/admin/ugyfelek",
  "/admin/helyszinForm": "/admin/helyszinek",
  "/admin/fuvarForm": "/admin/fuvarok",
};

export default function Sidebar({ isDark, onToggleDark }) {
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [kerelmek, setKerelmek] = React.useState([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [pinEditorOpen, setPinEditorOpen] = React.useState(false);
  const location = useLocation();
  const history = useHistory();

  // Mobil navigáció újratervezés (2026-07-30) — long press a bottom nav
  // "Fuvarok" ikonján közvetlenül az "Új fuvar" létrehozásra ugrik, kihagyva
  // a FAB-lapot (ugyanaz a minta, mint egy iOS Home Screen "App Shortcut"-ja).
  // Rövid (< 500ms) érintés a normál Link-navigációt futtatja.
  const longPressTimerRef = React.useRef(null);
  const longPressFiredRef = React.useRef(false);

  const handleFuvarokTouchStart = () => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      history.push("/admin/fuvarForm");
    }, 500);
  };
  const handleFuvarokTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isActive = (path) => {
    if (location.pathname.includes(path)) return true;
    return FORM_ROUTE_TO_LIST_ROUTE[location.pathname] === path;
  };

  // Ctrl+K / Cmd+K globális gyorsbillentyű a kereséshez — a lenti, a lábléc
  // fölötti keresősáv "Ctrl+K" jelvénye csak ígéret lenne funkció nélkül.
  React.useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
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
    return {
      flotta: true,
      fuvarok: false,
      csapat: false,
      partnerek: false,
      penzugyek: false,
      rendszer: false,
    };
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

  // A napi zóna kitűzött elemeinek sorrendje, ugyanazzal a felhasználónkénti
  // localStorage-perzisztenciával, mint az `openGroups` fentebb. Nincs
  // mentett érték esetén (új fiók, vagy még nem nyitotta meg a szerkesztőt)
  // a `DEFAULT_PIN_PATHS` a visszaesés — ld. a fájl tetején lévő komment.
  const [pinnedPaths, setPinnedPaths] = React.useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(`sidebar-pins-${user?.id}`) || "null",
      );
      if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch (e) {
      // ignore corrupt/legacy localStorage érték
    }
    return DEFAULT_PIN_PATHS;
  });
  React.useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(
      `sidebar-pins-${user.id}`,
      JSON.stringify(pinnedPaths),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedPaths]);

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
  //
  // A Sidebar egy állandó layout-komponens, a Bejelentések oldal (ahol a
  // státusz ténylegesen változik: új bejelentés, admin válasz, törlés) egy
  // teljesen külön, útvonalon élő komponens — a kettő között nincs közös
  // állapot/prop, ezért korábban ez a szám csak egyszer, a Sidebar
  // felépülésekor töltődött be, és semmilyen későbbi változásra nem
  // frissült (csak egy teljes oldal-újratöltésre). Két, egymást kiegészítő
  // trigger oldja meg: (1) minden útvonalváltásra újratöltjük — a
  // leggyakoribb eset pont az, hogy az admin megnyitja/lezárja a
  // bejelentést, majd elnavigál onnan; (2) egy 60mp-es időzítő azt az
  // esetet fedi, amikor az admin a Bejelentések oldalon marad és több
  // tételt is megválaszol egymás után navigáció nélkül.
  const [nyitottBejelentesek, setNyitottBejelentesek] = React.useState([]);
  const loadNyitottBejelentesek = React.useCallback(() => {
    if (!user?.ceg_id) return;
    fetchAction("getNyitottBejelentesek", { id: user.ceg_id }).then(
      (result) => {
        if (result?.success) setNyitottBejelentesek(result.bejelentesek || []);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.ceg_id]);

  React.useEffect(() => {
    loadNyitottBejelentesek();
  }, [loadNyitottBejelentesek, location.pathname]);

  React.useEffect(() => {
    const intervalId = setInterval(loadNyitottBejelentesek, 60000);
    return () => clearInterval(intervalId);
  }, [loadNyitottBejelentesek]);

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
    "/admin/furgonok": "furgonok",
    "/admin/karbantartasok": "karbantartasok",
    "/admin/soforok": "soforok",
    "/admin/bejelentesek": "bejelentesek",
    "/admin/szabadsagok": "szabadsagok",
    "/admin/ugyfelek": "ugyfelek",
    "/admin/naplo": "naplo",
    "/admin/koltsegek": "koltsegek",
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
    // Mobil navigáció újratervezés (2026-07-30) — csak a jármű-váltási
    // kérelem sorokon van értelmes 2-irányú swipe (jóváhagyás/elutasítás);
    // a bejelentés-soroknak csak egy "Megnyitás" akciójuk van, azokon nincs
    // `swipeActions` (ld. NotificationDropdown.js `NotificationRow`).
    swipeActions: {
      approve: () => handleElbiral(k.id, "jovahagyva"),
      reject: () => handleElbiral(k.id, "elutasitva"),
    },
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

  // R12 (fejlesztési audit, 2026-07-19): a raw (törlés-szűrés ELŐTTI)
  // jelölt-listát naplózzuk — így egy azonnal dismisselt riasztás is
  // bekerül az előzménybe, nem csak azok, amik ténylegesen látszottak
  // valakinek. `INSERT IGNORE` a backenden (ld. ertesitesInterface.php)
  // biztosítja, hogy ugyanaz a kulcs sokszori újraküldése olcsó no-op
  // legyen, amíg a forrás-sor (kérelem/bejelentés) nyitva marad.
  React.useEffect(() => {
    if (!user?.id) return;
    const raw = [...bejelentesNotifications, ...kerelemNotifications];
    if (raw.length === 0) return;
    fetchAction("logErtesitesek", {
      kerelmezo_id: user.id,
      tetelek: raw.map((n) => ({ kulcs: n.id, szoveg: n.text })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nyitottBejelentesek, kerelmek]);

  const handleDismiss = (kulcsok) => {
    const lista = Array.isArray(kulcsok) ? kulcsok : [kulcsok];
    setToroltKulcsok((prev) => [...prev, ...lista]);
    fetchAction("torolErtesites", { kerelmezo_id: user.id, kulcsok: lista });
  };

  const handleLogout = async () => {
    const result = await fetchAction("logoutUser", { id: user?.id });
    localStorage.removeItem("user");
    localStorage.removeItem("sessionToken");
    if (!result?.success) {
      // Session already gone client-side regardless of server response.
      console.warn(result?.message || "Logout request failed.");
    }
    history.push("/");
  };

  // Jelvény-számok a kitűzött elemekhez — csak a Bejelentések menüponthoz
  // van értelmes érték, minden más kitűzött elemnél `undefined` marad (a
  // `NavItem` `badge > 0` ellenőrzése ezt már ma is csendben kezeli).
  const badgeByPath = {
    "/admin/bejelentesek": nyitottBejelentesek.length,
  };

  // A napi zóna ténylegesen renderelt elemei — a `pinnedPaths` sorrendjében,
  // a `PIN_REGISTRY`-ből feloldva. Védekező szűrés: ha egy mentett `to` már
  // nem szerepel a registryben (pl. jövőbeli route-törlés), vagy admin-only
  // elemre mutat egy időközben lefokozott felhasználónál, az adott bejegyzés
  // csendben kimarad.
  const pinnedItems = pinnedPaths
    .map((to) => PIN_REGISTRY.find((item) => item.to === to))
    .filter((item) => item && (!item.adminOnly || isAdmin));

  const NavItem = ({ to, icon: Icon, text, subPath, badge }) => {
    if (!hasAccess(to)) return null;
    const active = isActive(subPath || to);
    return (
      <li>
        <Link
          aria-current={active ? "page" : undefined}
          className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 ease-fluid ${
            active
              ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
              : "text-ink-500 hover:translate-x-0.5 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50"
          }`}
          to={to}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />
          )}
          <Icon
            className={`h-[18px] w-[18px] flex-shrink-0 ${
              active
                ? "text-brand-600 dark:text-brand-300"
                : "text-ink-400 group-hover:text-ink-600 dark:text-ink-400 dark:group-hover:text-ink-100"
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
      className="group mt-1 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-ink-800"
    >
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500 group-hover:text-ink-800 dark:text-ink-400 dark:group-hover:text-ink-50">
        {label}
      </span>
      <PiCaretDownLight
        className={`h-3.5 w-3.5 flex-shrink-0 text-ink-400 transition-all duration-200 group-hover:text-brand-600 dark:text-ink-500 dark:group-hover:text-brand-400 ${open ? "" : "-rotate-90"}`}
      />
    </button>
  );

  return (
    <>
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900 md:flex">
        {/* Fejléc — logó + név, mindig fixen fent */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <img
              src="/logo2.svg"
              alt="Szikora Transz Kft"
              className="h-8 w-auto dark:brightness-0 dark:invert"
            />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleDark}
              className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-50"
              title={isDark ? "Világos mód" : "Sötét mód"}
              aria-label={
                isDark ? "Világos mód bekapcsolása" : "Sötét mód bekapcsolása"
              }
            >
              {isDark ? (
                <PiSunLight className="h-[18px] w-[18px]" />
              ) : (
                <PiMoonLight className="h-[18px] w-[18px]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-50"
              title="Értesítések"
              aria-label="Értesítések"
            >
              <PiBellLight className="h-[18px] w-[18px]" />
              {allNotifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-white dark:ring-ink-900" />
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
          <div className="sticky top-0 z-10 mb-1 rounded-2xl bg-brand-50/70 p-2 backdrop-blur-sm dark:bg-brand-950/40">
            <div className="mb-1 flex items-center justify-between px-1.5 pb-1 pt-0.5">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-brand-700 dark:text-brand-300">
                Napi zóna
              </span>
              <button
                type="button"
                onClick={() => setPinEditorOpen(true)}
                title="Napi zóna testreszabása"
                aria-label="Napi zóna testreszabása"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-brand-700 transition-colors duration-200 hover:bg-white/10 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-ink-800 dark:hover:text-brand-300"
              >
                <PiPencilSimpleLight className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {pinnedItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  text={item.text}
                  badge={badgeByPath[item.to]}
                />
              ))}
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
                  to="/admin/furgonok"
                  icon={PiVanLight}
                  text="Furgonok"
                />
              </ul>
            )}
          </div>

          <div>
            <GroupHeader
              label="Fuvarok"
              open={openGroups.fuvarok}
              onToggle={() => toggleGroup("fuvarok")}
            />
            {openGroups.fuvarok && (
              <ul className="space-y-0.5">
                <NavItem
                  to="/admin/fuvarok"
                  icon={PiClipboardTextLight}
                  text="Fuvarok"
                />
                <NavItem
                  to="/admin/fuvarStatisztika"
                  icon={PiChartBarLight}
                  text="Statisztikák"
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
                  to="/admin/sofor-riport"
                  icon={PiChartBarLight}
                  text="Sofőr-riport"
                />
                <NavItem
                  to="/admin/tachograf"
                  icon={PiIdentificationCardLight}
                  text="Tachográf"
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

          {/* "Pénzügyek" csoport — a `PageHeader` eyebrow-mappingje (ld.
              CLAUDE.md) már korábban is ide sorolta a Pénzforgalmat, de a
              nav-fában eddig nem volt ilyen csoport: a Pénzforgalom csak a
              napi zónában élt, a Devizák pedig a Rendszer alatt bujkált,
              annak ellenére hogy fogalmilag mindkettő pénzügyi jellegű, nem
              rendszer-adminisztráció. A Pénzforgalom szándékosan MEGMARAD a
              napi zónában is (gyakran használt, egy kattintásra elérhető
              elem) — ez a csoport a teljes, kereshető hierarchiát adja meg
              hozzá, nem váltja ki a napi zóna pin-jét. */}
          <div>
            <GroupHeader
              label="Pénzügyek"
              open={openGroups.penzugyek}
              onToggle={() => toggleGroup("penzugyek")}
            />
            {openGroups.penzugyek && (
              <ul className="space-y-0.5">
                <NavItem
                  to="/admin/koltsegek"
                  icon={PiCoinsLight}
                  text="Pénzforgalom"
                />
                {isAdmin && (
                  <NavItem
                    to="/admin/devizak"
                    icon={PiCoinsLight}
                    text="Devizák"
                  />
                )}
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
                  to="/admin/ertesitesi-elozmenyek"
                  icon={PiBellLight}
                  text="Értesítési előzmények"
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
                      className="mx-3.5 my-1.5 border-t border-ink-100 dark:border-ink-800"
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
                    <NavItem
                      to="/admin/ajanlatkeresek"
                      icon={PiEnvelopeSimpleLight}
                      text="Ajánlatkérések"
                    />
                  </>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Piaci árak (EUR/USD árfolyam + benzinár) — a görgethető
            nav-listától ELKÜLÖNÜLVE, saját `flex-shrink-0` sávban, közvetlen
            a lábléc fölött, hogy görgetéstől függetlenül mindig látszódjon
            (a felhasználó kifejezett kérése: "mindig könnyen elérhető, de
            ne zavarja a fő tartalom használatát"). Az egész `<nav>` maga
            `hidden md:flex` (ld. lentebb), tehát ez a panel eleve csak
            asztali nézetben renderelődik — mobilon nincs is a DOM-ban,
            nem csak vizuálisan van elrejtve. */}
        <PiaciArakPanel />

        {/* Keresősáv — korábban egy ikon-gomb volt a fejlécben; most egy
            tényleges, mindig látható mező, a "Ctrl+K" jelvénnyel jelezve a
            gyorsbillentyűt (ld. fent a globális keydown-listener). Ugyanazt
            a `GlobalSearch` overlay-t nyitja, mint korábban a fejléc-gomb. */}
        <div className="flex-shrink-0 border-t border-ink-100 px-3 py-2.5 dark:border-ink-800">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-ink-100 bg-slate-50 px-3 py-2 text-left text-ink-400 transition-colors duration-200 hover:border-brand-200 hover:bg-white dark:border-ink-700 dark:bg-ink-800 dark:hover:border-brand-700 dark:hover:bg-ink-800"
          >
            <PiMagnifyingGlassLight className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate text-sm">Keresés</span>
            <span className="flex-shrink-0 rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-400 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-400">
              Ctrl+K
            </span>
          </button>
        </div>

        {/* Lábléc — fiók + kijelentkezés, mindig fixen lent és mindig látszik.
            A fiók-sor most a saját profil (Saját adatok) linkje is egyben —
            korábban ez egy külön "Saját adatok" menüpont volt fent a
            "Saját adatok" gyűjtő szekcióban, ami vegyítette a személyes
            beállítást a csapat-/admin-eszközökkel; a fogaskerék-ikon jelzi,
            hogy a sor kattintható. */}
        <div className="flex-shrink-0 border-t border-ink-100 px-4 py-4 dark:border-ink-800">
          <Link
            to="/admin/settings"
            className="group -mx-1 mb-3 flex items-center gap-2.5 rounded-xl px-1 py-1.5 transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white shadow-inner-hairline">
              {initials(user?.name || user?.nev)}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold leading-tight text-brand-900 dark:text-ink-50">
                {user?.name || user?.nev || "Fiók"}
              </span>
              <span className="block truncate text-xs leading-tight text-ink-400 dark:text-ink-500">
                {szerepkorNev}
              </span>
            </span>
            <PiGearLight className="h-4 w-4 flex-shrink-0 text-ink-300 transition-colors duration-200 group-hover:text-ink-500 dark:text-ink-500 dark:group-hover:text-ink-300" />
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors duration-200 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <PiSignOutLight className="h-4 w-4" />
            Kijelentkezés
          </button>
        </div>
      </nav>

      {/* Mobil alsó navigáció — 5 slot + FAB (mobil navigáció újratervezés,
          2026-07-30, ld. docs/superpowers/specs/2026-07-30-mobil-navigacio-
          ujratervezes-design.md): Kezdőlap, Fuvarok, ➕ Gyors műveletek,
          Értesítések, Több. A korábbi csoport-fülek + bottom-sheet minta
          teljesen megszűnt — a QuickActionSheet (FAB-lap) és a
          MobileMoreDrawer (teljes képernyős "Több" fiók) váltja fel. */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <QuickActionSheet
          open={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
          actions={quickActions(nyitottBejelentesek, kerelmek)}
          onKerelmekClick={() => setNotifOpen(true)}
        />

        <nav className="flex items-stretch gap-1 border-t border-ink-100 bg-white px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] dark:border-ink-800 dark:bg-ink-900">
          {mobileDirectLinks.map((item) => {
            const active = isActive(item.to);
            const isFuvarok = item.to === "/admin/fuvarok";
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
                  active
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                    : "text-ink-400 dark:text-ink-500"
                }`}
                onClick={(e) => {
                  if (isFuvarok && longPressFiredRef.current) {
                    e.preventDefault();
                    longPressFiredRef.current = false;
                    return;
                  }
                  setQuickActionsOpen(false);
                }}
                onTouchStart={isFuvarok ? handleFuvarokTouchStart : undefined}
                onTouchEnd={isFuvarok ? handleFuvarokTouchEnd : undefined}
                onTouchMove={isFuvarok ? handleFuvarokTouchEnd : undefined}
              >
                <item.icon className="h-6 w-6 flex-shrink-0" />
                <span className="w-full truncate text-center">{item.text}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Gyors műveletek"
            aria-expanded={quickActionsOpen}
            onClick={() => setQuickActionsOpen((v) => !v)}
            className={`relative -mt-5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full shadow-soft-lg transition-colors duration-150 ${
              quickActionsOpen ? "bg-brand-700 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            <PiPlusLight className="h-6 w-6" />
            {nyitottBejelentesek.length + kerelmek.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
                {nyitottBejelentesek.length + kerelmek.length}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-expanded={notifOpen}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
              notifOpen
                ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                : "text-ink-400 dark:text-ink-500"
            }`}
            onClick={() => {
              setQuickActionsOpen(false);
              setNotifOpen(true);
            }}
          >
            <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
              <PiBellLight className="h-6 w-6" />
              {allNotifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-white dark:ring-ink-900" />
              )}
            </span>
            <span className="w-full truncate text-center">Értesítések</span>
          </button>

          <button
            type="button"
            aria-expanded={drawerOpen}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
              drawerOpen
                ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                : "text-ink-400 dark:text-ink-500"
            }`}
            onClick={() => {
              setQuickActionsOpen(false);
              setDrawerOpen(true);
            }}
          >
            <PiListLight className="h-6 w-6" />
            <span className="w-full truncate text-center">Több</span>
          </button>
        </nav>
      </div>

      <MobileMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSearchOpen={() => setSearchOpen(true)}
        pinnedItems={pinnedItems}
        badgeByPath={badgeByPath}
        groups={mobileGroups}
        isAdmin={isAdmin}
        hasAccess={hasAccess}
        isActive={isActive}
        user={user}
        szerepkorNev={szerepkorNev}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleDark={onToggleDark}
      />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationDropdown
        notifications={allNotifications}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismiss}
      />
      <NapiZonaEditorModal
        open={pinEditorOpen}
        onClose={() => setPinEditorOpen(false)}
        registry={PIN_REGISTRY}
        pinnedPaths={pinnedPaths}
        onChange={setPinnedPaths}
        maxItems={8}
        isAdmin={isAdmin}
        defaultPaths={DEFAULT_PIN_PATHS}
      />
    </>
  );
}
