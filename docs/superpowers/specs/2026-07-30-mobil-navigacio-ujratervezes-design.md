# Mobil navigáció újratervezése (admin felület) — design

## Cél

Az admin mobil alsó navigáció (`src/components/Sidebar/Sidebar.js`, `mobileDirectLinks`/`mobileGroups`) ma egy hat egyenrangú fülből álló sáv (Menü, Profil, Flotta, Csapat, Rendszer, Értesítések), amit szervezeti/földrajzi logika (Flotta/Csapat/Rendszer) szervez, nem a tényleges napi/heti/ritka használati gyakoriság. Ennek tünetei: a rendszer napi diszpécseri gerince (Fuvarok, a 2026-07-28-i fuvar-first átállás óta) egy 9-elemű "Flotta" mellékfülbe van olvasztva; nincs önálló "gyors létrehozás" mechanizmus (egy Új fuvarhoz mindig a célmodulba kell navigálni); a "Rendszer" fül 11, egymáshoz nem illő elemet zsúfol egy listába (napi Fájlok, admin-only Jogosultságok/Listák/Devizák/Ajánlatkérések, egy keresés-akció, egy sötét mód kapcsoló). A cél egy frekvencia-alapú (napi/heti/ritka), gyors-létrehozást és keresést elsődlegesnek tekintő szerkezet, ami a lehető legtöbb meglévő, karbantartott infrastruktúrát (napi zóna pin-rendszer, `GroupHeader` lenyitható-csoport minta, `Modal.js` mobil-branch, jelvény-logika) újrahasznosítja.

Ez egy **tisztán frontend, csak-mobil** munka — a desktop sidebar (`<nav className="... hidden w-64 flex-col ... md:flex">`) vizuálisan és funkcionálisan változatlan marad, nincs új backend action, minden felhasznált adat (`nyitottBejelentesek`, `kerelmek`, `getSajatJogosultsagok` stb.) már ma is létezik és be van kötve.

## Hatókör

- **Csak** `src/components/Sidebar/Sidebar.js` mobil render-ága (a `md:hidden` rész) + az abból kiszervezett új komponensek + két apró, más fájlt érintő kiegészítés (Dashboard gyorschip, `NotificationDropdown.js` swipe). A desktop `<nav>` JSX-e (fejléc, napi zóna doboz, összecsukható csoportok, lábléc) **egy karakternyit sem változik**.
- A `PIN_REGISTRY`/`DEFAULT_PIN_PATHS`/`NapiZonaEditorModal.js` (napi zóna testreszabás, ld. `2026-07-26-sidebar-napi-zona-testreszabas-design.md`) infrastruktúrája **újrahasznosítva**, nem lecserélve — a mobil "Kedvencek" sáv ugyanazt a `pinnedPaths` state-et olvassa, amit ma a desktop napi zóna.
- A `mobileGroups` tömb tartalma átrendeződik (ld. lentebb), de a `GroupHeader`/lenyitható-csoport **mintája** (nem kódja — külön render-ág marad, mint ma) újrafelhasznált a mobil drawerben is.
- **Nem cél** a desktop és mobil nav-taxonómia egyetlen közös konfigurációba való összevonása (a jelenlegi három, kézzel karbantartott nav-forrás — mobil `mobileGroups`, hardcoded desktop JSX, `PIN_REGISTRY` — driftkockázata továbbra is fennáll, ld. meglévő komment a fájl tetején). Ez a redesign viszont **megszünteti az egyik okát**, amiért a mobil taxonómia eddig eltért a desktopétól (ld. "mobileGroups tartalom-átrendezés" lentebb) — ha ez a tapasztalat alapján később megéri, egy külön körben érdemes lehet visszatérni a teljes egyesítésre.
- **Nem cél** a sofőr-oldali (`layouts/User.js`) navigáció módosítása.

## 1. Bottom nav — 5 slot + FAB

A mai `mobileDirectLinks` (2 elem) + `mobileGroups.map` (3 gomb) + Bell gomb (6 elem összesen) helyett:

```js
const mobileDirectLinks = [
  { to: "/admin/dashboard", icon: PiSquaresFourLight, text: "Kezdőlap" },
  { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
];
```

