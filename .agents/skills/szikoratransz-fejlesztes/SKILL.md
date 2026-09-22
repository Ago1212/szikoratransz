---
name: szikoratransz-fejlesztes
description: Használd, ha ebben a szikoratransz repóban (React admin/sofőr UI + sablon nélküli, plain PHP/PDO REST-API, MySQL/MariaDB) kódot írsz, módosítasz vagy reviewolsz — `backend/api.php`/`ApiHandler.php`/`backend/interface/*.php` bővítése előtt, új SQL-migráció (`backend/sql/N.sql`) létrehozása előtt, bármilyen `src/` React-nézet vagy komponens módosítása előtt, vagy amikor a feladat csak annyi, hogy "adj hozzá egy API actiont", "hozz létre egy új oldalt", "javíts egy bugot a backendben/frontenden". Ez a projekt saját, nem PannonSet-keretes stackje — NEM való hozzá a company-stack/regi-keret-skill vagy az uj-keret-skill.
---

# Szikora Transz — fejlesztési kézikönyv

## Mi ez, és mi a viszonya a CLAUDE.md-hez

Ez a repó saját, egyedi stacket használ: React (CRA, Notus/Tailwind
admin-sablon) admin+sofőr UI, framework nélküli PHP 8.2 (PDO) REST-szerű
API, MySQL/MariaDB. **Nem** a Pannon Set „régi” vagy „új” keretrendszere —
ha ilyen jelet látnál (`gwtraktar/`, `ps-framework-core`), az egy másik
projekt, itt nem alkalmazható.

A repó gyökerében lévő `CLAUDE.md` a mérvadó, folyamatosan karbantartott,
dátumozott forrás — **mindig automatikusan betöltődik** ebben a projektben,
ezért ez a skill **nem ismétli meg a tartalmát**. Ehelyett egy tömör,
akció-orientált szabálykönyvet ad: mit tarts be mindig, mit tilos soha
megtenni, és melyik `CLAUDE.md`-szekcióhoz nyúlj mélyebb kontextusért. Ha a
kettő ellentmond egymásnak, a `CLAUDE.md` a frissebb, mérvadóbb forrás —
szólj a felhasználónak, és frissítsétek ezt a skillt is.

## Architektúra 30 másodperc alatt

- **Frontend**: `react-router-dom` v5, 3 független layout (`Admin`/`User`/`Auth`), nincs közös route-guard komponens — auth/role-ellenőrzés ad hoc, nézetenként.
- **API**: egyetlen belépési pont `backend/api.php` → `ApiHandler.php` nagy `switch`-e, minden domain-modul saját `backend/interface/*Interface.php` fájlban.
- **Identitás mindig szerver-oldalon dől el** a `sessions` táblából (`resolveKerelmezo`/`resolveSajatSoforId`/`resolveSajatCegId`) — kliens-submitted `id`/`ceg_id`/`admin`/`sofor_id` mező **soha nem** bizalmi forrás, csak visszamenőleges kompatibilitásért fogadható el, és mindig kereszt-ellenőrzött.
- **`ceg_id` = tenant-scoping kulcs**, `is_root ? admin.id : admin.tulajdonos_admin_id` — csapattagok az `admin` táblát osztják, nem a saját `admin.id`-jukkal szűrnek.
- **DB**: minden tábla InnoDB (2026 óta), de **nincs valódi FK-constraint** sehol — referenciális integritás csak konvenció, kód-szinten. Soft delete mindenhol: `torolt ENUM('I','N')`, minden lekérdezésnek explicit szűrnie kell rá.
- **Nincs composer, nincs PHP-keretrendszer, nincs `.env`-only secrets-réteg** (van opcionális `backend/env.php` felülírás) — titkok hardcode-olva `db.php`/`config.php`-ban.

## Kötelező munkafolyamat minden feladat előtt

