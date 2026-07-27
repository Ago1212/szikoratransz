# Fuvar-dokumentum OCR aszinkron feldolgozás — implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `beerkezett_dokumentumok` OCR-feldolgozását (Gemini-hívás) leválasztani a feltöltési HTTP-kérésről, hogy a sofőr/admin azonnal (kb. 1 másodpercen belül) visszajelzést kapjon a sikeres feltöltésről és kiléphessen, míg az OCR egy külön, elszakított PHP-processzben fut a háttérben.

**Architecture:** `BeerkezettDokumentumInterface::elemez()` két metódusra bomlik — `letrehozFeldolgozatlan()` (gyors: fájl-feltöltés + sor létrehozása `ocr_allapot='feldolgozatlan'`-lal) és `dolgozzFel()` (lassú: PDF-konverzió + Gemini-hívás + `UPDATE`). `ApiHandler.php` a válasz elküldése előtt egy `exec("nohup php8.2 backend/cli/ocr_feldolgozas.php <id> &")` fire-and-forget hívással elindítja a háttérfeldolgozást. A frontend (sofőr + admin oldal) ennek megfelelően azonnali visszajelzést ad, a státusz-jelvények és egy admin-oldali "Újrapróbálás" akció kezelik a hosszabb ideig `feldolgozatlan`/`hiba` állapotban maradó sorokat.

**Tech Stack:** PHP 8.2 (nincs composer-függőség, nincs automatizált teszt-keretrendszer), React (CRA), MySQL/MariaDB (PDO). Nincs cron-alapú biztonsági háló ebben a körben (felhasználói döntés) — a robusztusságot a kézi "Újrapróbálás" admin-akció adja.

## Global Constraints

- Nincs séma-változás — a `beerkezett_dokumentumok.ocr_allapot` ENUM már tartalmazza a `'feldolgozatlan'` értéket.
- A projekt saját SQL-lintere tiltja a `JOIN`/`UNION`-t — minden több-táblás lekérdezés két külön `SELECT` + PHP-oldali összefésülés.
- Nincs automatizált PHP/JS teszt-keretrendszer ebben a repóban — minden ellenőrzés `php8.2 -l` (lint) + tényleges, élő futtatás (CLI/curl/Playwright), a CLAUDE.md "Szerver oldali módosítások kritikus tesztelése" szabálya szerint.
- Tailwind: minden új osztály bevezetése után `npm run build:tailwind` kötelező, különben a böngészőben nem lesz jelen a stílus.
- Csak akkor commitolj, ha a lépés önmagában is működő állapotot hagy hátra (a repo aktuálisan tiszta, `git status`-t minden commit előtt/után ellenőrizni).
- Teszt-adatokat (DB-sorok, feltöltött fizikai fájlok, session-ök) minden élő ellenőrzés után törölni kell.

---

### Task 1: `beerkezettDokumentumInterface.php` — `elemez()` szétbontása

**Files:**
- Modify: `backend/interface/beerkezettDokumentumInterface.php:27-194`

**Interfaces:**
- Produces: `letrehozFeldolgozatlan($base64, $fajlnev, $ceg_id, $feltoltoTipus, $feltoltoId, $feltoltoNev): array` (`{success, dokumentum:{id, fajl_id, tipus, ocr_allapot, ocr_adatok, hozzarendelt_sofor_id}}` vagy `{success:false, message}`), `dolgozzFel($dokumentumId): void`, `ujraprobal($id, $ceg_id): array` (`{success, message}`). Ezeket Task 3 (ApiHandler.php) és Task 2 (CLI script) fogja hívni.
- Consumes: a meglévő privát helperek — `kepMimeTipusa()`, `pdfElsoOldalKepe()`, `sajatCegnev()`, `keresSoforNevAlapjan()` — VÁLTOZATLANOK maradnak, ez a task csak a fájl 27-194. sorát cseréli.

- [ ] **Step 1: A jelenlegi `elemez()`/`mentesEredmennyel()` blokk cseréje**

A fájl **27. sorától a 194. soráig** (a `public function elemez(...)` kezdetétől a `mentesEredmennyel()` metódus záró `}`-jéig, a köztük lévő `kepMimeTipusa()`/`pdfElsoOldalKepe()`/`sajatCegnev()` metódusok VÁLTOZATLANOK, csak az `elemez()`+`mentesEredmennyel()` páros cserélődik) az alábbi négy metódusra:

