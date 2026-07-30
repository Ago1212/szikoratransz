# Fuvar modul mezőátalakítás — dátumok, díj, raklapszám, tömeg, felrakó/lerakó (2026-07-30)

## Kontextus

A Fuvar-first munkafolyamat (ld. CLAUDE.md, `2026-07-28-fuvar-first-workflow-design.md`) már működik: admin hoz létre fuvart sofőr+jármű hozzárendeléssel, a sofőr utólag tölti fel a menetlevél/szállítólevél fotóját. Ez a kör a `fuvarok` tábla mezőit igazítja a tényleges üzleti igényhez, és bővíti a megbízó (`ugyfelek`) adatmodellt felrakó/lerakó helyszínekkel.

## Cél

1. "Teljesítés dátuma" helyett külön Felrakás dátuma + Lerakás dátuma.
2. "Fuvarlevél szám" mező megszűnik, helyette Raklapszám (egész szám).
3. Tömeg mostantól tonnában (eddig kg).
4. Fuvardíj + Egyéb költség helyett egyetlen összesített Díj mező.
5. Felrakó/lerakó strukturáltabb: cég + cím külön mezőben, mind a fuvaron, mind a megbízónál (`ugyfelek`) adminisztrálható, automatikus ajánlással.
6. Sofőr-oldali fuvar-kártya bővül (távolság, raklapszám, megbízó neve+címe, tömeg, felrakó/lerakó cég+cím, dátumok) és kap egy Google Maps útvonaltervező gombot.

## Adatmodell

### `fuvarok` tábla (backend/sql/44.sql, root MySQL felhasználóval futtatva — az app saját DB-usere nem jogosult ALTER TABLE-re)

Meglévő oszlopok, amik változnak:

| Régi | Új | Megjegyzés |
|---|---|---|
| `teljesites_datuma DATE NULL` | `lerakas_datuma DATE NULL` | `CHANGE COLUMN`, adat megmarad — a régi "teljesítés dátuma" legközelebbi jelentése a lerakás időpontja |
| — | `felrakas_datuma DATE NULL` | új oszlop, régi soroknál NULL marad |
| `fuvarlevel_szam VARCHAR(100) NULL` | `raklapszam INT NULL` | a régi oszlop törlődik (nem numerikus régi adat esetén nincs érdemi konverzió), új oszlop üresen indul |
| `tomeg_kg DECIMAL(8,2) NULL` | `tomeg_tonna DECIMAL(6,2) NULL` | új oszlop hozzáadva, `UPDATE ... SET tomeg_tonna = tomeg_kg/1000 WHERE tomeg_kg IS NOT NULL`, majd `tomeg_kg` törölve |
| `fuvardij DECIMAL(10,2) NULL` + `egyeb_koltseg DECIMAL(10,2) NULL` | `dij DECIMAL(10,2) NULL` | új oszlop, `UPDATE ... SET dij = COALESCE(fuvardij,0)+COALESCE(egyeb_koltseg,0) WHERE fuvardij IS NOT NULL OR egyeb_koltseg IS NOT NULL`, majd mindkét régi oszlop törölve |
| `felrako VARCHAR(250) NULL` | `felrako_ceg VARCHAR(250) NULL` + `felrako_cim VARCHAR(250) NULL` | a régi szabad szöveg a `felrako_ceg`-be kerül átmásolva (`UPDATE ... SET felrako_ceg = felrako`), majd `felrako` törölve |
| `lerako VARCHAR(250) NULL` | `lerako_ceg VARCHAR(250) NULL` + `lerako_cim VARCHAR(250) NULL` | ugyanaz a minta |

Változatlan marad: `id, admin, sofor_id, kamion_id, furgon_id, potkocsi_id, tavolsag_km, megbizo_id, aru_megnevezese, megjegyzes, szamlaszam, beerkezett_dokumentum_id, allapot, dokumentum_feltoltve, letrehozva, updatedAt, torolt`.

A `getFuvar()`-ban jelenleg számolt `osszesen = fuvardij + IFNULL(egyeb_koltseg,0)` megszűnik, mert a `dij` már maga az összeg — minden ezt olvasó hely (`getFuvarok`, `CardTableForFuvarok.js` "Összesen" oszlop, export) egyszerűen a `dij`-et használja "Díj" néven.

### `ugyfelek` tábla (ugyanez a migrációs fájl)

4 új oszlop: `felrako_ceg VARCHAR(250) NULL`, `felrako_cim VARCHAR(250) NULL`, `lerako_ceg VARCHAR(250) NULL`, `lerako_cim VARCHAR(250) NULL`. Ezek a megbízóhoz tartozó "alapértelmezett" felrakó/lerakó helyszínek — egy-egy érték megbízónként, nem lista.

## Automatikus ajánlás + visszamentés