- **Profil eltávolítva** a bottom nav közvetlen linkjei közül — a fiók-sor (avatar, név, szerepkör, kijelentkezés, sötét mód kapcsoló) a "Több" drawer fejlécébe költözik (ld. 3. pont), ugyanaz a minta, mint Gmail/Slack avatarja a hamburger-menüben.
- **Fuvarok promótálva** direkt linkké — kikerül a `mobileGroups.flotta` divider mögül.
- A render-sorrend a sávban: `mobileDirectLinks` (Kezdőlap, Fuvarok) → **FAB** (középre emelt, ld. 2. pont) → Bell (Értesítések) → "Több" gomb (ld. 3. pont, felváltja a mai `mobileGroups.map`-ből generált csoport-fület renderelő ágat).
- FAB CSS-pozíció: a sáv 3. slotja, de `-translate-y-3` + nagyobb (`h-14 w-14`) kör, `bg-accent`-stílusú (a projekt `brand` tokenje) kitöltött háttérrel, hogy vizuálisan kiemelkedjen a sor többi, lapos ikonja közül — ugyanaz a konvenció, mint egy natív iOS/Android tab bar FAB-ja.

## 2. Gyors műveletek lap (FAB)

Új fájl: `src/components/Sidebar/QuickActionSheet.js`. A `Modal.js` mobil-branchének mintáját követi (in-flow kártya, nem klasszikus `fixed` overlay — ld. CLAUDE.md "Mobil forms (no popup)"), de mivel ezt egy bottom nav gomb nyitja, nem egy formoldal természetes DOM-helyén, a legegyszerűbb megvalósítás egy **saját, könnyű bottom-sheet**: `fixed inset-x-0 bottom-0` konténer, háttér-elhalványítás (`fixed inset-0 bg-ink-950/30`, kattintásra bezár — pontosan az a minta, ami ma is él a `mobileGroups` csoport-fülek felnyitásánál, `openGroup`/háttér-`<div>`), `max-h-0`→`max-h-*` átmenet.

Tartalma, statikus lista + a Sidebar-ban már ma is számolt jelvényekkel:

```js
const quickActions = (nyitottBejelentesek, kerelmek) => [
  { to: "/admin/fuvarForm", icon: PiClipboardTextLight, text: "Új fuvar" },
  {
    to: "/admin/bejelentesek",
    icon: PiChatCircleTextLight,
    text: "Bejelentés megválaszolása",
    badge: nyitottBejelentesek.length,
  },
  {
    action: "kerelmek", // megnyitja a Bell-panelt a jármű-váltási kérelmekre szűrve
    icon: PiTruckLight,
    text: "Jármű-váltás jóváhagyása",
    badge: kerelmek.length,
  },
  {
    // Nincs önálló "/admin/karbantartasokForm" route — a Karbantartasok.js
    // a létrehozást egy in-page Modal-lal old meg (`openDialog` state,
    // ld. CLAUDE.md "Mobil forms (no popup)"). A gyorsművelet ezért router
    // state-tel navigál, a célooldal nyitja meg a modalt betöltéskor
    // (ld. "Karbantartás gyorsművelet — router state" alpont lentebb).
    to: { pathname: "/admin/karbantartasok", state: { ujKarbantartas: true } },
    icon: PiWrenchLight,
    text: "Karbantartás rögzítése",
  },
];
```

- A "Jármű-váltás jóváhagyása" sor nem egy route-ra navigál, hanem ugyanazt a `notifOpen`/`NotificationDropdown` állapotot nyitja meg, amit a Bell gomb — nincs duplikált jóváhagyó UI, csak egy második belépési pont ugyanahhoz.
- **Karbantartás gyorsművelet — router state**: `Karbantartasok.js` (`openDialog`/`editingId`/`resetForm()` state, ld. a fájl 70-71. és 672-675. sora) kap egy `useLocation()` alapú `useEffect`-et, ami `location.state?.ujKarbantartas === true` esetén lefuttatja ugyanazt a két hívást, amit a "+ Új" gomb (`resetForm(); setOpenDialog(true);`), majd `history.replace(location.pathname)`-mel törli a state-et (hogy egy vissza-navigáció ne nyissa meg újra a modalt).
- 0 jelvényszám esetén a sor NEM tűnik el (mindig elérhető gyorsművelet marad), csak a jelvény nem renderelődik (`badge > 0` ellenőrzés, ugyanaz a minta, mint a `NavItem`-ben).
- A FAB gombon egy összesített jelvény (`nyitottBejelentesek.length + kerelmek.length`, ha > 0) jelzi, hogy van cselekvést igénylő tétel a lapon belül — vizuálisan ugyanaz a piros pötty-konvenció, mint a Bell gombon.