```php
    // A feltöltés MINDIG gyors — az OCR (Gemini-hívás) a háttérben, egy
    // külön processzben fut le (ld. dolgozzFel() lentebb és
    // backend/cli/ocr_feldolgozas.php), hogy a sofőr/admin ne várjon
    // 3-13+ másodpercet a válaszra. Ez a metódus csak a fájlt tölti fel és
    // létrehozza a sort 'feldolgozatlan' állapotban — semmilyen OCR-hívás
    // nincs benne.
    public function letrehozFeldolgozatlan($base64, $fajlnev, $ceg_id, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface;

        $raw = base64_decode((string) $base64, true);
        if ($raw === false || $raw === '') {
            return ['success' => false, 'message' => 'A feltöltött fájl nem érvényes.'];
        }

        $nev = $fajlnev ?: 'beerkezett_dokumentum';
        $feltoltEredmeny = $filesInterface->fileUpload($ceg_id, 'beerkezett_dokumentum', $ceg_id, $base64, $nev, strlen($raw), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
        if (empty($feltoltEredmeny['success'])) {
            return ['success' => false, 'message' => $feltoltEredmeny['message'] ?? 'A fájl mentése sikertelen.'];
        }
        $fajlId = $feltoltEredmeny['id'];

        $stmt = $this->db->prepare(
            "INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, ocr_adatok, feltolto_tipus, feltolto_id, feltolto_nev, hozzarendelt_sofor_id)
             VALUES (:admin, :fajl_id, 'ismeretlen', 'feldolgozatlan', NULL, :feltolto_tipus, :feltolto_id, :feltolto_nev, NULL)"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':fajl_id', $fajlId, PDO::PARAM_INT);
        $stmt->bindValue(':feltolto_tipus', $feltoltoTipus);
        $stmt->bindValue(':feltolto_id', $feltoltoId);
        $stmt->bindValue(':feltolto_nev', $feltoltoNev);
        $stmt->execute();

        $dokumentumId = $this->db->lastInsertId();
        return ['success' => true, 'dokumentum' => [
            'id' => (int) $dokumentumId,
            'fajl_id' => (int) $fajlId,
            'tipus' => 'ismeretlen',
            'ocr_allapot' => 'feldolgozatlan',
            'ocr_adatok' => null,
            'hozzarendelt_sofor_id' => null,
        ]];
    }

    // Ezt a metódust a HTTP-kéréstől függetlenül, egy külön, elszakított
    // PHP-processz hívja (backend/cli/ocr_feldolgozas.php) — SOSEM a
    // letrehozFeldolgozatlan()-t kiszolgáló kérésen belül. A fizikai fájlt
    // közvetlenül a `fajlok.hely` oszlopból olvassuk (a projekt saját
    // SQL-lintere miatt JOIN nélkül, két külön lekérdezéssel, ugyanaz a
    // minta, mint fajlnevekFeloldasa()-nál), nem a base64-kódoló
    // filesInterface::downloadFile()-on át, ami felesleges kódolási kör
    // lenne. Az egész törzs try/catch-ben: bármilyen kivétel (hálózati
    // hiba, hiányzó Gemini-kulcs, pdftoppm hiba) 'hiba' állapotra állítja a
    // sort — SOSEM maradhat 'feldolgozatlan'-on egy elszállt hívás után.
    public function dolgozzFel($dokumentumId) {
        global $apiConfig;

        $stmt = $this->db->prepare(
            "SELECT id, admin, fajl_id FROM beerkezett_dokumentumok WHERE id = :id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $dokumentumId, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($sor === false) {
            return;
        }

        $fajlStmt = $this->db->prepare("SELECT hely, filename FROM fajlok WHERE sorszam = :sorszam");
        $fajlStmt->bindValue(':sorszam', $sor['fajl_id'], PDO::PARAM_INT);
        $fajlStmt->execute();
        $fajl = $fajlStmt->fetch(PDO::FETCH_ASSOC);
        if ($fajl === false || !file_exists($fajl['hely'])) {
            $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
            return;
        }

        $tmpKepPath = null;
        try {
            $kiterjesztes = strtolower(pathinfo((string) $fajl['filename'], PATHINFO_EXTENSION));

            if ($kiterjesztes === 'pdf') {
                $tmpKepPath = $this->pdfElsoOldalKepe($fajl['hely']);
                if ($tmpKepPath === null) {
                    $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
                    return;
                }
                $kepBytes = file_get_contents($tmpKepPath);
                $kepMime = 'image/png';
            } else {
                $kepBytes = file_get_contents($fajl['hely']);
                $kepMime = $this->kepMimeTipusa($kepBytes, $kiterjesztes);
            }

            $sajatCegnev = $this->sajatCegnev($sor['admin']);
            $geminiKulcsok = $apiConfig['geminiApiKeys'] ?? [];

            $adatok = null;
            if (!empty($geminiKulcsok)) {
                $client = new GeminiOcrClient($geminiKulcsok);
                $adatok = $client->extractFuvarAdatok($kepBytes, $kepMime, $sajatCegnev);
            }

            if ($adatok === null) {
                $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
                return;
            }

            $tipus = $adatok['tipus'] ?? 'ismeretlen';
            if (!in_array($tipus, ['fuvarlevel', 'szallitolevel', 'ismeretlen'], true)) {
                $tipus = 'ismeretlen';
            }

            $hozzarendeltSoforId = null;
            if (!empty($adatok['sofor_neve'])) {
                $hozzarendeltSoforId = $this->keresSoforNevAlapjan($sor['admin'], $adatok['sofor_neve']);
            }

            $this->frissitAllapot($dokumentumId, 'kesz', $tipus, $adatok, $hozzarendeltSoforId);
        } catch (\Throwable $e) {
            error_log('BeerkezettDokumentumInterface::dolgozzFel hiba (id=' . $dokumentumId . '): ' . $e->getMessage());
            $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
        } finally {
            if ($tmpKepPath !== null && file_exists($tmpKepPath)) {
                unlink($tmpKepPath);
            }
        }
    }

    private function frissitAllapot($id, $ocrAllapot, $tipus, $adatok, $hozzarendeltSoforId) {
        $stmt = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok
             SET tipus = :tipus, ocr_allapot = :ocr_allapot, ocr_adatok = :ocr_adatok, hozzarendelt_sofor_id = :hozzarendelt_sofor_id
             WHERE id = :id"
        );
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':ocr_allapot', $ocrAllapot);
        $stmt->bindValue(':ocr_adatok', $adatok !== null ? json_encode($adatok, JSON_UNESCAPED_UNICODE) : null);
        $stmt->bindValue(':hozzarendelt_sofor_id', $hozzarendeltSoforId, $hozzarendeltSoforId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
    }

    // Admin-akció (review-panel "Újrapróbálás" gomb) — visszaállítja a sort
    // 'feldolgozatlan'-ra, az ApiHandler ez után egy új háttérfolyamatot
    // indít (dolgozzFel() ugyanígy fut le, mint az első feltöltésnél).
    public function ujraprobal($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id FROM beerkezett_dokumentumok WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        if ($stmt->fetch(PDO::FETCH_ASSOC) === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }

        $update = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok SET ocr_allapot = 'feldolgozatlan', ocr_adatok = NULL WHERE id = :id AND admin = :admin"
        );
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $update->execute();

        return ['success' => true, 'message' => 'Újrafeldolgozás elindítva.'];
    }
```

Ellenőrzés: a fájlban ez után `kepMimeTipusa()` (a régi 92. sortól) következzen közvetlenül, változatlanul.

- [ ] **Step 2: Lint-ellenőrzés**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: Élő smoke-teszt közvetlen PHP CLI-vel (HTTP nélkül)**

Hozz létre egy ideiglenes szkriptet, ami a két új metódust végigfuttatja egy valós, kis képfájllal, a valós admin=1 ("Szikora Transz Kft.") cégen:

```bash
cd /home/psadmin/szikoratransz/szikoratransz/backend
php8.2 -r '
require "db.php";
require "config.php";
require "interface/filesInterface.php";
require "interface/beerkezettDokumentumInterface.php";

$base64 = base64_encode(file_get_contents("../public/logo192.png"));
$eredmeny = $beerkezettDokumentumInterface->letrehozFeldolgozatlan($base64, "teszt.png", 1, "admin", 1, "Teszt Admin");
var_dump($eredmeny);
if (!empty($eredmeny["success"])) {
    $beerkezettDokumentumInterface->dolgozzFel($eredmeny["dokumentum"]["id"]);
    $ellenorzo = (new Database())->connect()->query("SELECT ocr_allapot, tipus FROM beerkezett_dokumentumok WHERE id = " . (int) $eredmeny["dokumentum"]["id"])->fetch(PDO::FETCH_ASSOC);
    var_dump($ellenorzo);
}
'
```