1. Olvasd el a `CLAUDE.md` releváns szekcióját (lásd lenti gyors-referencia táblát) — ne találgass olyan mintát, ami már dokumentálva van.
2. Kövesd a meglévő domain-modul mintáját (pl. ha kamion-szerű modult bővítesz, nézd meg `kamionInterface.php`-t analógiaként — a `furgon` modul is így épült fel a `kamion` mellé, ld. `CLAUDE.md` "Furgon" szekció).
3. Backend-módosítás után **ténylegesen futtasd le** a módosított kódutat (helyi MariaDB már fut, nincs szükség extra setupra) — ne elégedj meg a "kód alapján helyesnek tűnik" megállapítással.
4. UI-módosítás után nyisd meg böngészőben (dev szerver + szükség esetén `npm run build:tailwind`), és teszteld a golden pathet.

## Új backend API action hozzáadása

1. Vedd fel `ApiHandler::getActions()`-be a kötelező paraméterekkel.
2. Adj hozzá egy `case`-ágat `process()`-ben.
3. Az azonosságot **mindig** `resolveKerelmezo`/`resolveSajatSoforId`/`resolveSajatCegId` valamelyikével told fel szerver-oldalon — kivétel csak akkor, ha az action tudatosan mindkét szerepkörből (admin ÉS sofőr) hívható, ilyenkor **ne** vedd fel `MODULE_PERMISSION_MAP`-be (az admin-only `resolveKerelmezo()`-t hívna a `validation()`-ben, még mielőtt a `case`-ág eldönthetné a szerepkört — ez a hibaosztály többször előfordult, ld. `CLAUDE.md`).
4. Ha bármelyik paraméter egy másik tábla FK-ja (pl. `kamion_id`, `sofor_id`), ellenőrizd tulajdonjogát a hívó `ceg_id`-jéhez képest **írás előtt is, olvasás előtt is** — sosem elég csak az egyik irány.

## Új domain `interface/*Interface.php` fájl hozzáadása

Ez a leggyakoribb csendes hibaforrás — 3 kötelező bekötés `ApiHandler.php`-ban, mindhárom kell, nem elég kettő:

1. `require 'interface/xInterface.php';` a fájl tetején.
2. Példányosítás (`$xInterface = new XInterface($this->db);`).
3. **A változónév felvétele a `process()`-en belüli egyetlen `global $kamionInterface, ...;` sorba.** Ennek kihagyása "Call to a member function X() on null" hibát ad, nem hiányzó-require hibát — ha ezt látod, elsőként ezt ellenőrizd.

## SQL migráció (`backend/sql/N.sql`)

- Mielőtt új `N+1.sql`-t hoznál létre, `git status`/`git log`-gal ellenőrizd, hogy a legutóbbi számozott fájl **commitolva van-e** — ha nincs, ugyanabba a fájlba írd tovább a séma-változást, ne fragmentáld.
- `CREATE TABLE IF NOT EXISTS` csak a tábla *létezését* ellenőrzi, az oszlop-szerkezetet nem — ha egy tábla névileg már létezhetett egy korábbi, más célú munkamenetből, `SHOW COLUMNS`-szal vesd össze a tényleges sémát, mielőtt sikeresnek könyveled el a migrációt.
- Az app saját DB-felhasználója csak SELECT/INSERT/UPDATE/DELETE/LOCK TABLES jogú — `ALTER TABLE`/`CREATE`/`DROP` root MySQL-felhasználóval fut (`mysql -u root`).

## Tiltólista

- **Sosem bízz** kliens-submitted `ceg_id`/`admin`/`id`/`sofor_id` mezőben azonosság vagy tulajdonjog eldöntésére — mindig szerver-oldali resolve.
- **Sosem `window.confirm`** — a projekt saját `utils/confirm.js` `confirmDialog()`-ja van erre.
- **Sosem `sessionStorage`** az auth `user`/`sessionToken` párhoz — kizárólag `localStorage` (PWA-tartósság miatt, ld. `CLAUDE.md`).
- **Sosem `JOIN` vagy `UNION` SQL-ben** — a projekt saját SQL-lintere tiltja mindkettőt; entitás-dúsítás mindig külön `SELECT` + PHP-oldali `IN (...)`/merge mintával.
- **Sosem vezess be új composer/PHP-függőséget** — a projekt konvenciója szerint nulla PHP-függőség; rendszer-bináris `exec()`-kel hívása (pl. `pdftotext`) az elfogadott minta külső eszközre.
- **Sosem hagyatkozz `margin`-re** mobil scroll-clearance-hez — browser-gotcha, a trailing `margin-bottom` nem számít bele a `scrollHeight`-ba, valódi magasságú sibling `<div>` kell.
- **Sosem írj kódkommentet alapból** — csak nagyon hosszú/összetett function/logika esetén, ha komment nélkül a WHY homályos maradna.
- **Sosem jelents készet szerver-oldali módosítást élő futtatás/teszt nélkül** — ha nincs elérhető teszt-környezet, ezt explicit mondd ki, ne tegyél úgy, mintha tesztelve lenne.