## 3. "Több" drawer

Új fájl: `src/components/Sidebar/MobileMoreDrawer.js`. Teljes képernyős, `fixed inset-0 z-50 bg-white dark:bg-ink-900` panel (nem bottom-sheet, mert a tartalma — kereső, kedvencek, 5 lenyitható csoport, fiók-sor — egy rövid sheetnél hosszabb), balra csúszó/fedő animációval (`translate-x-full` → `translate-x-0`), egy "← Több" fejléccel a bezáráshoz.

Felépítés, felülről lefelé:

1. **Fejléc**: "← Több" (bezár gomb).
2. **Keresőmező** — szó szerint a desktop `Sidebar.js` 972–984. sorában már létező keresősáv-markup (gomb + "Ctrl+K" jelvény helyett itt "Keresés" felirat, `onClick={() => { setDrawerOpen(false); setSearchOpen(true); }}`) átemelve. Nem új komponens, ugyanaz a `GlobalSearch` overlay nyílik.
3. **Kedvencek** — a meglévő `pinnedItems`/`PIN_REGISTRY` state újrarenderelve, ugyanazzal a `NavItem`-mintával, amit ma a desktop napi zóna doboz használ. Nincs plusz logika: a `pinnedItems`-et számoló kód a `Sidebar` komponensben már létezik, a drawer csak propként kapja meg.
4. **5 lenyitható csoport** (Flotta, Csapat, Partnerek, Pénzügyek, Rendszerbeállítások) — ugyanaz a `GroupHeader` accordion-minta, amit a desktop `<nav>` már használ (`openGroups`/`toggleGroup`), a mobil `mobileGroups` (ld. 4. pont) tartalmán iterálva.
5. **Fiók-sor** legalul: avatar + név + szerepkör + ⚙ (Profil link) + 🌙/☀ (sötét mód kapcsoló, `onToggleDark` prop) + Kijelentkezés — a desktop lábléc két blokkjának (fiók-link + kijelentkezés gomb) mobil megfelelője, ugyanazok a propok/handlerek (`user`, `szerepkorNev`, `handleLogout`, `isDark`, `onToggleDark`).

A drawer nyitott/zárt állapotát a `Sidebar` komponens saját `drawerOpen` state-je vezérli (a mai `openGroup` state-et leváltja — a régi bottom-sheet render-ág és az `openGroup`/`setOpenGroup` teljes egésze törlődik).

## 4. `mobileGroups` tartalom-átrendezés

A drawer accordionja immár nincs "hány fér ki egy 390px-es sávban" kényszer alatt (ez volt az egyetlen oka a jelenlegi mobil-only Csapat+Partnerek összevonásnak és a Fuvarok-Flotta-divider-nek — ld. a fájl tetején lévő komment a 2026-07-30-i 8→6 fül összevonásról). Emiatt a mobil csoportosítás most **megegyezhet** a desktop csoportosítással, a kényszerű mobil-only mergek megszűnnek:

