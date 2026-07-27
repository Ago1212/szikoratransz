# Fuvar-dokumentum OCR — aszinkron feldolgozás

## Cél

A `beerkezett_dokumentumok` OCR-feldolgozása (`BeerkezettDokumentumInterface::elemez()`)
ma **szinkron**: a `elemezBeerkezettDokumentum` API-hívás a fájl feltöltése
UTÁN megvárja a Gemini OCR válaszát (dokumentáltan ~3-13 másodperc, néha több
egy rate-limit-retry miatt — ld. CLAUDE.md "Gemini OCR-integráció" szakasza),
és csak ekkor tér vissza. Ez alatt a sofőr feltöltő oldala (`DokumentumFeltoltes.js`)
és az admin bulk-feltöltése (`BeerkezettDokumentumok.js`) is blokkolva vár.

Cél: a feltöltés (fájl mentése + `beerkezett_dokumentumok` sor létrehozása)
azonnal visszatérjen, a tényleges OCR pedig a háttérben fusson le — a sofőr
(elsődleges fókusz) azonnal lássa, hogy a feltöltés sikeres volt, és
kiléphessen az oldalról; az admin ugyanígy azonnali visszajelzést kapjon a
feltöltés sikerességéről a bulk-feltöltő sávban.

**Kifejezetten NEM cél ebben a körben** (felhasználói döntés): cron-alapú
biztonsági háló a háttérfolyamat esetleges elakadására — ehelyett egy kézi
"Újrapróbálás" admin-akció fedezi ezt az esetet.

## Jelenlegi állapot (amiből kiindulunk)

`BeerkezettDokumentumInterface::elemez($base64, $fajlnev, $ceg_id, ...)`
(`backend/interface/beerkezettDokumentumInterface.php:27`) egy metódusban
végzi: base64-dekódolás → PDF esetén `pdftoppm` konverzió → MIME-detekció →
**szinkron** `GeminiOcrClient::extractFuvarAdatok()` hívás → `mentesEredmennyel()`
(fájl feltöltése `filesInterface->fileUpload()`-dal + `INSERT INTO
beerkezett_dokumentumok` `ocr_allapot` = `'kesz'`/`'hiba'`-val, közvetlenül a
végleges állapottal). A `'feldolgozatlan'` (a tábla `DEFAULT` értéke) ma
sosem kerül ténylegesen beírásra — csak séma-alapértelmezésként létezik.

Ezt hívja `ApiHandler.php`-ban az `elemezBeerkezettDokumentum` case (mindkét
munkamenet-típusból hívható, `MODULE_PERMISSION_MAP`-ból tudatosan
kihagyva — ld. CLAUDE.md).

## Megoldás áttekintése

Az `elemez()` két fázisra bomlik:

- **A fázis — szinkron, a HTTP-kérésben marad**: fájl feltöltése
  (`filesInterface->fileUpload()`, változatlan) + egy
  `beerkezett_dokumentumok` sor beszúrása `ocr_allapot = 'feldolgozatlan'`,
  `tipus = 'ismeretlen'`, `ocr_adatok = NULL`, `hozzarendelt_sofor_id = NULL`
  értékekkel. Nincs Gemini-hívás, nincs PDF-konverzió sem — ez a fázis a
  jelenlegi válaszidő töredéke.
- **B fázis — aszinkron, egy külön, elszakított (detached) PHP-processzben**:
  egy új CLI-script (`backend/cli/ocr_feldolgozas.php`) tölti be az adott
  sort, elvégzi a PDF→PNG konverziót (ha kell) + a Gemini-hívást, majd
  `UPDATE`-eli a sort a végeredménnyel (`tipus`, `ocr_allapot`, `ocr_adatok`,
  `hozzarendelt_sofor_id`).

Az A fázis végén `ApiHandler.php` indítja el a B fázist egy fire-and-forget
`exec()` hívással, majd — anélkül, hogy megvárná — azonnal visszatér a
`'feldolgozatlan'` sorral. Ez a mechanizmus a helyi dev környezetben
(egyszálas `php8.2 -S` beépített szerver) is kritikus: ha az OCR a kérésen
belül futna, blokkolna minden más párhuzamos kérést, amíg a Gemini válaszol.

**Elfogadott, dokumentált korlát**: ha `exec()` le van tiltva a
production PHP-hoston (`disable_functions`), vagy a spawnolt processz
valamiért elhal a válasz elküldése után, a sor `'feldolgozatlan'`-on
ragadhat — ezt a kézi "Újrapróbálás" admin-akció oldja fel (nincs
automatikus cron-tartalék ebben a körben, ld. "Cél" fent).

## Backend

### `backend/interface/beerkezettDokumentumInterface.php`