## AI-viselkedési szabályok

1. Kódírás előtt nézd meg a `CLAUDE.md` releváns szekcióját (gyors-referencia lent) — ne találj ki mintát, amit a dokumentum már leír.
2. Backend-módosítást mindig futtass le ténylegesen a helyi MariaDB ellen, mielőtt késznek jelented.
3. UI-módosítást mindig nyiss meg böngészőben, `npm run build:tailwind` után, ha új Tailwind-osztályt vezettél be.
4. Ha a `CLAUDE.md` és a tényleges kód ellentmond egymásnak (pl. egy dokumentált fix nem érvényesül), ezt mondd ki explicit, és ellenőrizd a tényleges forrást — ne a dokumentumot fogadd el vakon.
5. Ne vezess be új absztrakciót/mintát ott, ahol a projektnek már van sajátja (pl. `DataTable.js`, `Modal.js`, `confirmDialog`, `AutocompleteSelect.js`) — használd a meglévőt.

## Gyors-referencia — hova nézz a `CLAUDE.md`-ben

| Kérdés | `CLAUDE.md` szekció |
|---|---|
| API dispatch, új action/interface bekötése | "Backend API dispatch" |
| Session/jogosultság, `ceg_id` felbontás, csapattagok | "Session & permission model" |
| DB-séma, soft delete, tábla-célok, MyISAM→InnoDB története | "Database schema" |
| SQL migráció-konvenció | "SQL migration convention" |
| Lista/tábla UI (`DataTable.js`) | "Shared table/list component" |
| Modal/popover pozicionálás gotcha-k | "Floating popovers", "Mobile forms (no popup)" |
| Mobil nav, bottom bar, FAB-átfedés | "Mobile navigation", "UX-audit consistency pass" |
| Push-értesítés (admin+sofőr) | "Fuvar-first munkafolyamat + sofőr push/feltöltés" |
| Deviza/multi-currency Pénzforgalomban | "Deviza (multi-currency) handling" |
| Külső integrációk (NAV, GPSmart, MNB, MOL PDF) | "External data integrations", "MOL üzemanyagkártya PDF import" |
| PWA/service worker | "PWA (installable app)" |
| Landing/SEO oldalak, prerender | "Long-tail SEO szolgáltatás-oldalak" |
| Fuvar modul (jelenlegi, fuvar-first állapot) | "Fuvar-first munkafolyamat", "Fuvar mezőátalakítás" |
| Turnstile bot-védelem | "Cloudflare Turnstile bot-védelem" |
| Helyi dev környezet, headless verifikáció | "Local dev environment (this machine)" |

## Bizonytalanság kezelése

Ha egy feladat olyan területet érint, amit sem ez a skill, sem a
`CLAUDE.md` nem fed le részletesen (pl. vadonatúj domain-modul, korábban
nem dokumentált integráció), ne találj ki mintát — nézd meg a legközelebbi
analóg modult (pl. `furgonInterface.php` mint `kamionInterface.php`
mirror), és kövesd azt. Ha a `CLAUDE.md` egy állítása elavultnak tűnik a
tényleges kódhoz képest, mondd ki explicit, és a projekt saját
CLAUDE.md-karbantartási szabálya szerint (ld. globális CLAUDE.md) frissítsd
a dokumentumot nagyobb módosítás után.