| Csoport | Tartalom (régi → új) |
|---|---|
| `flotta` | Flottakövetés, Kamionok, Pótkocsi, Furgonok, Karbantartások, **Statisztikák** (`/admin/fuvarStatisztika`, `FuvarStatisztika.js`) — **Pénzforgalom kikerül** (ld. `penzugyek`), **Fuvarok-lista kikerül** (bottom nav direkt link). A "Statisztikák" tétel EGY ÖNÁLLÓ, standalone route — **nem azonos** a `Fuvarok.js` saját belső `nézetMód`-jának `"statisztika"` fülével (ld. CLAUDE.md explicit figyelmeztetése erre a kettősségre) —, thematikusan a Flotta csoportba illesztve, hogy ne kelljen egy külön, egyetlen elemű csoportot nyitni a drawerben (marad 5 lenyitható csoport, ld. 3. pont) |
| `csapat` | Sofőrök, Tachográf, Szabadságok, Bejelentések (a teljes lista böngészéséhez — a bell/FAB csak a *nyitott* tételekre mutat gyorsutat) — **Sofőr-riport kikerül** (Sofőrök képernyő saját fülébe olvad, ld. 5. pont) |
| `partnerek` | Ügyfelek, Helyszínek — **önálló csoport**, nem a Csapat divider mögé rejtve |
| `penzugyek` | Pénzforgalom, Devizák (admin) — **új mobil csoport**, eddig a Pénzforgalom a `flotta`-ban, a Devizák a `rendszer`-ben élt |
| `rendszer` | Fájlok, Előzmények (Napló+Értesítési előzmények egyesítve, ld. 5. pont), Felhasználók, Jogosultságok (admin), Listák (admin), Ajánlatkérések (admin) — **Keresés és Sötét mód akció-elemek kikerülnek** (ld. 2-3. pont), **Események kikerül** (ld. 6. pont) |

Következmény: a `GROUP_LABEL_OVERRIDES` konstans (ami eddig azért kellett, mert a mobil `Devizák`/`Pénzforgalom` máshol élt, mint a desktop napi-zóna-picker csoportcímkéje) **törölhető** — a `penzugyek` mobil csoport `label`-je már eleve "Pénzügyek", nincs mit felülírni.

`EXTRA_PINNABLE_ITEMS`-hez hozzáadandó egy "Fuvarok" bejegyzés (`group: "Fuvarok"`) — mivel a Fuvarok-lista kikerül a `mobileGroups`-ból (a `PIN_REGISTRY`-t ez flatMap-eli), a desktop napi-zóna-szerkesztőben enélkül elveszne a Fuvarok-lista pin-elhetőségi lehetősége (a desktop saját, önálló "Fuvarok" collapsible csoportja, `openGroups.fuvarok`, ettől függetlenül, **változatlanul** megmarad — ez csak a pin-registry teljességét érinti). A "Statisztikák" pin-elhetősége nem igényel plusz `EXTRA_PINNABLE_ITEMS` bejegyzést, mert a `flotta` mobil csoport része, onnan már automatikusan levezetődik.

## 5. Képernyő-összevonások

- **Sofőrök + Sofőr-riport** → `src/views/admin/Soforok.js` kap egy belső tab-váltót ("Lista" / "Riport"), ugyanazzal a mintával, mint a `Koltsegek.js` fül-váltása. `/admin/sofor-riport` route megmarad (nem törlődik, csak a nav-regisztrációkból tűnik el), hogy meglévő mélylinkek/könyvjelzők ne törjenek — belépéskor a "Riport" fület aktiválja.
- **Napló + Értesítési előzmények** → új `src/views/admin/Elozmenyek.js`, két belső fül (`NaploTab`/`ErtesitesekTab`), mindkét meglévő lekérdezés (`getNaplo`, `getErtesitesiElozmenyek`) változatlanul, csak közös oldal-keretben. `/admin/naplo` és `/admin/ertesitesi-elozmenyek` route-ok megmaradnak (redirect vagy közvetlen fül-preszelekció), a nav-regisztrációkból egy "Előzmények" bejegyzés marad mindkettő helyett.
- **Ügyfelek + Helyszínek** — **MVP-ben nincs kódösszevonás**, csak a drawer `partnerek` csoportján belül egymás alatt jelennek meg (ld. táblázat fent) — ez már ma is a `mobileGroups` egy divider-rel elválasztott al-szekciója volt, most önálló csoportcímmel. Teljes, egy-képernyős tab-összevonás explicit jövőbeli követő munka, ha a tényleges használat indokolja.

## 6. Események eltávolítása + Dashboard gyorschip