**`elemez()` megszűnik**, helyette két metódus:

- **`letrehozFeldolgozatlan($base64, $fajlnev, $ceg_id, $feltoltoTipus, $feltoltoId, $feltoltoNev)`**
  — a mai `elemez()` eleje (base64-dekódolás validáció) + `mentesEredmennyel()`
  fájl-feltöltő és `INSERT` fele, de **`ocr_allapot='feldolgozatlan'`**-lal,
  `tipus='ismeretlen'`-nel, `ocr_adatok=NULL`-lal, `hozzarendelt_sofor_id=NULL`-lal
  — a mai kód sofőr-név-alapú auto-hozzárendelése (`keresSoforNevAlapjan`)
  ide még nem fut le (nincs még OCR-eredmény). Visszaadja a létrehozott sor
  `id`-ját (ez kell a B fázis elindításához) + a `'feldolgozatlan'` állapotú
  dokumentum-objektumot, ugyanabban az alakban, mint eddig.
- **`dolgozzFel($dokumentumId)`** — a mai `elemez()` OCR-elvégző fele: betölti
  a sort (`fajl_id`, `admin`), a fizikai fájlt közvetlenül a `fajlok.hely`
  oszlopból olvassa (`file_get_contents`, nem a base64-kódoló
  `downloadFile()`-on át — az felesleges kódolási kör lenne), PDF esetén
  ugyanazt a `pdfElsoOldalKepe()` konverziót futtatja, mint eddig, majd
  `GeminiOcrClient::extractFuvarAdatok()`-ot hívja. Sikeres válasznál
  lefuttatja a meglévő `keresSoforNevAlapjan()` auto-hozzárendelést is.
  Végül **`UPDATE beerkezett_dokumentumok SET tipus=..., ocr_allapot=...,
  ocr_adatok=..., hozzarendelt_sofor_id=... WHERE id=:id`**.
  **Az egész metódus törzse try/catch-ben** — bármilyen kivétel (hálózati
  hiba, hiányzó Gemini-kulcs, `pdftoppm` hiba) `ocr_allapot='hiba'`-ra
  állítja a sort, sosem hagyja `'feldolgozatlan'`-on egy elszállt hívás
  után. `error_log()`-ol diagnosztikai céllal.
- **`ujraprobal($id, $ceg_id)`** — admin-akcióhoz: ellenőrzi, hogy a sor
  létezik és a hívó cégéhez tartozik, visszaállítja `ocr_allapot='feldolgozatlan'`-ra,
  majd (az `ApiHandler`-en keresztül) újra elindítja a B fázist ugyanazzal a
  fire-and-forget spawn-nal.

### `backend/cli/ocr_feldolgozas.php` (új fájl)

A meglévő `backend/cron/lejarat_emlekezteto.php` bootstrap-mintáját követi:

```php
<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Forbidden'); }

require __DIR__ . '/../db.php';
require __DIR__ . '/../config.php';
require __DIR__ . '/../interface/beerkezettDokumentumInterface.php';

$dokumentumId = (int) ($argv[1] ?? 0);
if ($dokumentumId <= 0) {
    fwrite(STDERR, "Hiányzó vagy érvénytelen dokumentum id.\n");
    exit(1);
}

$beerkezettDokumentumInterface->dolgozzFel($dokumentumId);
```

Nem `backend/cron/`-ba kerül, mert nem időszakosan, crontabból hívott job,
hanem eseményvezérelt (minden feltöltés/újrapróbálás egy saját, önálló
futtatást indít) — külön `backend/cli/` könyvtár jelzi ezt a különbséget.
Ugyanaz a `PHP_SAPI !== 'cli'` védelem vonatkozik rá, mint a `cron/`
scriptekre (a `backend/` a webroot alatt van, HTTP-n közvetlenül nem
hívható).

### `backend/ApiHandler.php`

- **`elemezBeerkezettDokumentum` case**: `letrehozFeldolgozatlan(...)`
  hívása → az új `inditsBackgroundOcr($dokumentumId)` privát helper
  meghívása → azonnali `echo json_encode(...)` a `'feldolgozatlan'` sorral.
- **`inditsBackgroundOcr($dokumentumId)`** (privát helper):
  ```php
  $php = PHP_BINARY ?: 'php8.2';
  $script = escapeshellarg(__DIR__ . '/cli/ocr_feldolgozas.php');
  $id = (int) $dokumentumId;
  exec("nohup $php $script $id > /dev/null 2>&1 &");
  ```
- **Új `ujraprobalBeerkezettDokumentumOcr` action** (`getActions()`:
  `['id']`, admin-only session, `resolveSajatCegId`/admin-session
  ellenőrzéssel — ez már NEM sofőr-hívható, csak admin review-panelből):
  hívja `ujraprobal($id, ceg_id)`-t, majd `inditsBackgroundOcr($id)`-t,
  visszaadja a frissített (`'feldolgozatlan'`) sort.

