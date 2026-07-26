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
  PiFileTextLight,
  PiClipboardTextLight,
  PiPencilSimpleLight,
} from "react-icons/pi";

import NotificationDropdown from "components/Dropdowns/NotificationDropdown.js";
import GlobalSearch from "components/UI/GlobalSearch.js";
import PiaciArakPanel from "components/Sidebar/PiaciArakPanel.js";
import NapiZonaEditorModal from "components/Sidebar/NapiZonaEditorModal.js";
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
  { to: "/admin/settings", icon: PiGearLight, text: "Profil" },
];

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
      { to: "/admin/koltsegek", icon: PiCoinsLight, text: "Pénzforgalom" },
    ],
  },
  {
    key: "fuvarok",
    label: "Fuvarok",
    icon: PiClipboardTextLight,
    items: [
      {
        to: "/admin/beerkezettDokumentumok",
        icon: PiFileTextLight,
        text: "Beérkezett dokumentumok",
      },
      { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
      { to: "/admin/fuvarStatisztika", icon: PiChartBarLight, text: "Statisztikák" },
    ],
  },
  // Csapat + Partnerek EGY mobil fülbe összevonva (divider-rel elválasztva) —
  // a deszktop sidebaron ez a két csoport külön marad (ott bőven van hely,
  // és tartalmilag a Partnerek külső fél, nem a cég saját csapata, ld. a
  // fájl tetején lévő komment), de a mobil alsó sáv 8 oszlopa túl zsúfolt
  // volt (felhasználói visszajelzés + élő teszt: a feliratok csonkolódtak).
  // Ez a mobil-only összevonás nem változtatja meg a tartalmi jelentést —
  // csak egy fület spórol a szűkös, ~390px-es sávon.
  {
    key: "csapat",
    label: "Csapat",
    icon: PiUsersLight,
    items: [
      { to: "/admin/soforok", icon: PiUsersLight, text: "Sofőrök" },
      {
        to: "/admin/sofor-riport",
        icon: PiChartBarLight,
        text: "Sofőr-riport",
      },
      {
        to: "/admin/tachograf",
        icon: PiIdentificationCardLight,
        text: "Tachográf",
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
      { type: "divider", label: "Partnerek" },
      { to: "/admin/ugyfelek", icon: PiBuildingsLight, text: "Ügyfelek" },
      { to: "/admin/helyszinek", icon: PiMapPinLight, text: "Helyszínek" },
    ],
  },
  {
    key: "rendszer",
    label: "Rendszer",
    icon: PiFilesLight,
    items: [
      // UX-audit — a Ctrl+K globális keresésnek és a sötét mód kapcsolónak
      // korábban NEM volt mobil belépési pontja (mindkettő kizárólag a
      // desktop-only sidebar-sávban élt). `type: "action"` — nem navigáló,
      // hanem egy komponens-szintű handlert hívó elem (ld. a render-ágat
      // lentebb); a `mobileGroups` tömb modul-szinten, a komponensen kívül
      // van deklarálva, ezért az ikon/felirat a sötét módnál dinamikusan,
      // render közben dől el, nem itt van "beégetve".
      {
        type: "action",
        action: "search",
        icon: PiMagnifyingGlassLight,
        text: "Keresés",
      },
      {
        type: "action",
        action: "darkmode",
        icon: PiMoonLight,
        text: "Sötét mód",
      },
      { to: "/admin/fajlok", icon: PiFilesLight, text: "Fájlok" },
      { to: "/admin/naplo", icon: PiListMagnifyingGlassLight, text: "Napló" },
      {
        to: "/admin/ertesitesi-elozmenyek",
        icon: PiBellLight,
        text: "Értesítési előzmények",
      },
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
      // Pénzforgalom deviza-kezelés (ld. koltsegInterface.php
      // resolveDevizaOsszeg) — ugyanaz az admin-only listaelemek-minta,
      // mint a Listák, csak saját, dedikált oldalon (Devizak.js), mert a
      // devizakód nem szlugosítható egy megjelenítendő névből (ISO 4217
      // kódnak kell lennie az MNB-lekérdezéshez).
      {
        to: "/admin/devizak",
        icon: PiCoinsLight,
        text: "Devizák",
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
// meglévő `mobileGroups`-ból származik (minden valódi link-elemét átveszi,
// dividerek/action-ök nélkül), plusz 1 jelenleg csak desktopon élő elem
// (Főmenü) kézzel hozzáfűzve — tudatosan egy harmadik, kézzel
// karbantartott nav-forrás, ugyanaz az elfogadott drift-kockázat, mint a
// mobil/desktop nav-taxonómia meglévő kettőssége (ld. a fájl korábbi
// megjegyzéseit). A Devizák már létezik a mobileGroups-ban (Rendszer
// csoport), az ő desktop kategória-besorolása (Pénzügyek) a GROUP_LABEL_OVERRIDES
// kezeli, nem egy duplikált EXTRA_PINNABLE_ITEMS bejegyzés.
const EXTRA_PINNABLE_ITEMS = [
  {
    to: "/admin/dashboard",
    icon: PiSquaresFourLight,
    text: "Főmenü",
    group: "Áttekintés",
  },
];

// A mobil "Csapat" fül a Partnereket (Ügyfelek/Helyszínek) egy divider mögé
// rejti a saját fülébe, és a Pénzforgalom a mobil "Flotta" fülben él — a
// desktop taxonómia viszont ezeket külön ("Partnerek", "Pénzügyek")
// csoportba sorolja. Ez a felülírások igazítják a napi zóna szerkesztő
// kategória-címkéit a desktop hierarchiához, hogy ne egy mobil-only
// csoportosítás látszódjon a picker-ben. A Devizák a mobileGroups-ban
// a Rendszer csoportban él, de desktop kontextusban a Pénzügyek csoportba
// tartozik (ahol a Pénzforgalom is él).
const GROUP_LABEL_OVERRIDES = {
  "/admin/koltsegek": "Pénzügyek",
  "/admin/devizak": "Pénzügyek",
};

function buildPinRegistry() {
  const fromGroups = mobileGroups.flatMap((group) => {
    let currentLabel = group.label;
    return group.items
      .map((item) => {
        if (item.type === "divider") {
          currentLabel = item.label;
          return null;
        }
        if (!item.to) return null;
        return {
          ...item,
          group: GROUP_LABEL_OVERRIDES[item.to] || currentLabel,
        };
      })
      .filter(Boolean);
  });
  return [...EXTRA_PINNABLE_ITEMS, ...fromGroups];
}
// eslint-disable-next-line no-unused-vars
const PIN_REGISTRY = buildPinRegistry();

// Alapértelmezett napi zóna — a jelenlegi, korábban kódban rögzített 6 elem,
// jelenlegi sorrendben. Ez biztosítja, hogy a testreszabás bevezetése
// meglévő felhasználóknak ne változtasson semmit, amíg meg nem nyitják a
// szerkesztőt.
// eslint-disable-next-line no-unused-vars
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
};

export default function Sidebar({ isDark, onToggleDark }) {
  const [openGroup, setOpenGroup] = React.useState(null);
  const [kerelmek, setKerelmek] = React.useState([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [pinEditorOpen, setPinEditorOpen] = React.useState(false);
  const location = useLocation();
  const history = useHistory();

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

  // Feldolgozásra váró Beérkezett dokumentumok darabszáma — ugyanaz a
  // route-change + 60s poll minta, mint a Bejelentések unread-badge-nél
  // fentebb, hogy az admin ne felejtse el megnézni az inboxot.
  const [beerkezettDokSzam, setBeerkezettDokSzam] = React.useState(0);
  const loadBeerkezettDokSzam = React.useCallback(() => {
    if (!user?.ceg_id) return;
    fetchAction("getBeerkezettDokumentumokSzama", { ceg_id: user.ceg_id }).then(
      (result) => {
        if (result?.success) setBeerkezettDokSzam(result.szam);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.ceg_id]);

  React.useEffect(() => {
    loadBeerkezettDokSzam();
  }, [loadBeerkezettDokSzam, location.pathname]);

  React.useEffect(() => {
    const intervalId = setInterval(loadBeerkezettDokSzam, 60000);
    return () => clearInterval(intervalId);
  }, [loadBeerkezettDokSzam]);

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

  // Jelvény-számok a kitűzött elemekhez — csak a két, ma is jelvényezett
  // menüponthoz (Bejelentések, Beérkezett dokumentumok) van értelmes érték,
  // minden más kitűzött elemnél `undefined` marad (a `NavItem` `badge > 0`
  // ellenőrzése ezt már ma is csendben kezeli).
  const badgeByPath = {
    "/admin/bejelentesek": nyitottBejelentesek.length,
    "/admin/beerkezettDokumentumok": beerkezettDokSzam,
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
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-700/70 dark:text-brand-300/70">
                Napi zóna
              </span>
              <button
                type="button"
                onClick={() => setPinEditorOpen(true)}
                title="Napi zóna testreszabása"
                aria-label="Napi zóna testreszabása"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-brand-700/60 transition-colors duration-200 hover:bg-white/60 hover:text-brand-700 dark:text-brand-300/60 dark:hover:bg-ink-800/60 dark:hover:text-brand-300"
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
                  to="/admin/beerkezettDokumentumok"
                  icon={PiFileTextLight}
                  text="Beérkezett dokumentumok"
                  badge={beerkezettDokSzam}
                />
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
          className={`overflow-y-auto rounded-t-2xl border-t border-ink-100 bg-white shadow-soft-lg transition-all duration-300 ease-fluid dark:border-ink-800 dark:bg-ink-900 ${
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
                      item.type === "action" ||
                      ((!item.adminOnly || isAdmin) && hasAccess(item.to)),
                  )
                  .map((item, i) => {
                    if (item.type === "divider") {
                      return (
                        <li
                          key={`divider-${item.label}`}
                          className={`px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500 ${
                            i === 0 ? "pt-1" : "pt-3"
                          }`}
                        >
                          {item.label}
                        </li>
                      );
                    }
                    if (item.type === "action") {
                      const isDarkmode = item.action === "darkmode";
                      const ActionIcon = isDarkmode
                        ? isDark
                          ? PiSunLight
                          : PiMoonLight
                        : item.icon;
                      const actionLabel = isDarkmode
                        ? isDark
                          ? "Világos mód"
                          : "Sötét mód"
                        : item.text;
                      return (
                        <li key={`action-${item.action}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenGroup(null);
                              if (item.action === "search") setSearchOpen(true);
                              if (item.action === "darkmode") onToggleDark();
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
                          >
                            <ActionIcon className="h-[18px] w-[18px] flex-shrink-0" />
                            {actionLabel}
                          </button>
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
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                              : "text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
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
        {/* Egységesített fül-stílus: 2 közvetlen link + 3 csoport (Flotta,
            Csapat+Partnerek összevonva, Rendszer) + Értesítések = 6 azonos
            méretű/stílusú fül — a korábbi 8 (köztük egy szűk ikon-only
            Kijelentkezés-oszlop) helyett. Az aktív fül most egy tényleges
            háttér-jelvényt (pill) kap a puszta színváltás helyett, hogy
            gyorsabban, egy pillantásból elváljon az inaktívaktól; az ikonok
            kicsit nagyobbak (h-6), mert a kevesebb oszlopnak több hely jut.
            A Kijelentkezés a Profil oldal saját tartalmi eleme lett (ld.
            Settings.js) — a napi navigációtól elválasztva, mint a legtöbb
            mobil appban. */}
        <nav className="flex items-stretch gap-1 border-t border-ink-100 bg-white px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] dark:border-ink-800 dark:bg-ink-900">
          {mobileDirectLinks.map((item) => {
            const active = isActive(item.to);
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
                onClick={() => setOpenGroup(null)}
              >
                <item.icon className="h-6 w-6 flex-shrink-0" />
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
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
                  active
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                    : "text-ink-400 dark:text-ink-500"
                }`}
                onClick={() =>
                  setOpenGroup(openGroup === group.key ? null : group.key)
                }
              >
                <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
                  <group.icon className="h-6 w-6" />
                  {showBadge && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-ink-900" />
                  )}
                </span>
                <span className="w-full truncate text-center">
                  {group.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
              notifOpen
                ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                : "text-ink-400 dark:text-ink-500"
            }`}
            onClick={() => setNotifOpen(true)}
          >
            <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
              <PiBellLight className="h-6 w-6" />
              {allNotifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-white dark:ring-ink-900" />
              )}
            </span>
            <span className="w-full truncate text-center">Értesítések</span>
          </button>
        </nav>
      </div>

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