- `/admin/esemenyek` bejegyzés törlődik a `mobileGroups.rendszer`-ből. Tartalma (lejáró határidők) már ma is felszínre kerül a Dashboard "Teendők"/"Mire figyeljek ma" widgetjén.
  - **Pontosítás a korábbi tervezői artifacthoz képest**: a `GlobalSearch.js` (`globalSearch` backend action) egy **entitás-kereső** — kamion/pótkocsi/furgon/sofőr/ügyfél/helyszín/fuvar rekordokra keres név/rendszám alapján (ld. `TIPUS_ICON` map a komponensben), **nem egy oldal-/route-kereső**. Az "Események" (vagy bármely más nav-célpont neve) beírása a keresőbe emiatt **nem** ad találatot — ez nem egy "csak kereséssel elérhető" funkció, hanem ténylegesen **eltávolított** menüpont mobilon (asztali nézetben, ahol nincs slot-kényszer, továbbra is elérhető marad, ha valaki ott keresi — de ez a redesign kizárólag a mobil ágat érinti). Ugyanez a pontosítás vonatkozik minden más "ritka" elemre (Jogosultságok, Listák stb.) — ezek elérési útja mobilon kizárólag a "Rendszerbeállítások" drawer-csoport, nem a keresőmező.
- **Flottakövetés Dashboard-gyorschip**: `src/views/admin/Dashboard.js`-ben a "Mire figyeljek ma" + naptár blokk és a `FlottaOsszesitoStrip` közé kerül egy új, `md:hidden` (kizárólag mobil), teljes szélességű, kattintható sáv/gomb (vizuálisan a `PenzugyiAllapotCard` gomb-kártya mintáját követve: `rounded-3xl`, `hover:-translate-y-0.5`, `PiMapTrifoldLight` ikon, "Élő flottakövetés" felirat, `onClick={() => history.push("/admin/flottakovetes")}`) — nem helyettesíti a Flottakövetés `mobileGroups.flotta`-beli, drawer-en keresztüli elérését (az is megmarad, ld. táblázat fent), csak egy gyorsabb, 1-érintéses alternatívát ad hozzá a Kezdőlapról. A `FlottaOsszesitoStrip` maga **nem** bővül ezzel az elemmel — az a komponens egy rögzített `{title, value: szám, icon, path}` szerződésre épül (ld. a `flottaTetelek` tömb), aminek nincs értelmes numerikus `value`-ja egy élő térkép-linkhez, ezért ez egy önálló, saját markup.

## 7. Gesztusok

- **Swipe** `src/components/Dropdowns/NotificationDropdown.js` listasorain: egyszerű `onTouchStart`/`onTouchMove`/`onTouchEnd` delta-X küszöb (pl. ±64px), jobbra húzás = "Jóváhagyás", balra húzás = "Elutasítás" a jármű-váltási kérelem sorokon. Nincs szükség külön swipe-könyvtárra egyetlen 2-irányú gesztushoz. A meglévő gombos Jóváhagyás/Elutasítás **megmarad** (a swipe egy gyorsabb alternatíva, nem az egyetlen út — accessibility/discoverability miatt is fontos, hogy gomb nélkül senki ne ragadjon el).
- **Long press** a bottom nav "Fuvarok" ikonján: ~500 ms `onTouchStart` időzítő (törölve `onTouchEnd`/`onTouchMove`-on, ha elmozdul vagy elengedik korábban) → közvetlen navigáció `/admin/fuvarForm`-ra, kihagyva a FAB-lapot. Rövid (< 500 ms) érintés a normál `Link` viselkedést futtatja (navigáció `/admin/fuvarok`-ra).

## Szélsőesetek és regressziók, amikre figyelni kell