**Ajánlás (megbízó → fuvar form)**: `FuvarForm.js`-ben a megbízó kiválasztásakor (`handleMegbizoChange`), ha a fuvar felrakó/lerakó mezői (mind a 4) még üresek, a kiválasztott megbízó `felrako_ceg/felrako_cim/lerako_ceg/lerako_cim` értékeivel töltődnek ki (mezőnként külön: csak azt tölti ki, ami üres és a megbízónál van érték). Ez ajánlás, nem zárolás — a felhasználó felülírhatja.

**Visszamentés (fuvar → megbízó)**: `FuvarInterface::newFuvar()`/`updateFuvar()` mentés után (sikeres write esetén), ha a fuvaron van megadva megbízó ÉS a fuvaron van kitöltött felrakó/lerakó adat, minden mezőt (`felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`) külön-külön megvizsgál: ha a megbízónál az adott mező jelenleg `NULL`/üres, beírja a fuvaron szereplő értéket. Ha a megbízónál már van érték, azt sosem írja felül. Ez egy csendes, a felhasználó felé nem jelzett háttérművelet (nincs hozzá UI-visszajelzés, csak a következő fuvarnál/megbízó-oldalon látszik az eredmény).

Ez a logika egy új privát segédmetódusban él (`FuvarInterface::frissitsMegbizoFelrakoLerako($megbizoId, $data, $cegId)`), amit mindkét write-metódus hív a saját sikeres ágán.

## Backend egyéb változások

- `FuvarInterface::RENDEZHETO_OSZLOPOK`: `teljesites_datuma` → `lerakas_datuma`, `felrakas_datuma` hozzáadva, `felrako`/`lerako` → `felrako_ceg`/`lerako_ceg`.
- `getFuvarok()` keresés (`felrako`/`lerako`/`aru_megnevezese`/`fuvarlevel_szam`) → `felrako_ceg`/`felrako_cim`/`lerako_ceg`/`lerako_cim`/`aru_megnevezese`/`raklapszam`.
- `datumTol`/`datumIg` szűrés mostantól `lerakas_datuma`-ra vonatkozik (ez az elsődleges dátum).
- `getStatisztikak()`/`getFigyelmeztetesek()`/`getSoforDashboard()`: minden `teljesites_datuma`-hivatkozás → `lerakas_datuma`.
- `getSajatFuvarok()`/`getSajatFuvar()` (sofőr-oldali): bővül `raklapszam`, `felrakas_datuma`, `lerakas_datuma`, `felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`, `tomeg_tonna` mezőkkel, plusz a megbízó saját címének enrichmentje (`megbizo_cim`, `megbizo_irsz`, `megbizo_varos` — külön SELECT-tel az `ugyfelek` táblára, a meglévő no-JOIN enrichment mintát követve). Továbbra sem ad vissza `dij`/`szamlaszam`-ot.
- `UgyfelInterface::newUgyfel()`/`saveUgyfelData()`: bind-listák bővülnek a 4 új mezővel.
- `ApiHandler::getActions()`: a `newFuvar`/`updateFuvar`/`newUgyfel`/`saveUgyfelData` kötelező-mező listái nem változnak (a felrakó/lerakó/dátum mezők eddig sem voltak kötelezők) — csak a mezőnevek frissülnek, ahol a régi név szerepelt bennük.

## Frontend — admin (FuvarForm.js)

`emptyFuvar` mezők: `felrakas_datuma, lerakas_datuma, felrako_ceg, felrako_cim, lerako_ceg, lerako_cim, tavolsag_km, tomeg_tonna, raklapszam, dij` (a `teljesites_datuma/felrako/lerako/tomeg_kg/fuvardij/egyeb_koltseg/fuvarlevel_szam` mezők eltűnnek).

Útvonal szekció mezői (sorrendben): Felrakás dátuma, Lerakás dátuma, Felrakó cég, Felrakó cím, Lerakó cég, Lerakó cím, Távolság (km), Tömeg (tonna), Áru megnevezése, Raklapszám.

Díjak szekció: egyetlen "Díj (Ft)" mező + Állapot select (változatlan `ALLAPOT_OPTIONS`).

"Korábbi fuvarok ezzel a megbízóval" panel: `lerakas_datuma · felrako_ceg → lerako_ceg · dij` formátumra vált (`FuvarInterface::getUgyfelElozmeny()` visszaadott mezői is ennek megfelelően frissülnek).

`handleMegbizoChange` bővül a fenti ajánlás-kitöltési logikával (a már betöltött `ugyfelek` lista elemeiből, nincs új API-hívás hozzá).

## Frontend — megbízó form (CardUgyfel.js)

