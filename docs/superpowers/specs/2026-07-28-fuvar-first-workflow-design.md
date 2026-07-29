# Fuvar-first munkafolyamat + sofőr-oldali dokumentum-feltöltés + push-értesítés — tervezési spec

**Dátum**: 2026-07-28
**Állapot**: Jóváhagyott terv, implementáció előtt

## 1. Áttekintés és cél

A Fuvar modul jelenlegi (2026-07-25-i, `2026-07-25-fuvar-dokumentum-ocr-design.md`) folyamata
**dokumentum-first**: a sofőr fotóz egy fuvarlevelet/szállítólevelet, admin átnézi a Gemini
OCR-eredményt, és abból hoz létre vagy csatol egy fuvart. Ez a spec **megfordítja** ezt a
sorrendet: a fuvarszervező (admin) hozza létre előre a fuvart (sofőrrel/járművel már
hozzárendelve), a sofőr push-értesítést kap róla, és a fuvarhoz **utólag** tölti fel a
menetlevél (kötelező) és a szállítólevél (opcionális) fotóját. Mivel a fuvar adatai már
megvannak a fotó feltöltésekor, **nincs többé szükség OCR-re** — a kép csak igazolás.

Ennek megfelelően a jelenlegi OCR-alapú "Beérkezett dokumentumok" inbox (Gemini OCR-hívás,
entitás-egyeztetés, review-panel) **teljesen megszűnik** — nem párhuzamos útvonalként marad
meg, hanem kikerül a kódbázisból (a mögöttes `beerkezett_dokumentumok` tábla a DB-ben marad,
ugyanúgy, mint a korábbi Fuvarok-kivezetésnél megszokott konvenció, ld. CLAUDE.md "Removed:
Fuvarok / Fuvartervező modulok").

A sofőr-oldali UI is átalakul: a Dashboard jelenlegi kiemelt "Dokumentum feltöltése" kártyája
helyén ezentúl az **"Aktív fuvarjaim"** lista jelenik meg (ez lesz az elsődleges napi
művelet), a BottomNav középső piros FAB-ja Bejelentésről Fuvarokra vált, a dokumentum-
feltöltés pedig a Fuvar Részletek oldal része lesz, nem önálló hely.

## 2. Előzmény és kontextus

Ez a spec közvetlenül a 2026-07-25-i Fuvar modul alapjára és a 2026-07-28-i (jelen
beszélgetésben korábban elvégzett) "Sofőr/Jármű/Pótkocsi/Megbízó előzetes kitöltése"
kiegészítésre épül — utóbbi (`FuvarInterface::egyeztetOcrAlapjan()`,
`getFuvarEgyeztetesJavaslat` action, a `FuvarForm.js` OCR-előtöltő `useEffect`-je) ezzel a
tervvel **feleslegessé válik és törlésre kerül**, mert dokumentum-first folyamat nélkül nincs
mit egyeztetni — a fuvar mezői mindig kézzel/admin által kerülnek be, elsőként.

A push-értesítés infrastruktúra (`backend/WebPushSender.php`, `backend/interface/
pushInterface.php`, `push_feliratkozasok` tábla, `PushFeliratkozas.js`) már létezik, de
**kizárólag admin-címzettre** épül (`admin_id` oszlop, `resolveKerelmezo()`-val feloldva) —
ez a spec ezt generalizálja sofőr-címzettre is.

A `fajlok` polimorf melléklet-tábla (`tabla`+`rowid`+`cimkek`) már ma is kezeli a
`tabla='fuvar'` mellékleteket (`CardFuvarFajlok.js`, admin-oldali megjelenítés) — ez a spec
nem vezet be új melléklet-táblát, hanem erre épít.

## 3. Hatókör

### Ebben a fázisban elkészül
- `fuvarok.dokumentum_feltoltve` új oszlop — a sofőr-oldali "aktív" lista szűrő-jelzése.
- Sofőr-oldali fuvar-lekérdezések (`getSajatFuvarok`/`getSajatFuvar`), Fuvarok lista +
  Fuvar Részletek oldal, útvonal-belépés a `layouts/User.js`-be.
- Sofőr-oldali dokumentum-feltöltés fuvaronként, típus szerint (`menetlevel`/`szallitolevel`),
  több kép/típus, saját törlési lehetőséggel — új, ownership-ellenőrzött backend action.
- Push-értesítés a sofőrnek új fuvar-hozzárendeléskor (`newFuvar`/`updateFuvar` mellékhatás).
- `push_feliratkozasok` generalizálása admin+sofőr címzettre, `PushFeliratkozas.js` bekötése a
  sofőr `Profil.js`-re.
- Dashboard/BottomNav átalakítás a sofőr oldalon (ld. 6. pont).
- Admin-oldali "Dokumentum ✓" jelvény a Fuvarok listán/részletein.
- A teljes OCR-alapú "Beérkezett dokumentumok" modul eltávolítása (kód, nem DB-tábla).

### Ebben a fázisban NEM készül el
- Automatikus `allapot`-váltás dokumentum-feltöltéskor (tudatos döntés, ld. 5.3).
- Admin→sofőr push bármely MÁS eseményre (csak "új fuvar hozzárendelve") — a 8. pontban
  felsorolt extra ötletek (emlékeztető, admin-push feltöltéskor) külön jóváhagyást igényelnek.
- Több sofőrös/relais fuvarok (`fuvarok.sofor_id` marad egyetlen mező).
- Fuvar duplikálása/tömeges létrehozása (ld. 8. pont, extra ötlet, nem ennek a fázisnak
  a része).

## 4. Adatmodell

### 4.1 `fuvarok.dokumentum_feltoltve`
```sql
ALTER TABLE fuvarok ADD COLUMN dokumentum_feltoltve DATETIME NULL AFTER allapot;
```
`NULL` = a sofőr még nem töltött fel menetlevél-fotót ehhez a fuvarhoz. Az első sikeres
`menetlevel`-tagelt feltöltéskor `NOW()`-ra áll (idempotens — ha már be van állítva, nem
íródik felül). **Szándékosan független `allapot`-tól** (ld. 5.3) — a sofőr "aktív fuvarjaim"
listája `dokumentum_feltoltve IS NULL AND allapot <> 'teljesitve'` alapján szűr; a kettő
bármelyike lezárja a fuvart a sofőr szemszögéből, egymástól függetlenül.

### 4.2 Dokumentum-fotók — nincs új tábla
A meglévő `fajlok` tábla (`tabla='fuvar'`, `rowid=<fuvar id>`) veszi fel a sofőr által
feltöltött fotókat is, pontosan úgy, ahogy ma az admin-oldali `CardFuvarFajlok.js` már
megjeleníti őket. A meglévő `cimkek` (szabad szöveges címke) oszlop kap egy **rögzített,
csak erre a feltöltési útvonalra érvényes konvenciót**: `cimkek = 'menetlevel'` vagy
`cimkek = 'szallitolevel'` (a frontend csak ezt a két értéket engedi választani ezen az
űrlapon — a Fájlok modul általános, szabad címkézése máshol változatlan marad). Egy
fuvarhoz tetszőleges számú fotó tartozhat mindkét címkéből (fedi a "két menetlevél-kép, nincs
szállítólevél" esetet).

**Megfontolt alternatíva, elvetve**: dedikált `fajlok.fuvar_dokumentum_tipus ENUM(...)` oszlop
— elvetve, mert a `fajlok` tábla polimorf (kamion/potkocsi/furgon/sofor/egyeb/admin/
karbantartasok/beerkezett_dokumentum/fuvar/bank_import/mol_import/tachograf_import), egy
fuvar-specifikus oszlop csak ennél az egy `tabla`-értéknél lenne értelmezhető — a meglévő,
általános célú `cimkek` mező pontosan erre való, sémaváltoztatás nélkül.

### 4.3 `push_feliratkozasok` — admin+sofőr címzett generalizálása
```sql
ALTER TABLE push_feliratkozasok
  ADD COLUMN felhasznalo_tipus ENUM('admin','sofor') NOT NULL DEFAULT 'admin' AFTER id,
  CHANGE COLUMN admin_id felhasznalo_id INT NOT NULL,
  DROP INDEX idx_admin,
  ADD INDEX idx_felhasznalo (felhasznalo_tipus, felhasznalo_id);
```
Ugyanaz a `felhasznalo_tipus`/`felhasznalo_id` pár-minta, mint `beerkezett_dokumentumok.
feltolto_tipus`/`feltolto_id`-nál — konzisztens a kódbázis már meglévő konvenciójával, nem új
mintát vezet be. A meglévő admin-feliratkozások migrálásakor `felhasznalo_tipus='admin'`
alapértelmezés (DB-szinten) biztosítja, hogy a régi sorok érvényben maradjanak módosítás
nélkül.

### 4.4 `beerkezett_dokumentumok` — érintetlenül marad
A tábla a DB-ben marad (nem drop-oljuk), csak a rá épülő alkalmazás-kód szűnik meg — ugyanaz
a konvenció, mint a korábbi `fuvarok`/Fuvartervező-kivezetésnél (`ugyfelek.fizetesi_hatarido_
nap` is így maradt, majd később vissza is hozták egy más funkcióhoz).

## 5. Backend API

### 5.1 Sofőr-oldali fuvar-lekérdezések (`FuvarInterface`)
- **`getSajatFuvarok($sofor_id, $ceg_id, $aktivOnly)`** — `WHERE sofor_id = :sofor_id AND
  admin = :ceg_id AND torolt <> 'I'`, `$aktivOnly` esetén `AND dokumentum_feltoltve IS NULL
  AND allapot <> 'teljesitve'`. Csak a sofőr számára releváns, operatív mezőket adja vissza
  (útvonal, dátum, jármű-rendszám, megbízó neve) — nem a teljes admin-nézetet (nincs
  fuvardíj/egyéb költség/számlaszám a válaszban).
- **`getSajatFuvar($id, $sofor_id, $ceg_id)`** — egyetlen fuvar, `sofor_id` egyezés-
  ellenőrzéssel (ha nem az övé, `success:false` — ugyanaz az IDOR-védelmi minta, mint
  `torolSajatBeerkezettDokumentum`-nál).
- **`allitDokumentumFeltoltve($fuvarId, $ceg_id)`** — `UPDATE fuvarok SET
  dokumentum_feltoltve = NOW() WHERE id = :id AND admin = :ceg_id AND
  dokumentum_feltoltve IS NULL` — csak az első feltöltéskor ténylegesen ír.

### 5.2 Új action: `feltoltFuvarDokumentumot` (sofőr-only)
A meglévő, általános `FilesInterface::fileUpload()` **önmagában NEM ellenőrzi**, hogy a
kliens által küldött `rowid` (itt: fuvar id) ténylegesen a hívó sofőréhez tartozik-e — csak
céges (`ceg_id`) szintű szűrést végez (ugyanaz a minta, amit ma is használ pl. a
Bejelentés-mellékleteknél). Egy fuvarhoz kötött feltöltésnél ez kevés: egy sofőr ne tudjon
egy MÁSIK sofőr fuvarjához fotót csatolni, még ugyanannál a cégnél sem. Ezért ez egy
**dedikált action**, nem a generikus `fileUpload` közvetlen kiterjesztése:

1. `resolveSajatSoforId($request)` — sosem kliens-mezőből.
2. `FuvarInterface::getSajatFuvar($fuvarId, $soforId, $cegId)` — ha nem talál (nem az övé
   vagy nem létezik), `success:false`, nincs feltöltés.
3. `FilesInterface::fileUpload($ceg_id, 'fuvar', $fuvarId, ..., $cimkek = $tipus)` —
   `$tipus` csak `'menetlevel'`/`'szallitolevel'` lehet, egyéb érték elutasítva.
4. Siker esetén, ha `$tipus === 'menetlevel'`: `FuvarInterface::allitDokumentumFeltoltve()`.

**`torolSajatFuvarDokumentumot($fajlId, $soforId, $cegId)`** — ugyanaz az ownership-minta
(a fájl `tabla='fuvar'`-hoz tartozó `rowid` fuvarnak `sofor_id`-je egyezzen a hívóval), a
meglévő fájl-törlés hívása mögé rakva. **Nem állítja vissza `dokumentum_feltoltve`-t NULL-ra**
akkor sem, ha az épp törölt fotó volt az egyetlen menetlevél-kép — ha egyszer lezárult a
fuvar a sofőr szemszögéből, egy utólagos törlés nem "nyitja vissza" automatikusan (az admin
úgyis látja a mellékleteket, és a fuvar `allapot`-ja külön él ettől).

### 5.3 Nincs automatikus `allapot`-váltás
A `dokumentum_feltoltve` stemplizése **nem** ír a `fuvarok.allapot` mezőbe. Ugyanaz az elv,
amit a Bank-egyeztetésnél is követtünk (CLAUDE.md: "tudatosan nincs automatikus
állapotváltás... csak jelezzünk, ne írjunk automatikusan az adatba") — az `allapot`
munkafolyamat (`rogzitett` → ... → `teljesitve`) továbbra is kizárólag admin kézi váltása.

### 5.4 Push-küldés fuvar-hozzárendeléskor
`ApiHandler`-ben, `newFuvar`/`updateFuvar` case-ekben, sikeres válasz után:
- `newFuvar`: ha `$result['fuvar']['sofor_id']` nem üres → `sendPushSofornak()`.
- `updateFuvar`: az `UPDATE` előtt lekérdezett **régi** `sofor_id` és az új `$request['sofor_id']`
  összevetése — csak akkor küld, ha ténylegesen **változott** ÉS az új érték nem üres (a
  korábbi sofőr, akit leváltottak, nem kap semmit — ld. jóváhagyott döntés).

Üzenet: cím `"Új fuvar érkezett"`, szöveg `"{felrako} → {lerako} · {teljesites_datuma}"`,
url `"/user/fuvarReszletek?id={fuvar id}"`.

### 5.5 Push-infrastruktúra generalizálása (`PushInterface`)
`saveFeliratkozas`/`deleteFeliratkozas`/`vanFeliratkozva`/`sendPushAdminnak` szignatúrája
kiegészül egy `$felhasznaloTipus` paraméterrel (alapértelmezetten `'admin'`, visszafelé
kompatibilis a meglévő admin-hívásokkal). Új publikus metódus: **`sendPushSofornak($sofor_id,
$cim, $szoveg, $url)`** — ugyanaz a logika, mint `sendPushAdminnak()`, csak
`felhasznalo_tipus='sofor'` szűréssel.

`ApiHandler`: `savePushFeliratkozas`/`deletePushFeliratkozas`/`getPushStatusz` jelenleg
`resolveKerelmezo()`-t hívnak (kizárólag admin-munkamenet) — ez a három action mostantól egy
**új, mindkét szerepkört kezelő helper** (`resolveSajatFelhasznalo($request)`, ami
`[tipus, id]`-t ad vissza `resolveSajatCegId()`-hez hasonló, session-alapú módon) alapján
dolgozik, `MODULE_PERMISSION_MAP`-bejegyzés nélkül (ugyanaz a tanulság, amit a korábbi
`elemezBeerkezettDokumentum`-nál is megtanultunk ebben a projektben: egy dual-role actionnek
NEM szabad `MODULE_PERMISSION_MAP`-ban szerepelnie, mert `requirePermission()` a `validation()`
lépésben admin-only `resolveKerelmezo()`-t hívna, még mielőtt a case-ág eldönthetné, melyik
szerepkörről van szó).

## 6. Sofőr-oldali frontend

### 6.1 Navigáció
- **`BottomNav.js`**: a középső FAB célja `/user/bejelentes/uj` → `/user/fuvarok`, ikonja
  `PiWarningCircleLight/Fill` → `PiTruckLight/Fill` (vagy hasonló jármű-ikon), label
  "Bejelentés" → "Fuvarok". A Bejelentés item **kikerül** a BottomNav-ból (a te választásod
  alapján) — a Bejelentés funkció ettől még elérhető marad a Dashboard "Legutóbbi
  bejelentéseim" során és a `/user/bejelentesek` oldalon, csak nem lesz többé egy-érintéses
  a navigáció alsó sávjából.
- **`layouts/User.js`**: két új route — `/user/fuvarok` (`Fuvarok.js`) és
  `/user/fuvarReszletek` (`FuvarReszletek.js`). A `/user/dokumentum-feltoltes` route +
  `DokumentumFeltoltes.js` törlésre kerül. `desktopLinks` kap egy "Fuvarjaim" bejegyzést.

### 6.2 `Dashboard.js`
A jelenlegi, kiemelt "Dokumentum feltöltése" brand-kártya helyén (közvetlenül az Aktív
jármű 3-oszlopos rács után) ezentúl az **"Aktív fuvarjaim"** szekció áll: max. ~3 aktív
fuvar kompakt soronként (útvonal, dátum, jármű-rendszám), mindegyik a `FuvarReszletek`-re
mutat (`history.push` state-tel, gyors út — nincs extra lekérdezés), üres állapot "Nincs
aktív fuvarod", és ha 3-nál több van, egy "Összes fuvarod (N)" link a teljes listára. A
"Legutóbbi bejelentéseim" sor **változatlan marad** (ugyanaz a kis, összegző stílus, ugyanott
— egyszerű csere-nélküli döntés, ld. jóváhagyott válaszod).

### 6.3 `Fuvarok.js` (sofőr-oldali lista)
`Bejelentesek.js` mintáját követi: két fül, "Aktívak" (alapértelmezett) és "Lezártak" (ahol
`dokumentum_feltoltve IS NOT NULL OR allapot = 'teljesitve'`). Soronként útvonal, dátum,
jármű, "Dokumentum ✓"/"Menetlevél hiányzik" jelzés — tap → `FuvarReszletek`.

### 6.4 `FuvarReszletek.js`
Read-only operatív adatok (útvonal, dátum, jármű, áru megnevezése, megjegyzés, megbízó
neve — **nem** fuvardíj/egyéb költség/számlaszám/állapot, ezek admin-oldali pénzügyi
mezők). `location.state?.data` gyors út a listáról navigálva; ha hiányzik (pl. push-
értesítésből, közvetlen URL-lel érkezve), `?id=` query paraméter alapján `getSajatFuvar()`
hívás. Két feltöltő szekció, a régi `DokumentumFeltoltes.js` kamera-feltöltő UI-ját
újrahasznosítva (fájlválasztás/kamera, bélyegkép-sor, törlés-gomb soronként):
- **Menetlevél** (kötelező jelöléssel, több kép engedélyezett).
- **Szállítólevél** (opcionális jelöléssel, több kép engedélyezett).

Mindkét szekció a `feltoltFuvarDokumentumot`/`torolSajatFuvarDokumentumot` actionöket hívja
a megfelelő `tipus` paraméterrel.

### 6.5 Push-feliratkozás a sofőr oldalon
`<PushFeliratkozas />` bekötve `Profil.js`-re (ugyanaz a komponens, amit ma az admin
`Settings.js` már használ — a backend-generalizálás után, ld. 5.5, működik mindkét
szerepkörből ugyanazzal a kliens-kóddal, módosítás nélkül).

## 7. Admin-oldali frontend

- **`Fuvarok.js`/`FuvarForm.js`**: "Dokumentum ✓" jelvény, ha `dokumentum_feltoltve` nem
  `null` (lista + részletek), semleges (`neutral`/`positive` tónus, nem `warning` — pusztán
  informatív, nem akcióra ösztönző jelzés, ld. CLAUDE.md szemantikus szín-szabálya).
- **`FuvarForm.js`**: az OCR-előtöltő `useEffect` (`getFuvarEgyeztetesJavaslat` hívás) és a
  `dokumentumId`/`ocrAdatok` kezelés törlődik — mindig üres/kézi "Új fuvar" form, mert
  dokumentum-first útvonal többé nincs.

## 8. Extra ötletek (jóváhagyás nélkül, csak javaslatként)

- **Emlékeztető push, ha a sofőr nem töltött fel semmit**: napi cron (ugyanaz a minta, mint
  `gpsmart_km_cache_frissites.php`), ami push-ot küld minden olyan sofőrnek, akinek van
  aktív fuvarja, aminek `teljesites_datuma`-ja már elmúlt, de `dokumentum_feltoltve` még
  `NULL`.
- **Admin-push feltöltéskor**: amikor a sofőr feltölti a menetlevelet,
  `sendPushAdminnak()`-kal a fuvarszervező is értesítést kap ("X sofőr feltöltötte a
  menetlevelet") — szimmetrikus visszajelzés, a meglévő admin-push infrastruktúrával.
- **"Fuvar duplikálása"**: egy gomb, ami egy meglévő fuvar legtöbb mezőjét (megbízó, útvonal,
  jármű) átmásolja egy új, dátum nélküli fuvarba — ismétlődő útvonalaknál gyorsítja az admin
  munkáját.
- **Több sofőrös fuvarok**: tudatos nem-cél ebben a fázisban, csak jelezve, hogy `sofor_id`
  egyetlen mező marad.

## 9. Tesztelési terv

- **DB-migráció**: `backend/sql/N.sql` (a legutóbbi commitolt szám ellenőrzése után) —
  `dokumentum_feltoltve` oszlop + `push_feliratkozasok` átalakítás, helyi DB-n lefuttatva,
  `SHOW COLUMNS` ellenőrzéssel (ld. a korábbi `CREATE TABLE IF NOT EXISTS`-gotcha tanulsága).
- **Backend**: élő teszt helyi DB-n — (a) `newFuvar` sofőrrel → push ténylegesen elmegy-e
  (VAPID-kulcs nélküli dev környezetben ez `sendPushSofornak()` néma no-op-ja, ELLENŐRIZNI
  kell, hogy legalább a `push_feliratkozasok` lekérdezés/logika helyesen fut le); (b)
  `feltoltFuvarDokumentumot` más sofőr fuvarjára → elutasítás; (c) `getSajatFuvarok` aktív/
  lezárt szűrés helyessége mindkét lezárási úton (dokumentum-feltöltés ÉS admin
  `teljesitve`-váltás).
- **Frontend**: Playwright — sofőr-munkamenettel végigvitel: admin fuvart hoz létre →
  sofőr Dashboard-ján megjelenik az "Aktív fuvarjaim" közt → megnyitja, feltölt egy
  menetlevél-képet → visszatérve a Dashboardra/Fuvarok listára a fuvar már nincs az aktívak
  közt, de megjelenik a "Lezártak" fülön.
- Mindkét réteg tesztelése kötelező a CLAUDE.md "Szerver oldali módosítások kritikus
  tesztelése" szabálya szerint — statikus kód-olvasás nem elég.

## 10. Nyitott kérdések / kockázatok

- **BottomNav FAB-csere UX-kockázata**: a Bejelentés eddig dokumentáltan az egyetlen mindig,
  egy kézzel, gondolkodás nélkül elérhető funkció volt (vezetés közbeni vészjelzés-forgatókönyv).
  A FAB Fuvarokra cserélése ezt a tulajdonságot elveszi a Bejelentéstől. Ez a te explicit
  döntésed volt ebben a menetben — csak dokumentálva, hogy tudatos trade-off, nem
  véletlen mellékhatás.
- **Push megbízhatósága offline/gyenge lefedettségű sofőröknél**: a Web Push a böngésző/OS
  push-szolgáltatásán (FCM) megy át — ha a sofőr telefonja hosszabb ideig offline, a push
  később (vagy soha) érkezik meg; a Fuvarok lista ettől függetlenül mindig megbízható,
  push-mentes fallback.