Séma-változás **nincs** — a `beerkezett_dokumentumok.ocr_allapot ENUM`
már tartalmazza a `'feldolgozatlan'` értéket, csak eddig nem használtuk
ténylegesen.

## Frontend

### `src/views/user/DokumentumFeltoltes.js` (elsődleges fókusz)

- `handleFileChange` mostantól csak a gyors `elemezBeerkezettDokumentum`
  válaszra vár (feltöltés + sor létrehozás, nincs OCR-várakozás) —
  `uploading` állapot jóval rövidebb ideig aktív.
- A "Ez néhány másodpercig eltarthat, ne zárd be az oldalt" figyelmeztető
  szöveg **törlődik** (a kommentben dokumentált indoka megszűnik érvényesnek
  lenni).
- A sikeres toast szövege: **"Sikeresen feltöltve! A feldolgozás a
  háttérben folytatódik, kiléphetsz."**
- A "Korábbi feltöltéseim" lista (`elozmeny`) már ma is helyesen jeleníti
  meg az `OCR_STATUSZ_LABEL`/`OCR_STATUSZ_TONE` alapján a `feldolgozatlan`
  állapotot (`StatusBadge tone="info"`, "Feldolgozás alatt") — ez eddig
  gyakorlatilag halott ág volt, mostantól valódi, néhány másodpercig
  látható állapot lesz.
- **Új, korlátozott automatikus frissítés**: amíg `elozmeny`-ben van
  `ocr_allapot === 'feldolgozatlan'` sor, egy `setInterval` 4 másodpercenként
  újrahívja `betoltElozmeny()`-t, legfeljebb ~15 alkalommal (~1 perc) —
  utána leáll, hogy egy nyitva hagyott böngészőfül ne pollozzon
  a végtelenségig. Amint egy sor `kesz`/`hiba`-ra vált, a jelvény
  automatikusan frissül, ha a sofőr a képernyőn marad; ha bezárja az
  oldalt, a háttér-OCR attól függetlenül lefut, csak a jelvény nem
  frissül élőben.

### `src/views/admin/BeerkezettDokumentumok.js`

- `handleFilesSelected`: a `t.progress >= 100` utáni "OCR feldolgozás..."
  pörgő szöveg + a kapcsolódos toast-elágazás (`ocr_allapot === "kesz"` vs.
  nem) megszűnik — a válasz mindig gyors, mindig `'feldolgozatlan'`.
  Új toast szöveg: **"X.pdf: feltöltve, a feldolgozás a háttérben
  folytatódik."**
- **Kézi "Frissítés" gomb** kerül a lista fölé (a szűrősor mellé) — a
  felhasználó explicit döntése alapján nincs automatikus poll ezen az
  oldalon, csak kézi újralekérdezés (`load()`).

### `src/components/Fuvarok/DokumentumKartya.js`

**Valódi vizuális hiba, amit ez a redesign ténylegessé tesz**: a kártya ma
csak `hibas` (amber, figyelmeztető ikon) vs. minden más (emerald, pipa ikon)
között különböztet — egy `feldolgozatlan` dokumentum ma zöld pipával,
"sikeres" stílusban jelenne meg "Feldolgozás alatt" felirat mellett, ami
félrevezető. Eddig ez nem számított, mert a `'feldolgozatlan'` állapot
gyakorlatilag sosem fordult elő éles adatban — az aszinkron átállás után ez
minden feltöltésnél néhány másodpercig valós állapot lesz. Fix: a
`hibas`/emerald bináris helyett egy 3-állapotú elágazás
(`feldolgozatlan` → semleges/kék, pörgő ikon; `kesz` → emerald, pipa;
`hiba` → amber, figyelmeztető ikon), a kártya keretszíne is követi ezt.

### `src/components/Fuvarok/DokumentumReviewPanel.js`