- **Aktív állapot (`isActive`) highlighting** az új direkt "Fuvarok" linken — a meglévő `FORM_ROUTE_TO_LIST_ROUTE` map (Sidebar.js ~298-306. sor) **ellenőrizve nem tartalmazza** a `/admin/fuvarForm` → `/admin/fuvarok` párt (a jelenlegi 7 bejegyzés között nincs ott) — enélkül a bottom nav "Fuvarok" gombja nem lenne aktívnak jelölve a form-oldalon. Ez a redesign része, nem opcionális pótlás.
- **`safe-area-inset-bottom`** — a mai sáv `pb-[calc(0.375rem+env(safe-area-inset-bottom))]`-t használ; az emelt FAB middle-slotnak saját, a sávnál nagyobb magasságot kell kapnia anélkül, hogy a biztonsági terület alá csúszna (notch nélküli és noteches eszközön is ellenőrizendő).
- **Badge-számítás duplikáció** — a `nyitottBejelentesek.length`/`kerelmek.length` most három helyen jelenik meg egyszerre (Bell gomb, FAB összesített jelvény, drawer "Bejelentések" sor) — mindhárom ugyanazt a state-et olvassa, nincs külön API-hívás, csak a render-hely többszöröződik.
- **`adminOnly` szűrés** a `partnerek`/`rendszer` drawer-csoportokban — a meglévő `isAdmin` ellenőrzés (`item.adminOnly && !isAdmin` → kihagyás) változatlanul érvényes, csak az új `MobileMoreDrawer` komponensnek is meg kell kapnia propként.
- **`hasAccess()` (modulhozzáférés, fuvarszervező szerepkör)** — a mai `mobileGroups` render-ág `hasAccess(item.to)` szűrést fut soronként; ugyanezt a függvényt a drawer-nek is meg kell kapnia (propként vagy közös hookként), különben egy korlátozott jogú csapattag olyan menüpontot is lát mobilon, amit desktopon nem.
- **Tailwind rebuild** — bármely új utility-osztály (pl. a FAB emelt körének mérete/színe) bevezetése után `npm run build:tailwind` szükséges, mielőtt élőben ellenőrizhető lenne (ld. CLAUDE.md ismert gotcha — `src/index.js` az előre lefordított `tailwind.css`-t importálja).
- **Dark mode** — minden új komponens (`QuickActionSheet.js`, `MobileMoreDrawer.js`) a meglévő `dark:` variánsokat követi, ugyanazon `isDark`/`onToggleDark` propok mentén, amit a `Sidebar` már ma is kap az `Admin.js`-től.

## Tesztelés

Nincs backend-érintés, tisztán frontend UI-munka — élőben, böngészőben (mobil viewport, Playwright vagy DevTools device-emuláció) ellenőrizendő, nem csak kód-olvasással:

1. Bottom nav 5 slotja (Kezdőlap, Fuvarok, FAB, Értesítések, Több) helyesen renderelődik, aktív állapot mindegyiken helyesen vált útvonalváltáskor (a Fuvarok ikon a `/admin/fuvarForm`-on is aktívnak jelölve).
2. FAB megnyomása megnyitja a Gyors műveletek lapot, mind a 4 sor navigál/nyit helyesen, a jelvényszámok (nyitott bejelentés, jármű-váltás) egyeznek a Bell gombon látottal.
3. "Több" megnyitása: keresőmező a `GlobalSearch` overlay-t nyitja; Kedvencek sáv pontosan azt mutatja, amit a felhasználó a Napi Zóna szerkesztőben (desktopon) beállított; mind az 5 csoport lenyitható, `adminOnly` elemek csak admin/root felhasználónál látszanak, `hasAccess()`-szűrt elemek egy korlátozott jogú csapattagnál helyesen hiányoznak.
4. Sofőrök oldal "Riport" füle ugyanazt az adatot mutatja, mint a régi `/admin/sofor-riport` route közvetlenül megnyitva (mélylink-kompatibilitás).
5. Előzmények oldal mindkét füle (Napló/Értesítési előzmények) helyesen tölt, `/admin/naplo` és `/admin/ertesitesi-elozmenyek` közvetlen megnyitása a megfelelő fület preszelektálja.
6. Swipe jóváhagyás/elutasítás a Bell panel jármű-váltás sorain — mindkét irány, plusz hogy a meglévő gombos út is működik változatlanul.
7. Long press a Fuvarok ikonon → közvetlen `/admin/fuvarForm`; rövid tap → `/admin/fuvarok`.
8. Dashboard Flottakövetés-chip megnyitja a Flottakövetés oldalt.
9. Sötét mód kapcsoló a drawer fiók-sorában ugyanazt az `isDark` state-et váltja, amit a desktop fejléc gombja.
10. Mindez `npm run build:tailwind` **után** ellenőrizve, nem előtte.