Új, opcionális "Felrakó / Lerakó" szekció: Felrakó cég, Felrakó cím, Lerakó cég, Lerakó cím — ugyanaz a 4 mező, hogy admin közvetlenül is karbantarthassa őket a megbízónál, nem csak a fuvaron keresztüli automatikus visszamentéssel.

A `FuvarForm.js` gyors "Új megbízó felvétele" modálja NEM bővül ezekkel (YAGNI — az automatikus visszamentés úgyis kitölti az első fuvar mentésekor).

## Frontend — admin lista (CardTableForFuvarok.js)

Oszlopok: `lerakas_datuma` (elsődleges, sortable), `felrakas_datuma` (sortable, mobileHidden), `felrako` (a `felrako_ceg` értékét mutatja, `title` attribútumban a `felrako_cim`), `lerako` (ugyanígy `lerako_ceg`/`lerako_cim`), `megbizo_nev`, `sofor_nev` (mobileHidden), `jarmu` (mobileHidden), `raklapszam` (mobileHidden), `tomeg_tonna` (mobileHidden, "t" egység), `dij` ("Ft" formázva, ez váltja a korábbi számolt "Összesen" oszlopot), `allapot`, `szamlaszam` (mobileHidden), `dokumentum_feltoltve` (mobileHidden), `actions`.

`exportColumns`: `lerakas_datuma, felrakas_datuma, felrako_ceg, felrako_cim, lerako_ceg, lerako_cim, megbizo_nev, sofor_nev, raklapszam, tomeg_tonna, dij, allapot, szamlaszam`.

## Frontend — sofőr lista (Fuvarok.js)

Route header: `felrako_ceg → lerako_ceg` (a korábbi `felrako → lerako` helyett). Subline: `lerakas_datuma · jarmu · megbizo_nev` (a korábbi `teljesites_datuma` helyett).

## Frontend — sofőr részletek (FuvarReszletek.js)

Megjelenő mezők (a jelenlegi `dt`/`dd` lista bővítve/átrendezve):
- Felrakás dátuma, Lerakás dátuma
- Távolság (km)
- Tömeg (t)
- Raklapszám
- Megbízó neve + címe (`megbizo_nev` + `megbizo_cim`/`megbizo_irsz`/`megbizo_varos` összefűzve, feltételesen, csak ha van megbízó)
- Áru (megmarad, feltételes)
- Megjegyzés (megmarad, feltételes)

Felrakó/Lerakó blokk: két kártyaszerű sor, mindegyikben a cég neve normál méretben, alatta a cím kisebb, halványabb szöveggel (ugyanaz a vizuális mintázat, mint a "Fájlok" modul kártyáinál a másodlagos infóra — `text-ink-400`, nem `ink-300`, a CLAUDE.md kontraszt-szabálya szerint).

**Google Maps gomb**: a Felrakó/Lerakó blokk alatt egy gomb, ami megnyitja
`https://www.google.com/maps/dir/?api=1&origin=<felrako_ceg + felrako_cim URL-encode-olva>&destination=<lerako_ceg + lerako_cim URL-encode-olva>`
új lapon (`window.open(..., '_blank')`). Ha a felrakó ÉS lerakó cím/cég közül bármelyik teljesen hiányzik (se cég, se cím), a gomb `disabled` állapotba kerül (nincs értelmes cím, amivel útvonalat lehetne tervezni).

## Migráció/rollout megjegyzések

- A `backend/sql/44.sql` root MySQL felhasználóval futtatandó (ugyanaz a korlátozás, mint a `29.sql`/`42.sql` óta — az app saját DB-usere nem jogosult `ALTER TABLE`-re).
- A helyi dev DB-ben lévő, korábbi tesztadatok best-effort módon migrálódnak (ld. fenti UPDATE-ek), de nem garantált 1:1 pontosságú visszaállítás minden mezőre (pl. a `fuvarlevel_szam` adat elvész, mert fogalmilag más, mint a raklapszám).
- Nincs szükség új API action-re — a meglévő `newFuvar/updateFuvar/newUgyfel/saveUgyfelData/getFuvarok/getFuvar/getSajatFuvarok/getSajatFuvar/getUgyfelek` actionök mezőlistái bővülnek/változnak, de maguk az action-nevek és jogosultsági szabályok (`MODULE_PERMISSION_MAP`, ownership-guardok) nem módosulnak.

## Tesztelés

Szerver-oldali módosítás lévén (CLAUDE.md kritikus tesztelési szabálya) a golden path végigfuttatása szükséges élesben induláshoz hasonló helyi DB-n: megbízó felvétele felrakó/lerakó nélkül → fuvar létrehozása felrakó/lerakó adatokkal → megbízó automatikus frissülésének ellenőrzése → új fuvar ugyanahhoz a megbízóhoz → ajánlás-kitöltés ellenőrzése a formon → sofőr-oldali kártya megjelenítés + Google Maps gomb linkjének ellenőrzése.