Expected: az első `var_dump` `success: true`, `ocr_allapot: "feldolgozatlan"`-t mutat; a `dolgozzFel()` hívás után a második `var_dump` `ocr_allapot`-ja **`kesz` vagy `hiba`** (logo192.png nem fuvarlevél, ezért valószínűleg `hiba` vagy egy `ismeretlen` típusú `kesz` — mindkettő elfogadható, a lényeg hogy **nem maradt `feldolgozatlan`-on**).

- [ ] **Step 4: Teszt-adatok törlése**

```bash
mysql -uroot kamion -e "DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.feltolto_nev = 'Teszt Admin' AND bd.letrehozva > NOW() - INTERVAL 1 HOUR;"
```
(Ez a törlő JOIN önmagában nem a projekt élő SQL-lintere alá eső alkalmazás-kódban fut, csak egy egyszeri kézi takarítás — nem kell két lekérdezésre bontani.) Majd ellenőrizd `backend/files/`-ben, hogy a fizikai fájl is törlődött-e (a `hely` oszlop értéke alapján, a fenti `DELETE` előtt jegyezd fel), és ha nem, `rm` -eld kézzel.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php
git commit -m "refactor: split beerkezett dokumentum OCR into fast insert + background feldolgozas"
```

---

### Task 2: `backend/cli/ocr_feldolgozas.php` — háttér-feldolgozó CLI-script

**Files:**
- Create: `backend/cli/ocr_feldolgozas.php`

**Interfaces:**
- Consumes: `BeerkezettDokumentumInterface::dolgozzFel($dokumentumId)` (Task 1).
- Produces: egy önállóan futtatható CLI-script, amit Task 3-ban az `ApiHandler::inditsBackgroundOcr()` fog `exec()`-kel elindítani, argv[1]-ként a dokumentum id-t átadva.

- [ ] **Step 1: A könyvtár és a script létrehozása**

```bash
mkdir -p /home/psadmin/szikoratransz/szikoratransz/backend/cli
```

`backend/cli/ocr_feldolgozas.php` tartalma:

```php
<?php

// Háttérben, a HTTP-kérés lezárása UTÁN, egy külön, `exec("nohup ... &")`-
// pal indított processzben fut — ld.
// docs/superpowers/specs/2026-07-27-fuvar-ocr-aszinkron-design.md.
// NEM `backend/cron/`-ba tartozik: nem crontabból, időszakosan hívott job,
// hanem eseményvezérelt — minden feltöltés/"Újrapróbálás" a saját, önálló
// futtatását indítja (ApiHandler::inditsBackgroundOcr()). Ugyanaz a
// `PHP_SAPI !== 'cli'` védelem vonatkozik rá, mint a cron/ scriptekre — a
// `backend/` a webroot alatt van, HTTP-n közvetlenül nem hívható.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

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

- [ ] **Step 2: Lint-ellenőrzés**

Run: `php8.2 -l backend/cli/ocr_feldolgozas.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: HTTP-védelem ellenőrzése**

Run:
```bash
cd /home/psadmin/szikoratransz/szikoratransz/backend && php8.2 -S localhost:8091 -t . &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091/cli/ocr_feldolgozas.php
kill %1
```
Expected: `403`

- [ ] **Step 4: Élő CLI-futtatás egy valódi sorral**

```bash
cd /home/psadmin/szikoratransz/szikoratransz/backend
php8.2 -r '
require "db.php";
require "interface/filesInterface.php";
require "interface/beerkezettDokumentumInterface.php";
$base64 = base64_encode(file_get_contents("../public/logo192.png"));
$eredmeny = $beerkezettDokumentumInterface->letrehozFeldolgozatlan($base64, "teszt.png", 1, "admin", 1, "Teszt Admin CLI");
echo $eredmeny["dokumentum"]["id"], "\n";
'
```
Jegyezd fel a kiírt id-t (pl. `42`), majd:
```bash
php8.2 backend/cli/ocr_feldolgozas.php 42
mysql -uroot kamion -e "SELECT ocr_allapot, tipus FROM beerkezett_dokumentumok WHERE id = 42;"
```
Expected: `ocr_allapot` **nem** `feldolgozatlan` (hanem `kesz` vagy `hiba`).

- [ ] **Step 5: Teszt-adatok törlése**

```bash
mysql -uroot kamion -e "DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.feltolto_nev = 'Teszt Admin CLI' AND bd.letrehozva > NOW() - INTERVAL 1 HOUR;"
```
Ellenőrizd `backend/files/`-ben, hogy a fizikai fájl is törlődött-e (a `hely` oszlop értéke alapján, a fenti `DELETE` előtt jegyezd fel), és ha nem, `rm` -eld kézzel.

- [ ] **Step 6: Commit**

```bash
git add backend/cli/ocr_feldolgozas.php
git commit -m "feat: add background CLI processor for beerkezett dokumentum OCR"
```

---

### Task 3: `ApiHandler.php` — fire-and-forget indítás + "Újrapróbálás" action

**Files:**
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `BeerkezettDokumentumInterface::letrehozFeldolgozatlan()`, `::ujraprobal()` (Task 1); `backend/cli/ocr_feldolgozas.php` (Task 2).
- Produces: az `elemezBeerkezettDokumentum` action mostantól gyorsan tér vissza `'feldolgozatlan'` sorral; új `ujraprobalBeerkezettDokumentumOcr` action.

- [ ] **Step 1: `getActions()` bővítése**

A `backend/ApiHandler.php` 370. sora (`'torolBeerkezettDokumentum' => ['id', 'ceg_id'],`) UTÁN, a 371. sor (`'getSajatBeerkezettDokumentumok' => ['sofor_id'],`) ELÉ szúrd be:

```php
            'ujraprobalBeerkezettDokumentumOcr' => ['id', 'ceg_id'],
```

- [ ] **Step 2: `MODULE_PERMISSION_MAP` bővítése**

A 142. sor (`'torolBeerkezettDokumentum' => ['fuvarok', 'torles'],`) UTÁN, a 143. sor (`'newFuvar' => ['fuvarok', 'szerkesztes'],`) ELÉ szúrd be:

```php
        'ujraprobalBeerkezettDokumentumOcr' => ['fuvarok', 'szerkesztes'],