- Ha `dokumentum.ocr_allapot !== 'kesz'` (azaz `feldolgozatlan` vagy
  `hiba`): egy figyelmeztető sáv jelenik meg a panel tetején
  ("Az OCR feldolgozás még nem fejeződött be." / "Az automatikus
  feldolgozás sikertelen volt.") + egy **"Újrapróbálás"** gomb, ami
  meghívja `ujraprobalBeerkezettDokumentumOcr`-t, toast visszajelzéssel
  ("Újraindítva — frissítsd a listát néhány másodperc múlva."). A
  "Fuvar létrehozása"/"Csatolás meglévő fuvarhoz" gombok ilyenkor is
  elérhetők maradnak (nem tiltjuk le) — az admin dönthet úgy, hogy kézzel
  tölti ki az adatokat ahelyett, hogy várna az újrapróbálásra.

## Adatáramlás

```
DokumentumFeltoltes.js / BeerkezettDokumentumok.js
    ──elemezBeerkezettDokumentum──> ApiHandler
        → letrehozFeldolgozatlan()  [gyors: fájl + sor, ocr_allapot='feldolgozatlan']
        → inditsBackgroundOcr()     [exec fire-and-forget]
    <── azonnali válasz (feldolgozatlan sor) ──

  (háttérben, a válasz elküldése után)
  backend/cli/ocr_feldolgozas.php <id>
        → dolgozzFel($id)  [PDF-konverzió + Gemini + UPDATE ocr_allapot='kesz'|'hiba']

DokumentumFeltoltes.js ──getSajatBeerkezettDokumentumok (poll, max 15×4mp)──> frissülő állapot
BeerkezettDokumentumok.js ──getBeerkezettDokumentumok (kézi "Frissítés")──> frissülő állapot
DokumentumReviewPanel.js ──ujraprobalBeerkezettDokumentumOcr──> ApiHandler
        → ujraprobal()  [ocr_allapot vissza 'feldolgozatlan'-ra]
        → inditsBackgroundOcr()  [újra elindítja a B fázist]
```

## Hibakezelés / szélsőértékek

- **`dolgozzFel()` bármilyen kivétele** (Gemini hálózati hiba, hiányzó API
  kulcs, `pdftoppm` hiba, DB-hiba a betöltésnél) → `ocr_allapot='hiba'`,
  sosem marad `'feldolgozatlan'`-on egy elszállt futás után.
- **`exec()` letiltva / a spawn nem indul el** → a sor `'feldolgozatlan'`-on
  ragad, amíg admin rá nem kattint az "Újrapróbálás"-ra a review-panelben.
  Ez egy tudatosan elfogadott, dokumentált korlát ebben a körben (nincs
  cron-tartalék).
- **Egyszerre több feltöltés** (admin bulk-feltöltés, sofőr egyesével) —
  minden feltöltés saját, önálló `exec()`-processzt indít; nincs közös
  várólista/sorbaállítás, mert a volumen (kisflottás cégek, néhány
  dokumentum naponta) ezt nem indokolja. Egy időben több párhuzamosan futó
  `ocr_feldolgozas.php` processz nem ütközik (mindegyik a saját sorát
  UPDATE-eli, más sorhoz nem nyúl).
- **Duplikált "Újrapróbálás" kattintás** — mindegyik újraindít egy saját
  háttérfolyamatot ugyanarra a sorra; a végén mindegyik ugyanazt a sort
  írja felül a saját (valószínűleg hasonló) eredményével — nincs zárolás,
  de ez ártalmatlan (nem duplikálja a sort, csak feleslegesen többször
  hívja a Gemini API-t egy szándékos, ritka admin-kattintásnál).

## Tesztelés

Élőben, helyi `sessions` táblába szúrt admin- és sofőr-munkamenettel,
Playwright-tal:
- Sofőr feltölt egy dokumentumot → a válasz <1 másodperc alatt megérkezik,
  azonnal "Sikeresen feltöltve..." toast, a lista `feldolgozatlan` jelvényt
  mutat → néhány másodperc múlva (a max. 1 perces poll-ablakon belül) a
  jelvény automatikusan `kesz`/`hiba`-ra vált, anélkül hogy az oldalt
  újra kellene tölteni.
- Admin bulk-feltölt 2-3 fájlt → mindegyik gyorsan visszatér
  `feldolgozatlan`-nal, a "Frissítés" gombra kattintva a lista mutatja a
  közben lefutott OCR-eredményeket.
- `DokumentumKartya.js` mindhárom állapotot (`feldolgozatlan`/`kesz`/`hiba`)
  vizuálisan megkülönbözteti (kézzel beszúrt teszt-sorral is ellenőrizve,
  nem csak a valós, gyorsan lezajló átmenettel).
- `dolgozzFel()` hibaágának tesztelése: érvénytelen/üres Gemini-kulcs
  mellett futtatva a CLI-scriptet, a sor ténylegesen `'hiba'`-ra vált,
  nem marad `'feldolgozatlan'`-on.
- "Újrapróbálás" gomb: egy `hiba` állapotú teszt-sornál rákattintva a sor
  visszaáll `feldolgozatlan`-ra, majd (a háttérfolyamat lefutása után)
  ismét `kesz`/`hiba`-ra.
- A teszt-adatok (feltöltött fájlok, `beerkezett_dokumentumok` sorok,
  ideiglenes admin/sofőr/session) utána törölve lesznek.