```

- [ ] **Step 3: `elemezBeerkezettDokumentum` case átírása**

Cseréld le a jelenlegi (1675-1687. sor) case-ágat:

```php
                case 'elemezBeerkezettDokumentum':
                    // Ezt az akciót MIND az admin-oldali beérkezett-dokumentum
                    // inbox (Task 12), MIND a sofőr-oldali fuvarlevél-feltöltő
                    // oldal (Task 15) hívja — resolveKerelmezo() admin-only,
                    // ledobná minden sofőr-munkamenetet, ezért itt (a modul
                    // többi, sofőr számára is elérhető akciójához hasonlóan,
                    // ld. fileUpload/getHelyszinek/stb.) resolveSajatCegId()-t
                    // használunk, ami MINDKÉT munkamenet-típusnál a valódi,
                    // szerver-oldalon feloldott ceg_id-t adja vissza.
                    $cegId = $this->resolveSajatCegId($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($beerkezettDokumentumInterface->elemez($request['base64'], $request['fajlnev'] ?? null, $cegId, $feltoltoTipus, $feltoltoId, $feltoltoNev));
                    return;
```

erre:

```php
                case 'elemezBeerkezettDokumentum':
                    // Ezt az akciót MIND az admin-oldali beérkezett-dokumentum
                    // inbox, MIND a sofőr-oldali fuvarlevél-feltöltő oldal
                    // hívja — resolveKerelmezo() admin-only, ledobná minden
                    // sofőr-munkamenetet, ezért itt (a modul többi, sofőr
                    // számára is elérhető akciójához hasonlóan, ld.
                    // fileUpload/getHelyszinek/stb.) resolveSajatCegId()-t
                    // használunk, ami MINDKÉT munkamenet-típusnál a valódi,
                    // szerver-oldalon feloldott ceg_id-t adja vissza.
                    //
                    // A válasz MINDIG gyors — csak a feltöltés+sor létrehozás
                    // történik itt (letrehozFeldolgozatlan()), a tényleges OCR
                    // egy külön, elszakított processzben fut (ld.
                    // inditsBackgroundOcr() lentebb és
                    // docs/superpowers/specs/2026-07-27-fuvar-ocr-aszinkron-design.md).
                    $cegId = $this->resolveSajatCegId($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    $eredmeny = $beerkezettDokumentumInterface->letrehozFeldolgozatlan($request['base64'], $request['fajlnev'] ?? null, $cegId, $feltoltoTipus, $feltoltoId, $feltoltoNev);
                    if (!empty($eredmeny['success'])) {
                        $this->inditsBackgroundOcr($eredmeny['dokumentum']['id']);
                    }
                    echo json_encode($eredmeny);
                    return;
```

- [ ] **Step 4: Új `ujraprobalBeerkezettDokumentumOcr` case**

A `torolBeerkezettDokumentum` case (jelenleg 1716-1723. sor) UTÁN, a `getSajatBeerkezettDokumentumok` case ELÉ szúrd be:

```php
                case 'ujraprobalBeerkezettDokumentumOcr':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $eredmeny = $beerkezettDokumentumInterface->ujraprobal($request['id'], $kerelmezo['ceg_id']);
                    if (!empty($eredmeny['success'])) {
                        $this->inditsBackgroundOcr($request['id']);
                    }
                    echo json_encode($eredmeny);
                    return;
```

- [ ] **Step 5: `inditsBackgroundOcr()` privát helper hozzáadása**

A `resolveFeltolto()` metódus (656. sor záró `}`) UTÁN, a `requireAdminRole()` metódus ELÉ szúrd be:

```php
    // Fire-and-forget: egy külön, elszakított PHP-processzt indít, ami a
    // háttérben elvégzi az adott beérkezett dokumentum OCR-feldolgozását
    // (BeerkezettDokumentumInterface::dolgozzFel()) — ld.
    // docs/superpowers/specs/2026-07-27-fuvar-ocr-aszinkron-design.md. A
    // `nohup ... &` mintázat miatt az exec() azonnal visszatér, nem várja
    // meg a gyerekfolyamat befejezését — ez a helyi, egyszálas
    // `php8.2 -S` dev szerveren is kritikus, különben egy OCR-hívás
    // blokkolna minden más egyidejű kérést.
    private function inditsBackgroundOcr($dokumentumId) {
        $php = PHP_BINARY ?: 'php8.2';
        $script = escapeshellarg(__DIR__ . '/cli/ocr_feldolgozas.php');
        $id = (int) $dokumentumId;
        exec("nohup $php $script $id > /dev/null 2>&1 &");
    }

```

- [ ] **Step 6: Lint-ellenőrzés**

Run: `php8.2 -l backend/ApiHandler.php`
Expected: `No syntax errors detected`

- [ ] **Step 7: Élő végpont-teszt curl-lal — a válasz gyors, és a háttérfolyamat ténylegesen lefut**

Indíts egy ideiglenes dev szervert és hozz létre egy ideiglenes admin=1 session-t:

```bash
cd /home/psadmin/szikoratransz/szikoratransz/backend
php8.2 -S localhost:8092 -t . &
sleep 1

mysql -uroot kamion -e "INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES ('teszt-token-ocr-async', 'admin', 1, NOW() + INTERVAL 1 HOUR);"

BASE64=$(base64 -w0 ../public/logo192.png)
START=$(date +%s%N)
RESPONSE=$(curl -s -X POST http://localhost:8092/api.php \
  -H "Content-Type: application/json" \
  -d "{\"authHash\":\"nIrINP&o!PU|+pM*Q8'j1R07U57W,qD\",\"action\":\"elemezBeerkezettDokumentum\",\"sessionToken\":\"teszt-token-ocr-async\",\"ceg_id\":1,\"kerelmezo_id\":1,\"base64\":\"$BASE64\",\"fajlnev\":\"teszt-curl.png\"}")
END=$(date +%s%N)
echo "Válaszidő (ms): $(( (END - START) / 1000000 ))"
echo "$RESPONSE"
```

Expected: a válaszidő **1000 ms alatt** van, a JSON válasz `"ocr_allapot":"feldolgozatlan"`-t tartalmaz. Jegyezd fel a válaszban lévő `id`-t (pl. `43`).

Néhány másodperc múlva (a Gemini-hívás dokumentáltan 3-13 mp):
```bash
sleep 15
mysql -uroot kamion -e "SELECT ocr_allapot FROM beerkezett_dokumentumok WHERE id = 43;"
```
Expected: `ocr_allapot` **nem** `feldolgozatlan` — a háttérfolyamat ténylegesen lefutott és frissítette a sort, annak ellenére, hogy a curl-kérés már rég visszatért.

Zárd le a dev szervert: `kill %1`

- [ ] **Step 8: "Újrapróbálás" action tesztelése**

```bash
mysql -uroot kamion -e "UPDATE beerkezett_dokumentumok SET ocr_allapot = 'hiba' WHERE id = 43;"
cd /home/psadmin/szikoratransz/szikoratransz/backend
php8.2 -S localhost:8092 -t . &
sleep 1
curl -s -X POST http://localhost:8092/api.php \
  -H "Content-Type: application/json" \
  -d "{\"authHash\":\"nIrINP&o!PU|+pM*Q8'j1R07U57W,qD\",\"action\":\"ujraprobalBeerkezettDokumentumOcr\",\"sessionToken\":\"teszt-token-ocr-async\",\"ceg_id\":1,\"kerelmezo_id\":1,\"id\":43}"
sleep 10
mysql -uroot kamion -e "SELECT ocr_allapot FROM beerkezett_dokumentumok WHERE id = 43;"
kill %1
```
Expected: az `ujraprobalBeerkezettDokumentumOcr` válasza `success:true`, majd 10 mp múlva `ocr_allapot` ismét `kesz`/`hiba` (nem ragadt `feldolgozatlan`-on).

- [ ] **Step 9: Teszt-adatok törlése**

```bash
mysql -uroot kamion -e "
DELETE FROM sessions WHERE token = 'teszt-token-ocr-async';
DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.feltolto_nev LIKE 'Teszt%' AND bd.letrehozva > NOW() - INTERVAL 1 HOUR;
"
```
Ellenőrizd `backend/files/`-ben, hogy a fizikai fájlok is törlődtek-e, ha nem, `rm` -eld kézzel (a `hely` oszlop értéke alapján, a fenti `DELETE` előtt lekérdezve).

- [ ] **Step 10: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "feat: spawn background OCR processing from elemezBeerkezettDokumentum, add retry action"
```

---

### Task 4: Sofőr oldal — `src/views/user/DokumentumFeltoltes.js`

**Files:**
- Modify: `src/views/user/DokumentumFeltoltes.js`

**Interfaces:**
- Consumes: `elemezBeerkezettDokumentum` (mostantól gyors válasz, Task 3), `getSajatBeerkezettDokumentumok` (változatlan).

- [ ] **Step 1: A "ne zárd be az oldalt" figyelmeztetés eltávolítása + a feltöltő-gomb szövegének pontosítása**

Cseréld le:
```jsx
        <span className="text-sm font-semibold text-ink-700">
          {uploading ? "Feldolgozás folyamatban…" : "Fotó készítése / kiválasztása"}
        </span>
        {/* A feltöltés maga gyors, de a szerver ezután egy Gemini OCR-hívást
            futtat a képen (dokumentáltan ~3-13 másodperc, néha több egy
            rate-limit-retry miatt) — enélkül a szöveg nélkül a sofőr úgy
            látná, mintha a feltöltés elakadt volna. */}
        {uploading && <span className="text-xs text-ink-400">Ez néhány másodpercig eltarthat, ne zárd be az oldalt.</span>}
```
erre:
```jsx
        <span className="text-sm font-semibold text-ink-700">
          {uploading ? "Feltöltés…" : "Fotó készítése / kiválasztása"}
        </span>
```

- [ ] **Step 2: Toast szöveg pontosítása**

Cseréld le:
```jsx
      if (result?.success) {
        toast.success("Dokumentum feltöltve, az admin fogja feldolgozni.");
        betoltElozmeny();
```
erre:
```jsx
      if (result?.success) {
        toast.success("Sikeresen feltöltve! A feldolgozás a háttérben folytatódik, kiléphetsz.");
        betoltElozmeny();
```

- [ ] **Step 3: Korlátozott automatikus frissítés hozzáadása**

Az `import` blokk tetején, `useState` mellé bővítsd a react importot (már importálva van `useCallback, useEffect, useRef, useState` — ellenőrizd, `useRef` már szerepel). A `betoltElozmeny` definíciója UTÁN, a meglévő
```jsx
  useEffect(() => {
    betoltElozmeny();
  }, [betoltElozmeny]);
```
blokk UTÁN szúrd be az alábbi új blokkot:

```jsx
  const pollSzamlalo = useRef(0);
  const POLL_KOZ_MS = 4000;
  const POLL_MAX_SZAMLALO = 15;

  useEffect(() => {
    const vanFeldolgozatlan = elozmeny.some((d) => d.ocr_allapot === "feldolgozatlan");
    if (!vanFeldolgozatlan) {
      pollSzamlalo.current = 0;
      return undefined;
    }
    if (pollSzamlalo.current >= POLL_MAX_SZAMLALO) {
      return undefined;
    }
    const idozito = setTimeout(() => {
      pollSzamlalo.current += 1;
      betoltElozmeny();
    }, POLL_KOZ_MS);
    return () => clearTimeout(idozito);
  }, [elozmeny, betoltElozmeny]);
```

(`POLL_KOZ_MS`/`POLL_MAX_SZAMLALO` a komponensen belüli konstansok — nem globális modul-szintű konstans, mert nincs rá szükség máshol, és a Task 1-4 kódstílushoz így illik jobban, a `pollSzamlalo` ref-fel egy blokkban.)

- [ ] **Step 4: Tailwind-rebuild (nem használtunk új osztályt, de ellenőrzésképp)**

Nem vezettünk be új Tailwind-osztályt ebben a taskban — `npm run build:tailwind` nem szükséges.

- [ ] **Step 5: Élő ellenőrzés Playwright-tal**

Szúrj be egy sofőr-típusú session-t a helyi `sessions` táblába egy valós `user` sorhoz, navigálj `/user/dokumentum-feltoltes`-re, tölts fel egy képet, és ellenőrizd:
- A toast szövege "Sikeresen feltöltve! A feldolgozás a háttérben folytatódik, kiléphetsz."
- A "Korábbi feltöltéseim" listában azonnal megjelenik egy "Feldolgozás alatt" jelvényű sor.
- Néhány másodperc múlva (a lapon maradva) a jelvény automatikusan "Feldolgozva"/"Hiba – admin pótolja"-ra vált, anélkül hogy manuálisan frissítenéd az oldalt.

A teszt-session törlése:
```bash
mysql -uroot kamion -e "DELETE FROM sessions WHERE felhasznalo_tipus = 'sofor' AND token = '<a Step 5-ben létrehozott token>';"
```
A teszt-dokumentum (DB-sor + fizikai fájl) törlése:
```bash
mysql -uroot kamion -e "DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.id = <a feltöltött dokumentum id-je>;"
```
(A `hely` oszlop értékét a `DELETE` előtt jegyezd fel, és ha a fizikai fájl `backend/files/`-ben megmaradt, `rm` -eld kézzel.)

- [ ] **Step 6: Commit**

```bash
git add src/views/user/DokumentumFeltoltes.js
git commit -m "feat: reflect async OCR feedback on driver upload page"
```

---

### Task 5: Admin oldal — `src/views/admin/BeerkezettDokumentumok.js`

**Files:**
- Modify: `src/views/admin/BeerkezettDokumentumok.js`

**Interfaces:**
- Consumes: `elemezBeerkezettDokumentum` (Task 3), `getBeerkezettDokumentumok` (változatlan).

- [ ] **Step 1: A feltöltési sáv OCR-váró szövegének/spinnerének egyszerűsítése**

Cseréld le:
```jsx
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="truncate">{t.nev}</span>
                  {/* `t.progress` az XHR feltöltés (upload) haladása — 100%-nál a
                      kérés bájtjai elhagyták a böngészőt, de a szerver ekkor még
                      csak most kezdi a Gemini OCR-hívást (dokumentáltan ~3-13
                      másodperc, esetenként több egy rate-limit-retry miatt) —
                      enélkül a jelzés nélkül a felhasználó egy teljesen tele,
                      mégis mozdulatlan sávot látott volna, ami leállt/elakadt
                      feltöltésnek tűnhet. */}
                  {t.progress < 100 ? (
                    <span className="flex-shrink-0">{t.progress}%</span>
                  ) : (
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-brand-600 dark:text-brand-400">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-900 dark:border-t-brand-400" />
                      OCR feldolgozás...
                    </span>
                  )}
                </div>
```
erre:
```jsx
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="truncate">{t.nev}</span>
                  <span className="flex-shrink-0">{t.progress}%</span>
                </div>
```

- [ ] **Step 2: Toast szöveg pontosítása (nincs több `ocr_allapot === "kesz"` elágazás)**

Cseréld le:
```jsx
        if (result?.success) {
          toast.success(
            result.dokumentum.ocr_allapot === "kesz"
              ? `${file.name}: feldolgozva.`
              : `${file.name}: feltöltve, de az automatikus feldolgozás sikertelen — töltsd ki kézzel.`,
          );
        } else {
```
erre:
```jsx
        if (result?.success) {
          toast.success(`${file.name}: feltöltve, a feldolgozás a háttérben folytatódik.`);
        } else {
```

- [ ] **Step 3: Kézi "Frissítés" gomb hozzáadása**

Az importok közé vedd fel a frissítés-ikont: cseréld le
```jsx
import { PiUploadLight, PiMagnifyingGlassLight } from "react-icons/pi";
```
erre:
```jsx
import { PiUploadLight, PiMagnifyingGlassLight, PiArrowsClockwiseLight } from "react-icons/pi";
```

A fülváltó sáv (`<div className="mb-4 flex gap-2 rounded-full bg-slate-100 p-1 dark:bg-ink-800">...</div>`) UTÁN, a feltöltő doboz (`<div className="mb-4 rounded-2xl border border-dashed ...">`) ELÉ szúrd be:

```jsx
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <PiArrowsClockwiseLight className="h-4 w-4" />
          Frissítés
        </button>
      </div>
```

- [ ] **Step 4: Lint/build ellenőrzés**

`PiArrowsClockwiseLight` egy meglévő `react-icons/pi` ikon (a `Pi*Light` konvenciót követi, amit a fájl már használ máshol is) — nincs szükség Tailwind-rebuildre (nem vezettünk be új osztályt).

- [ ] **Step 5: Élő ellenőrzés Playwright-tal**

Admin-session-nel navigálj `/admin/beerkezettDokumentumok`-ra, tölts fel 1-2 fájlt a bulk-feltöltővel, ellenőrizd:
- A toast szövege "X: feltöltve, a feldolgozás a háttérben folytatódik." (nincs "OCR feldolgozás..." szöveg sehol).
- A "Frissítés" gomb megjelenik és kattintásra újra lekéri a listát.

A teszt-adatok törlése:
```bash
mysql -uroot kamion -e "DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.feltolto_tipus = 'admin' AND bd.letrehozva > NOW() - INTERVAL 1 HOUR;"
```
(A `hely` oszlop értékeit a `DELETE` előtt jegyezd fel, és a `backend/files/`-ben megmaradt fizikai fájlokat `rm` -eld kézzel.)

- [ ] **Step 6: Commit**

```bash
git add src/views/admin/BeerkezettDokumentumok.js
git commit -m "feat: async-friendly upload feedback and manual refresh on admin inbox"
```

---

### Task 6: `src/components/Fuvarok/DokumentumKartya.js` — 3-állapotú vizuális megkülönböztetés

**Files:**
- Modify: `src/components/Fuvarok/DokumentumKartya.js`

**Interfaces:**
- Consumes: `dokumentum.ocr_allapot` (`'feldolgozatlan' | 'kesz' | 'hiba'`).

**Valódi hiba, amit ez a task javít**: a kártya ma csak `hibas` (amber) vs. minden más (emerald, pipa ikon) között különböztet — egy `feldolgozatlan` dokumentum ma zöld pipával, "sikeres" stílusban jelenne meg "Feldolgozás alatt" felirat mellett.

- [ ] **Step 1: A komponens törzsének átírása**

Cseréld le a teljes fájl 19-95. sorát (a `export default function DokumentumKartya(...)` kezdetétől a záró `}`-ig — az `OCR_ALLAPOT_LABEL`/`isKepFajlnev` fejléc-rész VÁLTOZATLAN marad):

```jsx
export default function DokumentumKartya({ dokumentum, onOpen }) {
  const isKep = isKepFajlnev(dokumentum.filename);
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const thumbRef = useRef(null);
  const hibas = dokumentum.ocr_allapot === "hiba";
  const feldolgozatlan = dokumentum.ocr_allapot === "feldolgozatlan";

  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = thumbRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        fetchAction("downloadFile", { id: dokumentum.fajl_id })
          .then((result) => {
            if (result?.success && result.mime?.startsWith("image/")) {
              setThumbSrc(`data:${result.mime};base64,${result.file}`);
            } else {
              setThumbHiba(true);
            }
          })
          .catch(() => setThumbHiba(true));
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKep, dokumentum.fajl_id]);

  return (
    <button
      type="button"
      ref={thumbRef}
      onClick={() => onOpen(dokumentum)}
      className={`flex w-full flex-col rounded-2xl border bg-white p-3 text-left shadow-soft transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg dark:bg-ink-900 ${
        hibas
          ? "border-amber-300 dark:border-amber-700"
          : feldolgozatlan
            ? "border-sky-200 dark:border-sky-800"
            : "border-ink-100 dark:border-ink-800"
      }`}
    >
      <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-ink-800">
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={dokumentum.filename} className="h-full w-full object-cover" />
        ) : isKep && !thumbHiba ? (
          <div className="h-6 w-6 animate-pulse rounded-full bg-violet-200 motion-reduce:animate-none dark:bg-violet-900" />
        ) : isKep ? (
          <PiFileTextLight className="h-9 w-9 text-ink-400" />
        ) : (
          <PiFilePdfLight className="h-9 w-9 text-red-500" />
        )}
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-ink-500 dark:text-ink-300">
          {dokumentum.filename}
        </span>
        <span
          className={`flex flex-shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
            hibas
              ? "text-amber-600 dark:text-amber-400"
              : feldolgozatlan
                ? "text-sky-600 dark:text-sky-400"
                : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hibas ? (
            <PiWarningCircleLight className="h-3.5 w-3.5" />
          ) : feldolgozatlan ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 dark:border-sky-900 dark:border-t-sky-400" />
          ) : (
            <PiCheckCircleLight className="h-3.5 w-3.5" />
          )}
          {OCR_ALLAPOT_LABEL[dokumentum.ocr_allapot]}
        </span>
      </div>

      {dokumentum.ocr_adatok && (
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
          {[dokumentum.ocr_adatok.felrako, dokumentum.ocr_adatok.lerako].filter(Boolean).join(" → ") ||
            dokumentum.ocr_adatok.megbizo ||
            "—"}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Tailwind-rebuild**

Új osztályok kerültek be (`border-sky-200`, `dark:border-sky-800`, `text-sky-600`, `dark:text-sky-400`, `border-sky-900`, `dark:border-t-sky-400`) — ezek korábban sehol nem szerepeltek a kódbázisban (ellenőrizd: `grep -c "border-sky-200" src/assets/styles/tailwind.css` — ha `0`, futtasd a rebuildet).

Run: `npm run build:tailwind`

- [ ] **Step 3: Élő ellenőrzés Playwright-tal**

Szúrj be kézzel egy `feldolgozatlan` állapotú teszt-sort (a hozzá tartozó `fajlok` sorral együtt, a fizikai fájlnak nem kell ténylegesen léteznie — a kártya PDF-ikont fog mutatni, nem próbál thumbnailt letölteni):

```bash
mysql -uroot kamion -e "
INSERT INTO fajlok (admin, tabla, rowid, hely, filename, filesize, feltoltve, feltolto_tipus, feltolto_id, feltolto_nev, fajl_kategoria)
VALUES (1, 'beerkezett_dokumentum', 1, '/tmp/teszt-vizualis-nem-letezo.pdf', 'teszt-vizualis.pdf', 100, NOW(), 'admin', 1, 'Teszt Vizualis', 'pdf');
SET @fajl_id = LAST_INSERT_ID();
INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, feltolto_tipus, feltolto_id, feltolto_nev)
VALUES (1, @fajl_id, 'ismeretlen', 'feldolgozatlan', 'admin', 1, 'Teszt Vizualis');
SELECT @fajl_id AS fajl_id, LAST_INSERT_ID() AS dokumentum_id;
"
```

Navigálj `/admin/beerkezettDokumentumok`-ra, és `getComputedStyle`-lal/screenshottal ellenőrizd, hogy a kártya kék/semleges (nem zöld pipa) stílust kap, pörgő ikonnal, "Feldolgozás alatt" felirattal — light ÉS dark módban is.

Teszt-sor törlése utána:
```bash
mysql -uroot kamion -e "DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.feltolto_nev = 'Teszt Vizualis';"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Fuvarok/DokumentumKartya.js
npm run build:tailwind
git add src/assets/styles/tailwind.css
git commit -m "fix: distinct visual state for feldolgozatlan documents on inbox card"
```

---

### Task 7: `src/components/Fuvarok/DokumentumReviewPanel.js` — "Újrapróbálás" gomb

**Files:**
- Modify: `src/components/Fuvarok/DokumentumReviewPanel.js`

**Interfaces:**
- Consumes: új `ujraprobalBeerkezettDokumentumOcr` action (Task 3).

- [ ] **Step 1: Állapot + handler hozzáadása**

A `discarding` state UTÁN szúrd be:
```jsx
  const [discarding, setDiscarding] = useState(false);
```
```jsx
  const [discarding, setDiscarding] = useState(false);
  const [ujraprobalasFolyamatban, setUjraprobalasFolyamatban] = useState(false);
```

A `handleElvetes` függvény UTÁN (a `};` után, `const bizonytalan = ...` sor ELÉ) szúrd be:

```jsx
  const handleUjraprobalas = async () => {
    setUjraprobalasFolyamatban(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("ujraprobalBeerkezettDokumentumOcr", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      id: dokumentum.id,
    });
    setUjraprobalasFolyamatban(false);
    if (result?.success) {
      toast.success("Újrafeldolgozás elindítva — frissítsd a listát néhány másodperc múlva.");
    } else {
      toast.error(result?.message || "Az újrapróbálás sikertelen.");
    }
  };

```

- [ ] **Step 2: Figyelmeztető sáv + gomb beszúrása a JSX-be**

Az `<ElonezetKep .../>` sor UTÁN, a `<div className="mt-4 space-y-3">` ELÉ szúrd be:

```jsx
      {dokumentum.ocr_allapot !== "kesz" && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <PiWarningCircleLight className="h-4 w-4 flex-shrink-0" />
            {dokumentum.ocr_allapot === "feldolgozatlan"
              ? "Az OCR feldolgozás még nem fejeződött be."
              : "Az automatikus feldolgozás sikertelen volt."}
          </span>
          <button
            type="button"
            onClick={handleUjraprobalas}
            disabled={ujraprobalasFolyamatban}
            className="flex-shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-700 shadow-soft hover:bg-amber-100 disabled:opacity-50 dark:bg-ink-900 dark:text-amber-300 dark:hover:bg-ink-800"
          >
            Újrapróbálás
          </button>
        </div>
      )}
```

- [ ] **Step 3: Tailwind-rebuild ellenőrzés**

Az itt használt osztályok (`bg-amber-50`, `text-amber-700`, `dark:bg-amber-950/40`, `dark:text-amber-300`, `bg-white`, `shadow-soft`, `hover:bg-amber-100`, `dark:bg-ink-900`, `dark:hover:bg-ink-800`) már használatban vannak máshol a fájlban/kódbázisban (pl. a `bizonytalan` figyelmeztető sáv ugyanezt az amber-paletta-mintát használja) — valószínűleg nincs szükség rebuildre, de ellenőrizd: `grep -c "bg-amber-50" src/assets/styles/tailwind.css`. Ha `0`, futtasd: `npm run build:tailwind`.

- [ ] **Step 4: Élő ellenőrzés Playwright-tal**

Szúrj be kézzel egy `hiba` állapotú teszt-sort:

```bash
mysql -uroot kamion -e "
INSERT INTO fajlok (admin, tabla, rowid, hely, filename, filesize, feltoltve, feltolto_tipus, feltolto_id, feltolto_nev, fajl_kategoria)
VALUES (1, 'beerkezett_dokumentum', 1, '/tmp/teszt-retry-nem-letezo.pdf', 'teszt-retry.pdf', 100, NOW(), 'admin', 1, 'Teszt Retry', 'pdf');
SET @fajl_id = LAST_INSERT_ID();
INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, feltolto_tipus, feltolto_id, feltolto_nev)
VALUES (1, @fajl_id, 'ismeretlen', 'hiba', 'admin', 1, 'Teszt Retry');
SELECT LAST_INSERT_ID() AS dokumentum_id;
"
```

Erre a sorra kattintva nyisd meg a review-panelt, ellenőrizd a figyelmeztető sáv + "Újrapróbálás" gomb megjelenését, kattints rá, ellenőrizd a toast-ot, majd DB-ből ellenőrizd, hogy a sor `ocr_allapot`-ja rögtön `feldolgozatlan`-ra váltott. Mivel a `hely` egy ténylegesen nem létező fájlra mutat, a háttérfolyamat pár másodperc múlva `hiba`-ra fogja visszaállítani (a `dolgozzFel()` `file_exists()`-ellenőrzése miatt) — ez a szintetikus tesztsor esetén elvárt, és pont azt igazolja, hogy egy hiányzó fájl esetén sem ragad `feldolgozatlan`-on a sor.

Teszt-sor törlése utána:
```bash
mysql -uroot kamion -e "DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.feltolto_nev = 'Teszt Retry';"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Fuvarok/DokumentumReviewPanel.js
git commit -m "feat: add manual OCR retry action to document review panel"
```

---

### Task 8: Teljes végigfuttatás — élő, kétoldalú (sofőr + admin) golden path

**Files:** (nincs kódmódosítás, csak ellenőrzés)

**Interfaces:**
- Consumes: Task 1-7 összes eredménye.

- [ ] **Step 1: Backend + frontend dev szerver indítása**

```bash
cd /home/psadmin/szikoratransz/szikoratransz/backend && php8.2 -S localhost:8001 &
cd /home/psadmin/szikoratransz/szikoratransz && npm start &
```
(Ha már fut valamelyik, ld. CLAUDE.md "Local dev environment" — ne indíts duplikáltat, használd a meglévőt.)

- [ ] **Step 2: Sofőr-oldali golden path Playwright-tal**

- Helyi `sessions` táblába szúrt valódi `sofor`-típusú munkamenet.
- Navigálj `/user/dokumentum-feltoltes`-re, tölts fel egy valós, kép típusú fájlt.
- Mérd a UI-válaszidőt (a "Sikeresen feltöltve..." toast megjelenéséig) — legyen szemmel láthatóan gyors (nem 3-13 mp-es várakozás).
- Ellenőrizd, hogy a lista azonnal "Feldolgozás alatt" jelvényt mutat, majd (a lapon maradva, a beépített poll miatt) automatikusan átvált "Feldolgozva"/"Hiba – admin pótolja"-ra.

- [ ] **Step 3: Admin-oldali golden path Playwright-tal**

- Helyi `sessions` táblába szúrt valódi `admin`-típusú munkamenet (ugyanahhoz a céghez, mint a sofőr).
- Navigálj `/admin/beerkezettDokumentumok`-ra — a sofőr által az előző lépésben feltöltött dokumentum megjelenik.
- Tölts fel egy második dokumentumot a bulk-feltöltővel — ellenőrizd az azonnali "feltöltve, a feldolgozás a háttérben folytatódik" toast-ot.
- Kattints a "Frissítés" gombra — ellenőrizd, hogy a közben lefutott OCR-eredmény megjelenik.
- Nyiss meg egy dokumentumot, aminek (kézzel, DB-n keresztül) `ocr_allapot='hiba'`-t állítottál — ellenőrizd a figyelmeztető sávot + "Újrapróbálás" gombot, kattints rá, ellenőrizd a végeredményt.
- Mindkét nézetet (light + dark mód) ellenőrizd screenshottal.

- [ ] **Step 4: Teszt-adatok végleges takarítása**

```bash
mysql -uroot kamion -e "
DELETE FROM sessions WHERE token IN ('teszt-token-ocr-async');
DELETE bd, f FROM beerkezett_dokumentumok bd JOIN fajlok f ON f.sorszam = bd.fajl_id WHERE bd.letrehozva > NOW() - INTERVAL 2 HOUR AND bd.feltolto_nev LIKE 'Teszt%';
"
```
Ellenőrizd `backend/files/`-ben, hogy nem maradt árva teszt-fájl (a `hely` oszlop értékei alapján a fenti `DELETE` előtt lekérdezve), és a helyi `git status` tiszta (nincs elfelejtett ideiglenes fájl a repóban).

- [ ] **Step 5: `CLAUDE.md` frissítése**

A CLAUDE.md "Fuvar-dokumentum OCR + Fuvar modul" szekciója után (a legutóbbi, "Fuvar OCR-bővítés: távolság (km) + tömeg (kg)" alszakasz UTÁN) adj hozzá egy rövid, új alszakaszt ami dokumentálja: az OCR mostantól aszinkron (fire-and-forget `exec()` + `backend/cli/ocr_feldolgozas.php`), nincs cron-tartalék (tudatos döntés), a "feldolgozatlan" állapot mostantól valóban előfordul és admin "Újrapróbálás" akcióval kezelhető, ha elakadna. Kövesd a CLAUDE.md meglévő stílusát (tömör, dátumozott alcímek, "élőben tesztelve" záró bekezdés).

- [ ] **Step 6: Végső commit**

```bash
git add CLAUDE.md
git commit -m "docs: document async OCR processing for beerkezett dokumentum modul"
```
