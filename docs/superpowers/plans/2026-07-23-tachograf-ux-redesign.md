# Tachográf modul UX-újratervezés (MVP + V2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Tachográf module (`src/views/admin/Tachograf.js` + `backend/interface/tachografInterface.php`) from a single flat page into a 4-tab module (Áttekintés / Sofőrök / Napló / Import előzmények) with a proactive card-download compliance widget, a redesigned 3-step import wizard with match-confidence and a commit summary, a visual daily activity bar, an import audit trail, driver reassignment, and cross-links from Sofőr-riport and the Dashboard Teendők card.

**Architecture:** Backend additions live entirely inside the existing `TachografInterface` class (no new interface file) plus the standard 3 wiring points in `ApiHandler.php` (`getActions()`, `MODULE_PERMISSION_MAP`, `process()`). One new table (`tachograf_import_naplo`) is appended to the still-uncommitted `backend/sql/31.sql` per this project's migration convention. Frontend work extracts the module's growing inline logic into 7 new focused components under `src/components/Tachograf/`, orchestrated by a slimmer, tab-based `Tachograf.js`.

**Tech Stack:** PHP 8.2 (PDO/MySQL, no framework), React (CRA) + Tailwind, `react-router-dom` v5, existing app primitives (`DataTable`, `Modal`, `StatusBadge`, `CardStats`, `PageHeader`, `FormField`, `SaveButton`, `fetchAction`, `toast`).

## Global Constraints

- **No test framework exists in this repo** (`npm test` has zero test files; there is no PHPUnit). Per this project's own established convention (documented in its `CLAUDE.md`), every server-side change must instead be **actually run and verified** against the real local DB/PHP server, and every frontend change must be **actually clicked through in a browser** (Playwright or manual) before being called done — this replaces the "write failing test" ritual in every task below with a concrete manual-verification step.
- **Tailwind is not auto-rebuilt.** `src/index.js` imports the pre-built `src/assets/styles/tailwind.css`, not the source `index.css`. Any task introducing a new utility class must be followed by `npx tailwindcss -i ./src/assets/styles/index.css -o ./src/assets/styles/tailwind.css` before it can be verified in a browser — this is called out explicitly wherever a task adds new classes.
- **SQL migration convention:** `backend/sql/31.sql` is still uncommitted (per `git status`) — new schema changes are appended to that same file, not a new `32.sql`.
- **Server-side scoping:** every new query/action must scope by the server-resolved `ceg_id` (via `resolveKerelmezo($request)['ceg_id']`), never a client-submitted id, matching every existing action in this file.
- **PHP/MySQL date deltas are computed in SQL** (`DATEDIFF`/`TIMESTAMPDIFF`), never via PHP `strtotime()`/`time()` — this project hit a real timezone-mismatch bug from doing it the other way (documented in `CLAUDE.md`).
- **No SQL `JOIN`/`UNION`** — this project's custom SQL linter disallows both; names are resolved with a second query and merged in PHP (see `soforNevekTomb()` for the existing pattern).
- Dev servers for manual verification: `cd backend && php8.2 -S localhost:8001` (backend) and the already-running CRA dev server on port 3000 (reuse it — don't start a second one). Local DB: `mysql -uroot kamion` (no password, per this project's documented local setup).

---

## Part A — Backend

### Task 1: `tachograf_import_naplo` table

**Files:**
- Modify: `backend/sql/31.sql` (append)

**Interfaces:**
- Produces: table `tachograf_import_naplo(id, admin, sofor_id, kartyaszam, fajlnev, feltolto_tipus, feltolto_id, feltolto_nev, uj_nap, kihagyott_nap, esemeny_szam, letrehozva)` — consumed by Task 2's `alkalmazImport()`/`getImportNaplo()`.

- [ ] **Step 1: Append the table definition**

Add to the end of `backend/sql/31.sql`:

```sql
-- Tachográf modul UX-újratervezés (2026-07-23) — import-audit napló. Minden
-- alkalmazTachografImport() hívás (fájlonként egy) egy sort ír ide, hogy az
-- "Import előzmények" fülön visszakereshető legyen ki mit töltött fel és mi
-- lett belőle — ezt korábban semmi nem naplózta.
CREATE TABLE IF NOT EXISTS tachograf_import_naplo (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    sofor_id INT NOT NULL,
    kartyaszam VARCHAR(20) NOT NULL,
    fajlnev VARCHAR(191) NULL,
    feltolto_tipus ENUM('admin','sofor') NULL,
    feltolto_id INT NULL,
    feltolto_nev VARCHAR(191) NULL,
    uj_nap INT NOT NULL DEFAULT 0,
    kihagyott_nap INT NOT NULL DEFAULT 0,
    esemeny_szam INT NOT NULL DEFAULT 0,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_admin_datum (admin, letrehozva)
) ENGINE=InnoDB;
```

- [ ] **Step 2: Apply and verify against the real local DB**

Run: `mysql -uroot kamion < backend/sql/31.sql`
Then: `mysql -uroot kamion -e "DESCRIBE tachograf_import_naplo;"`
Expected: 12 columns listed, matching the `CREATE TABLE` above, no errors (the file is idempotent — re-running it against the columns already applied from earlier in the same file must not error either; if it does, fix the SQL before continuing).

- [ ] **Step 3: Commit**

```bash
git add backend/sql/31.sql
git commit -m "feat: add tachograf_import_naplo table for import audit trail"
```

---

### Task 2: `TachografInterface` — new methods + confidence signal + audit logging

**Files:**
- Modify: `backend/interface/tachografInterface.php`

**Interfaces:**
- Consumes: existing `tachograf_napi_aktivitas`, `tachograf_esemenyek`, `user` tables; existing `soforNevekTomb($ceg_id)` private helper.
- Produces:
  - `elemezDdd(...)` response gains `javaslatForras` (`'kartyaszam'|'nev'|null`).
  - `alkalmazImport($napok, $sofor_id, $kartyaszam, $forrasFajlnev, $ceg_id, $esemenyek = [], $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null)` — 3 new trailing params, unchanged return shape.
  - `public function getSoforOsszesito($ceg_id): array` — keyed by `sofor_id`, each `['utolsoDatum','vezetesPerc7Nap','km30Nap','tulOraNapok']`.
  - `public function getSoforAttekintes($ceg_id): array` — `['success'=>true,'sorok'=>[['sofor_id','nev','utolsoDatum','vezetesPerc7Nap','km30Nap','tulOraNapok','vanAdat'], ...]]`.
  - `public function getMegfelelosegiLista($ceg_id): array` — `['success'=>true,'sorok'=>[['sofor_id','nev','utolsoDatum','napokOta','statusz'], ...]]`, `statusz` ∈ `rendben|esedekes|lejart|nincs_adat`.
  - `public function getImportNaplo($ceg_id): array` — `['success'=>true,'sorok'=>[...tachograf_import_naplo rows + sofor_nev]]`.
  - `public function atparositNap($id, $ujSoforId, $ceg_id): array` — `['success'=>bool,'message'?=>string]`.

- [ ] **Step 1: Add match-confidence to `elemezDdd()`**

In `backend/interface/tachografInterface.php`, replace:

```php
            $javasoltSoforId = $this->keresSoforKartyaAlapjan($ceg_id, $kartyaszam);
            if (!$javasoltSoforId) {
                $javasoltSoforId = $this->keresSoforNevAlapjan(
                    $ceg_id,
                    $eredmeny['identification']['holderSurname'],
                    $eredmeny['identification']['holderFirstNames']
                );
            }
```

with:

```php
            // `javaslatForras` — a UX-újratervezés (2026-07-23) bizalmi-jelzés
            // igényére: a frontend a kártyaszám-alapú egyezést biztosnak, a
            // név-alapút bizonytalannak jelzi, nem ugyanúgy néznek ki.
            $javasoltSoforId = $this->keresSoforKartyaAlapjan($ceg_id, $kartyaszam);
            $javaslatForras = $javasoltSoforId ? 'kartyaszam' : null;
            if (!$javasoltSoforId) {
                $javasoltSoforId = $this->keresSoforNevAlapjan(
                    $ceg_id,
                    $eredmeny['identification']['holderSurname'],
                    $eredmeny['identification']['holderFirstNames']
                );
                $javaslatForras = $javasoltSoforId ? 'nev' : null;
            }
```

Then in the same method's return statement, add the field:

```php
            return [
                'success' => true,
                'kartyabirtokos' => $eredmeny['identification'],
                'javasoltSoforId' => $javasoltSoforId,
                'javaslatForras' => $javaslatForras,
                'napok' => $napok,
                'esemenyek' => $eredmeny['esemenyek'],
                'hibak' => $eredmeny['hibak'],
                'figyelmeztetesek' => $eredmeny['warnings'],
            ];
```

- [ ] **Step 2: Extend `alkalmazImport()` with feltöltő params + audit-log insert**

Replace the method signature line:

```php
    public function alkalmazImport($napok, $sofor_id, $kartyaszam, $forrasFajlnev, $ceg_id, $esemenyek = []) {
```

with:

```php
    public function alkalmazImport($napok, $sofor_id, $kartyaszam, $forrasFajlnev, $ceg_id, $esemenyek = [], $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null) {
```

Then, immediately before the method's final `return ['success' => true, 'importalt' => $importalt, 'kihagyva' => $kihagyva, 'esemenyImportalt' => $esemenyImportalt];` line, insert:

```php
            // Import-audit napló — csendben elnyeljük a hibát, ugyanaz az elv,
            // mint `mentsNyersFajlt()`-nél: egy naplózási gond sosem buktathatja
            // el a már ténylegesen lefutott importot.
            try {
                $naploIns = $this->db->prepare(
                    "INSERT INTO tachograf_import_naplo
                        (admin, sofor_id, kartyaszam, fajlnev, feltolto_tipus, feltolto_id, feltolto_nev, uj_nap, kihagyott_nap, esemeny_szam)
                     VALUES (:admin, :sofor_id, :kartyaszam, :fajlnev, :feltolto_tipus, :feltolto_id, :feltolto_nev, :uj_nap, :kihagyott_nap, :esemeny_szam)"
                );
                $naploIns->bindValue(':admin', $ceg_id);
                $naploIns->bindValue(':sofor_id', $sofor_id);
                $naploIns->bindValue(':kartyaszam', $kartyaszam);
                $naploIns->bindValue(':fajlnev', $forrasFajlnev);
                $naploIns->bindValue(':feltolto_tipus', $feltoltoTipus);
                $naploIns->bindValue(':feltolto_id', $feltoltoId);
                $naploIns->bindValue(':feltolto_nev', $feltoltoNev);
                $naploIns->bindValue(':uj_nap', $importalt);
                $naploIns->bindValue(':kihagyott_nap', $kihagyva);
                $naploIns->bindValue(':esemeny_szam', $esemenyImportalt);
                $naploIns->execute();
            } catch (Exception $e) {
                error_log('Tachográf import-napló mentése sikertelen: ' . $e->getMessage());
            }

```

- [ ] **Step 3: Add the 5 new public methods**

Insert these methods right before the closing `}` of the `TachografInterface` class (i.e. right before the final `}` that precedes `$tachografInterface = new TachografInterface();`):

```php
    // UX-újratervezés (2026-07-23) — sofőrönkénti tachográf-összesítő, kiemelve
    // az ApiHandler::getSoforScorecard()-ből, hogy a Tachográf modul "Sofőrök"
    // füle és a Sofőr-riport ugyanazt a lekérdezést használja egyszer, nem
    // kétszer duplikálva ugyanazt az SQL-t.
    public function getSoforOsszesito($ceg_id) {
        $tachoStmt = $this->db->prepare(
            "SELECT sofor_id,
                    MAX(datum) utolso_datum,
                    SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN vezetes_perc ELSE 0 END) vezetes_perc_7nap,
                    SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN tavolsag_km ELSE 0 END) km_30nap,
                    SUM(CASE WHEN vezetes_perc > 540 THEN 1 ELSE 0 END) tul_ora_napok
             FROM tachograf_napi_aktivitas WHERE admin = :admin GROUP BY sofor_id"
        );
        $tachoStmt->bindValue(':admin', $ceg_id);
        $tachoStmt->execute();
        $eredmeny = [];
        foreach ($tachoStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
            $eredmeny[$sor['sofor_id']] = [
                'utolsoDatum' => $sor['utolso_datum'],
                'vezetesPerc7Nap' => (int) $sor['vezetes_perc_7nap'],
                'km30Nap' => (int) $sor['km_30nap'],
                'tulOraNapok' => (int) $sor['tul_ora_napok'],
            ];
        }
        return $eredmeny;
    }

    // "Sofőrök" fül listája — minden aktív sofőr, a fenti összesítővel
    // kiegészítve; `vanAdat` különbözteti meg "sosem töltött fel kártyát"-ot
    // "0 km-t vezetett az elmúlt 30 napban"-tól.
    public function getSoforAttekintes($ceg_id) {
        try {
            $soforStmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :admin AND torolt <> 'I' ORDER BY name ASC");
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforok = $soforStmt->fetchAll(PDO::FETCH_ASSOC);
            $osszesito = $this->getSoforOsszesito($ceg_id);

            $sorok = [];
            foreach ($soforok as $sofor) {
                $adat = $osszesito[$sofor['id']] ?? null;
                $sorok[] = [
                    'sofor_id' => (int) $sofor['id'],
                    'nev' => $sofor['name'],
                    'utolsoDatum' => $adat['utolsoDatum'] ?? null,
                    'vezetesPerc7Nap' => $adat['vezetesPerc7Nap'] ?? 0,
                    'km30Nap' => $adat['km30Nap'] ?? 0,
                    'tulOraNapok' => $adat['tulOraNapok'] ?? 0,
                    'vanAdat' => $adat !== null,
                ];
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Kártya-letöltés megfelelőségi állapot — EU 561/2006: a sofőrkártyát
    // rendszeresen le kell tölteni, mert a kártya körkörös tárolója felülírja
    // a régi adatot. A napok-száma delta SQL-ben számolt (DATEDIFF), nem PHP
    // strtotime()-mal — ld. a projekt dokumentált PHP/MySQL időzóna-eltérés
    // gotchaja. Küszöbök: <=21 nap rendben, 22-28 nap esedékes, 28 nap felett
    // lejárt; ha a sofőrnek sosem volt még importált napja, "nincs_adat"
    // (nem automatikusan "lejárt" — nem tudjuk, hogy ez valódi elmaradás-e).
    public function getMegfelelosegiLista($ceg_id) {
        try {
            $soforStmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :admin AND torolt <> 'I' ORDER BY name ASC");
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforok = $soforStmt->fetchAll(PDO::FETCH_ASSOC);

            $utolsoStmt = $this->db->prepare(
                "SELECT sofor_id, MAX(datum) utolso_datum, DATEDIFF(CURDATE(), MAX(datum)) napok_ota
                 FROM tachograf_napi_aktivitas WHERE admin = :admin GROUP BY sofor_id"
            );
            $utolsoStmt->bindValue(':admin', $ceg_id);
            $utolsoStmt->execute();
            $utolsoSoforSzerint = [];
            foreach ($utolsoStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
                $utolsoSoforSzerint[$sor['sofor_id']] = ['utolsoDatum' => $sor['utolso_datum'], 'napokOta' => (int) $sor['napok_ota']];
            }

            $sorok = [];
            foreach ($soforok as $sofor) {
                $adat = $utolsoSoforSzerint[$sofor['id']] ?? null;
                if ($adat === null) {
                    $statusz = 'nincs_adat';
                    $napokOta = null;
                } elseif ($adat['napokOta'] <= 21) {
                    $statusz = 'rendben';
                    $napokOta = $adat['napokOta'];
                } elseif ($adat['napokOta'] <= 28) {
                    $statusz = 'esedekes';
                    $napokOta = $adat['napokOta'];
                } else {
                    $statusz = 'lejart';
                    $napokOta = $adat['napokOta'];
                }
                $sorok[] = [
                    'sofor_id' => (int) $sofor['id'],
                    'nev' => $sofor['name'],
                    'utolsoDatum' => $adat['utolsoDatum'] ?? null,
                    'napokOta' => $napokOta,
                    'statusz' => $statusz,
                ];
            }

            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // "Import előzmények" fül — minden korábbi alkalmazTachografImport()
    // hívás (ld. a fenti napló-insert), legfrissebb elöl.
    public function getImportNaplo($ceg_id) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM tachograf_import_naplo WHERE admin = :admin ORDER BY letrehozva DESC");
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->execute();
            $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $nevek = $this->soforNevekTomb($ceg_id);
            foreach ($sorok as &$sor) {
                $sor['sofor_nev'] = $nevek[$sor['sofor_id']] ?? null;
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Egy már importált napi rekord sofőr-átpárosítása (adminisztrátor
    // hibajavítás, ld. UX-koncepció 7. szakasz) — mindkét oldalt (a rekordot
    // ÉS az új sofőrt is) a hívó ceg_id-jéhez ellenőrzi, nem bízik a
    // kliens-oldali szűrésben.
    public function atparositNap($id, $ujSoforId, $ceg_id) {
        try {
            $sorStmt = $this->db->prepare("SELECT id FROM tachograf_napi_aktivitas WHERE id = :id AND admin = :ceg_id");
            $sorStmt->bindValue(':id', $id);
            $sorStmt->bindValue(':ceg_id', $ceg_id);
            $sorStmt->execute();
            if (!$sorStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A napló-bejegyzés nem található.'];
            }
            $soforStmt = $this->db->prepare("SELECT id FROM user WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $soforStmt->bindValue(':id', $ujSoforId);
            $soforStmt->bindValue(':ceg_id', $ceg_id);
            $soforStmt->execute();
            if (!$soforStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A kiválasztott sofőr nem található.'];
            }
            $upd = $this->db->prepare("UPDATE tachograf_napi_aktivitas SET sofor_id = :sofor_id WHERE id = :id AND admin = :ceg_id");
            $upd->bindValue(':sofor_id', $ujSoforId);
            $upd->bindValue(':id', $id);
            $upd->bindValue(':ceg_id', $ceg_id);
            $upd->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

```

- [ ] **Step 4: Verify with PHP CLI against the real local DB**

Run: `php8.2 -r '
require "backend/db.php";
require "backend/DddParser.php";
require "backend/interface/tachografInterface.php";
global $tachografInterface;
var_dump($tachografInterface->getMegfelelosegiLista(1));
var_dump($tachografInterface->getSoforAttekintes(1));
var_dump($tachografInterface->getImportNaplo(1));
'`

Expected: three `array(2) { ["success"]=> bool(true) ["sorok"]=> array(...) }` dumps, no PHP fatal errors, no exceptions. `getMegfelelosegiLista`'s rows must each have a `statusz` of `rendben`/`esedekes`/`lejart`/`nincs_adat`. `getImportNaplo` returns an empty `sorok` array until Task 2's `alkalmazImport()` change has actually been exercised once (expected at this point).

- [ ] **Step 5: Commit**

```bash
git add backend/interface/tachografInterface.php
git commit -m "feat: add tachograf compliance, driver rollup, import audit and reassignment"
```

---

### Task 3: `ApiHandler.php` wiring — 4 new actions, modified action, refactor, Teendők integration

**Files:**
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `TachografInterface::getMegfelelosegiLista/getSoforAttekintes/getImportNaplo/atparositNap/getSoforOsszesito` from Task 2.
- Produces: actions `getTachografMegfeleloseg`, `getTachografSoforOsszesito`, `getTachografImportNaplo`, `atparositTachografNap`; `getTeendok()` response gains a `tachografLetoltesek` array (same row shape as `getMegfelelosegiLista`, filtered to `esedekes`/`lejart`).

- [ ] **Step 1: Add required-params entries**

In `backend/ApiHandler.php`, find:

```php
            'elemezTachografDdd' => ['ddd', 'ceg_id', 'kerelmezo_id'],
            'alkalmazTachografImport' => ['napok', 'sofor_id', 'kartyaszam', 'ceg_id', 'kerelmezo_id'],
            'getTachografNapiAktivitas' => ['ceg_id', 'kerelmezo_id'],
            'getTachografEsemenyek' => ['ceg_id', 'kerelmezo_id'],
```

Replace with:

```php
            'elemezTachografDdd' => ['ddd', 'ceg_id', 'kerelmezo_id'],
            'alkalmazTachografImport' => ['napok', 'sofor_id', 'kartyaszam', 'ceg_id', 'kerelmezo_id'],
            'getTachografNapiAktivitas' => ['ceg_id', 'kerelmezo_id'],
            'getTachografEsemenyek' => ['ceg_id', 'kerelmezo_id'],
            'getTachografMegfeleloseg' => ['ceg_id', 'kerelmezo_id'],
            'getTachografSoforOsszesito' => ['ceg_id', 'kerelmezo_id'],
            'getTachografImportNaplo' => ['ceg_id', 'kerelmezo_id'],
            'atparositTachografNap' => ['id', 'ujSoforId', 'ceg_id', 'kerelmezo_id'],
```

- [ ] **Step 2: Add permission-map entries**

Find:

```php
        'elemezTachografDdd' => ['tachograf', 'hozzaferes'],
        'alkalmazTachografImport' => ['tachograf', 'szerkesztes'],
        'getTachografNapiAktivitas' => ['tachograf', 'hozzaferes'],
        'getTachografEsemenyek' => ['tachograf', 'hozzaferes'],
```

Replace with:

```php
        'elemezTachografDdd' => ['tachograf', 'hozzaferes'],
        'alkalmazTachografImport' => ['tachograf', 'szerkesztes'],
        'getTachografNapiAktivitas' => ['tachograf', 'hozzaferes'],
        'getTachografEsemenyek' => ['tachograf', 'hozzaferes'],
        'getTachografMegfeleloseg' => ['tachograf', 'hozzaferes'],
        'getTachografSoforOsszesito' => ['tachograf', 'hozzaferes'],
        'getTachografImportNaplo' => ['tachograf', 'hozzaferes'],
        'atparositTachografNap' => ['tachograf', 'szerkesztes'],
```

- [ ] **Step 3: Modify the `alkalmazTachografImport` case + add 4 new cases**

Find:

```php
                case 'alkalmazTachografImport':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->alkalmazImport(
                        $request['napok'],
                        $request['sofor_id'],
                        $request['kartyaszam'],
                        $request['forrasFajlnev'] ?? null,
                        $kerelmezo['ceg_id'],
                        $request['esemenyek'] ?? []
                    ));
                    return;
```

Replace with:

```php
                case 'alkalmazTachografImport':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($tachografInterface->alkalmazImport(
                        $request['napok'],
                        $request['sofor_id'],
                        $request['kartyaszam'],
                        $request['forrasFajlnev'] ?? null,
                        $kerelmezo['ceg_id'],
                        $request['esemenyek'] ?? [],
                        $feltoltoTipus,
                        $feltoltoId,
                        $feltoltoNev
                    ));
                    return;
                case 'getTachografMegfeleloseg':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getMegfelelosegiLista($kerelmezo['ceg_id']));
                    return;
                case 'getTachografSoforOsszesito':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getSoforAttekintes($kerelmezo['ceg_id']));
                    return;
                case 'getTachografImportNaplo':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getImportNaplo($kerelmezo['ceg_id']));
                    return;
                case 'atparositTachografNap':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->atparositNap($request['id'], $request['ujSoforId'], $kerelmezo['ceg_id']));
                    return;
```

- [ ] **Step 4: Refactor `getSoforScorecard()` to reuse `getSoforOsszesito()`**

In `getSoforScorecard($ceg_id)`, find the whole block from the `// Tachográf kártya-import (ld. tachografInterface.php)...` comment down through the `$tachoStmt->execute();` call and the `foreach` that builds `$tachoSoforSzerint`:

```php
            // Tachográf kártya-import (ld. tachografInterface.php) — sofőrönkénti
            // ...
            $tachoStmt = $this->db->prepare(
                "SELECT sofor_id,
                        MAX(datum) utolso_datum,
                        SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN vezetes_perc ELSE 0 END) vezetes_perc_7nap,
                        SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN tavolsag_km ELSE 0 END) km_30nap,
                        SUM(CASE WHEN vezetes_perc > 540 THEN 1 ELSE 0 END) tul_ora_napok
                 FROM tachograf_napi_aktivitas WHERE admin = :admin GROUP BY sofor_id"
            );
            $tachoStmt->bindValue(':admin', $ceg_id);
            $tachoStmt->execute();
            $tachoSoforSzerint = [];
            foreach ($tachoStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
                $tachoSoforSzerint[$sor['sofor_id']] = [
                    'utolsoDatum' => $sor['utolso_datum'],
                    'vezetesPerc7Nap' => (int) $sor['vezetes_perc_7nap'],
                    'km30Nap' => (int) $sor['km_30nap'],
                    'tulOraNapok' => (int) $sor['tul_ora_napok'],
                ];
            }
```

Replace with:

```php
            // Tachográf kártya-import (ld. tachografInterface.php) —
            // sofőrönkénti összesítő, mostantól TachografInterface::
            // getSoforOsszesito()-ból (UX-újratervezés, 2026-07-23) — ugyanaz
            // a lekérdezés adja a Tachográf modul "Sofőrök" fülét is, nem
            // duplikáljuk kétszer ugyanazt az SQL-t.
            global $tachografInterface;
            $tachoSoforSzerint = $tachografInterface->getSoforOsszesito($ceg_id);
```

- [ ] **Step 5: Extend `getTeendok()` with the compliance source**

Find:

```php
    private function getTeendok($ceg_id, $isAdmin) {
        global $jarmuValtasInterface, $bejelentesekInterface;
        try {
            $jarmuValtas = $jarmuValtasInterface->getFuggoJarmuValtasok($ceg_id);
            $bejelentesek = $bejelentesekInterface->getNyitottBejelentesek($ceg_id);

            $ajanlatkeresek = [];
            if ($isAdmin) {
                $osszesAjanlatkeres = $this->getAjanlatkeresek();
                if ($osszesAjanlatkeres['success']) {
                    $ajanlatkeresek = array_values(array_filter(
                        $osszesAjanlatkeres['ajanlatkeresek'],
                        fn($a) => $a['statusz'] === 'uj'
                    ));
                }
            }

            return [
                'success' => true,
                'jarmuValtas' => $jarmuValtas['success'] ? $jarmuValtas['kerelmek'] : [],
                'bejelentesek' => $bejelentesek['success'] ? $bejelentesek['bejelentesek'] : [],
                'ajanlatkeresek' => $ajanlatkeresek,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
```

Replace with:

```php
    private function getTeendok($ceg_id, $isAdmin) {
        global $jarmuValtasInterface, $bejelentesekInterface, $tachografInterface;
        try {
            $jarmuValtas = $jarmuValtasInterface->getFuggoJarmuValtasok($ceg_id);
            $bejelentesek = $bejelentesekInterface->getNyitottBejelentesek($ceg_id);

            $ajanlatkeresek = [];
            if ($isAdmin) {
                $osszesAjanlatkeres = $this->getAjanlatkeresek();
                if ($osszesAjanlatkeres['success']) {
                    $ajanlatkeresek = array_values(array_filter(
                        $osszesAjanlatkeres['ajanlatkeresek'],
                        fn($a) => $a['statusz'] === 'uj'
                    ));
                }
            }

            // Tachográf modul UX-újratervezés (2026-07-23) — esedékes/lejárt
            // kártya-letöltés a Teendők közé, ugyanaz az összefésülő minta,
            // mint a másik 3 forrásnál.
            $tachografLetoltesek = [];
            $megfeleloseg = $tachografInterface->getMegfelelosegiLista($ceg_id);
            if ($megfeleloseg['success']) {
                $tachografLetoltesek = array_values(array_filter(
                    $megfeleloseg['sorok'],
                    fn($s) => in_array($s['statusz'], ['esedekes', 'lejart'], true)
                ));
            }

            return [
                'success' => true,
                'jarmuValtas' => $jarmuValtas['success'] ? $jarmuValtas['kerelmek'] : [],
                'bejelentesek' => $bejelentesek['success'] ? $bejelentesek['bejelentesek'] : [],
                'ajanlatkeresek' => $ajanlatkeresek,
                'tachografLetoltesek' => $tachografLetoltesek,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
```

- [ ] **Step 6: Verify end-to-end against the real local DB + PHP server**

Run: `cd backend && php8.2 -S localhost:8001 &` (skip if already running per this project's local-dev convention)

Insert a temporary admin session row and hit the new actions:

```bash
mysql -uroot kamion -e "INSERT INTO sessions (felhasznalo_tipus, felhasznalo_id, token, lejarat) VALUES ('admin', 1, 'plan-verify-token', DATE_ADD(NOW(), INTERVAL 1 DAY));"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" \
  -d '{"authHash":"<AUTH_HASH_FROM_config.php>","action":"getTachografMegfeleloseg","ceg_id":1,"kerelmezo_id":1}'
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" \
  -d '{"authHash":"<AUTH_HASH_FROM_config.php>","action":"getTachografSoforOsszesito","ceg_id":1,"kerelmezo_id":1}'
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" \
  -d '{"authHash":"<AUTH_HASH_FROM_config.php>","action":"getTachografImportNaplo","ceg_id":1,"kerelmezo_id":1}'
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" \
  -d '{"authHash":"<AUTH_HASH_FROM_config.php>","action":"getTeendok","id":1,"kerelmezo_id":1}'
mysql -uroot kamion -e "DELETE FROM sessions WHERE token = 'plan-verify-token';"
```

(Read the real `$authHash` value out of `backend/config.php` before running — don't invent one.)

Expected: all four calls return `{"success":true,...}` JSON, no PHP warnings/notices in the server's stdout, and the `getTeendok` response includes a `"tachografLetoltesek"` key (array, possibly empty depending on current local data). Also re-run `getSoforScorecard` (existing action, e.g. via the already-running frontend's Sofőr-riport page) and confirm the km/fogyasztás/vezetési-idő columns still show the same values as before this task's refactor — this is the regression check for Step 4.

- [ ] **Step 7: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "feat: wire tachograf compliance/rollup/audit actions and Teendők integration"
```

---

## Part B — Frontend

### Task 4: `NapiIdovonalSav.js` — visual daily activity bar

**Files:**
- Create: `src/components/Tachograf/NapiIdovonalSav.js`

**Interfaces:**
- Consumes: `valtozasok` prop — array of `{ perc: number, tevekenyseg: 'vezetes'|'munka'|'rendelkezesre_allas'|'piheno', kartya_kivetel?: boolean }` (same shape `tachograf_napi_aktivitas.aktivitas_json` already produces).
- Produces: default export `NapiIdovonalSav({ valtozasok })` — replaces the list-based `AktivitasIdovonal` in `Tachograf.js`.

- [ ] **Step 1: Write the component**

```jsx
import React from "react";

const TONE_COLOR = {
  vezetes: "bg-brand-600 dark:bg-brand-500",
  munka: "bg-amber-500 dark:bg-amber-400",
  rendelkezesre_allas: "bg-ink-300 dark:bg-ink-600",
  piheno: "bg-emerald-500 dark:bg-emerald-400",
};
const TEVEKENYSEG_LABEL = {
  vezetes: "Vezetés",
  munka: "Munka",
  rendelkezesre_allas: "Rendelkezésre állás",
  piheno: "Pihenő",
};

const oraPerc = (perc) => `${String(Math.floor(perc / 60)).padStart(2, "0")}:${String(perc % 60).padStart(2, "0")}`;

export default function NapiIdovonalSav({ valtozasok }) {
  if (!valtozasok || valtozasok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs rögzített állapotváltás erre a napra.</p>;
  }

  const rendezett = [...valtozasok].sort((a, b) => a.perc - b.perc);
  const szegmensek = rendezett.map((v, i) => {
    const veg = i + 1 < rendezett.length ? rendezett[i + 1].perc : 1440;
    return { ...v, szazalek: Math.max(0, ((veg - v.perc) / 1440) * 100) };
  });

  return (
    <div>
      <div
        className="flex h-9 overflow-hidden rounded-lg"
        role="img"
        aria-label="A nap vezetési, munka, rendelkezésre állási és pihenő idejének beosztása"
      >
        {szegmensek.map((sz, i) => (
          <div
            key={i}
            className={`h-full ${TONE_COLOR[sz.tevekenyseg] || "bg-ink-200 dark:bg-ink-700"}`}
            style={{ width: `${sz.szazalek}%` }}
            title={`${oraPerc(sz.perc)} — ${TEVEKENYSEG_LABEL[sz.tevekenyseg] || sz.tevekenyseg}${sz.kartya_kivetel ? " (kártya kivéve)" : ""}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
        {Object.entries(TEVEKENYSEG_LABEL).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${TONE_COLOR[key]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders (manual, via the day-detail modal wired in Task 10)**

This component has no visual meaning in isolation — its manual verification happens as part of Task 10's end-to-end check (opening a day-detail modal must show a colored bar, not a bulleted list). Skip an isolated check here; proceed.

- [ ] **Step 3: Commit**

```bash
git add src/components/Tachograf/NapiIdovonalSav.js
git commit -m "feat: add visual daily activity bar for tachograf day detail"
```

---

### Task 5: `Heatmap.js` — small reusable driving-time heatmap tile

**Files:**
- Create: `src/components/Tachograf/Heatmap.js`

**Interfaces:**
- Consumes: `sorok` prop — array of `{ datum: 'YYYY-MM-DD', vezetes_perc: number }` (subset of `tachograf_napi_aktivitas` rows), `napokSzama` prop (default `28`).
- Produces: default export `Heatmap({ sorok, napokSzama })`.

- [ ] **Step 1: Write the component**

```jsx
import React, { useMemo } from "react";

function szintOsztaly(perc) {
  if (perc == null || perc === 0) return "bg-ink-100 dark:bg-ink-800";
  if (perc <= 240) return "bg-brand-200 dark:bg-brand-900";
  if (perc <= 480) return "bg-brand-400 dark:bg-brand-700";
  if (perc <= 540) return "bg-brand-600 dark:bg-brand-500";
  return "bg-amber-500 dark:bg-amber-400";
}

export default function Heatmap({ sorok, napokSzama = 28 }) {
  const cellak = useMemo(() => {
    const map = {};
    (sorok || []).forEach((s) => {
      map[s.datum] = (map[s.datum] || 0) + (s.vezetes_perc || 0);
    });
    const ma = new Date();
    const eredmeny = [];
    for (let i = napokSzama - 1; i >= 0; i -= 1) {
      const nap = new Date(ma);
      nap.setDate(nap.getDate() - i);
      const datum = nap.toISOString().slice(0, 10);
      eredmeny.push({ datum, perc: map[datum] ?? null });
    }
    return eredmeny;
  }, [sorok, napokSzama]);

  return (
    <div className="flex flex-wrap gap-1">
      {cellak.map((c) => (
        <div
          key={c.datum}
          className={`h-3.5 w-3.5 rounded-sm ${szintOsztaly(c.perc)}`}
          title={`${c.datum} — ${c.perc != null ? `${Math.floor(c.perc / 60)}:${String(c.perc % 60).padStart(2, "0")} óra vezetés` : "nincs adat"}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify (deferred to Task 10 end-to-end check)**

- [ ] **Step 3: Commit**

```bash
git add src/components/Tachograf/Heatmap.js
git commit -m "feat: add driving-time heatmap tile component"
```

---

### Task 6: `MegfelelosegiWidget.js` — compliance list

**Files:**
- Create: `src/components/Tachograf/MegfelelosegiWidget.js`

**Interfaces:**
- Consumes: `sorok` prop — array from `getTachografMegfeleloseg` (`[{sofor_id, nev, utolsoDatum, napokOta, statusz}]`); `onSoforClick(soforId)` callback.
- Produces: default export `MegfelelosegiWidget({ sorok, onSoforClick })`.

- [ ] **Step 1: Write the component**

```jsx
import React from "react";
import StatusBadge from "components/UI/StatusBadge.js";

const STATUSZ_BADGE = {
  rendben: { tone: "success", label: "Rendben" },
  esedekes: { tone: "warning", label: "Esedékes" },
  lejart: { tone: "danger", label: "Lejárt" },
  nincs_adat: { tone: "neutral", label: "Nincs adat" },
};
const STATUSZ_SORREND = { lejart: 0, esedekes: 1, nincs_adat: 2, rendben: 3 };

export default function MegfelelosegiWidget({ sorok, onSoforClick }) {
  if (!sorok || sorok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs még rögzített sofőr.</p>;
  }
  const rendezett = [...sorok].sort((a, b) => STATUSZ_SORREND[a.statusz] - STATUSZ_SORREND[b.statusz]);

  return (
    <ul className="divide-y divide-ink-100 dark:divide-ink-800">
      {rendezett.map((s) => {
        const badge = STATUSZ_BADGE[s.statusz] || STATUSZ_BADGE.nincs_adat;
        return (
          <li key={s.sofor_id} className="flex items-center justify-between gap-3 py-2.5">
            <button type="button" onClick={() => onSoforClick(s.sofor_id)} className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-brand-900 hover:underline dark:text-ink-50">{s.nev}</p>
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {s.utolsoDatum ? `utolsó letöltés: ${s.utolsoDatum} · ${s.napokOta} napja` : "még nincs letöltött kártya-adat"}
              </p>
            </button>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Verify (deferred to Task 10 end-to-end check)**

- [ ] **Step 3: Commit**

```bash
git add src/components/Tachograf/MegfelelosegiWidget.js
git commit -m "feat: add card-download compliance widget component"
```

---

### Task 7: `ImportWizard.js` — 3-step import wizard with confidence + summary

**Files:**
- Create: `src/components/Tachograf/ImportWizard.js`

**Interfaces:**
- Consumes: `open`, `onClose`, `soforok` (array `[{id, name}]` from `getSoforok`), `onApplied` (callback, called after a successful apply) props. Calls `fetchAction("elemezTachografDdd", ...)` and `fetchAction("alkalmazTachografImport", ...)`, same shapes as today plus the new `javaslatForras` field from Task 2.
- Produces: default export `ImportWizard({ open, onClose, soforok, onApplied })` — replaces the inline import-modal JSX currently in `Tachograf.js`.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from "react";
import { PiCheckCircleLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import Modal from "components/UI/Modal.js";
import FormField from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";
import StatusBadge from "components/UI/StatusBadge.js";

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  const ora = Math.floor(perc / 60);
  const p = perc % 60;
  return `${ora}:${String(p).padStart(2, "0")}`;
};

const fajlBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function ImportWizard({ open, onClose, soforok, onApplied }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [lepes, setLepes] = useState(1); // 1 feltöltés, 2 áttekintés, 3 megerősítés
  const [digests, setDigests] = useState([]);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestHaladas, setDigestHaladas] = useState(null);
  const [alkalmazasLoading, setAlkalmazasLoading] = useState(false);
  const [eredmeny, setEredmeny] = useState(null);

  const reset = () => {
    setLepes(1);
    setDigests([]);
    setDigestHaladas(null);
    setEredmeny(null);
  };

  const handleBezaras = () => {
    onClose();
    reset();
  };

  const handleFajlValasztas = async (e) => {
    const fajlok = Array.from(e.target.files || []);
    if (fajlok.length === 0) return;
    setDigestLoading(true);
    setDigestHaladas({ kesz: 0, osszes: fajlok.length });
    const ujDigestek = [];
    for (const file of fajlok) {
      try {
        const base64 = await fajlBase64(file);
        const result = await fetchAction("elemezTachografDdd", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          ddd: base64,
          fajlnev: file.name,
        });
        if (result?.success) {
          const kivalasztottNapok = {};
          (result.napok || []).forEach((nap) => {
            kivalasztottNapok[nap.datum] = !nap.marImportalva;
          });
          ujDigestek.push({
            fajlnev: file.name,
            kartyabirtokos: result.kartyabirtokos,
            napok: result.napok || [],
            esemenyek: result.esemenyek || [],
            hibak: result.hibak || [],
            valasztottSoforId: result.javasoltSoforId ? String(result.javasoltSoforId) : "",
            javaslatForras: result.javaslatForras || null,
            kivalasztottNapok,
          });
        } else {
          toast.error(`${file.name}: ${result?.message || "A fájl elemzése sikertelen."}`);
        }
      } catch (err) {
        toast.error(`${file.name}: a fájl beolvasása sikertelen.`);
      }
      setDigestHaladas((prev) => ({ ...prev, kesz: (prev?.kesz || 0) + 1 }));
    }
    setDigests((prev) => [...prev, ...ujDigestek]);
    setDigestLoading(false);
    setDigestHaladas(null);
    if (ujDigestek.length > 0) setLepes(2);
  };

  const setDigestMezo = (index, mezo, ertek) => {
    setDigests((prev) => prev.map((d, i) => (i === index ? { ...d, [mezo]: ertek } : d)));
  };

  const setDigestNapKijeloles = (index, datum, ertek) => {
    setDigests((prev) =>
      prev.map((d, i) => (i === index ? { ...d, kivalasztottNapok: { ...d.kivalasztottNapok, [datum]: ertek } } : d)),
    );
  };

  const osszesito = digests.reduce(
    (acc, d) => {
      const kivalasztott = d.napok.filter((n) => d.kivalasztottNapok[n.datum]).length;
      const mar = d.napok.filter((n) => n.marImportalva).length;
      return { ujNap: acc.ujNap + kivalasztott, marImportalt: acc.marImportalt + mar };
    },
    { ujNap: 0, marImportalt: 0 },
  );

  const handleAlkalmazas = async () => {
    const erintettDigestek = digests.filter((d) => d.napok.some((nap) => d.kivalasztottNapok[nap.datum]));
    if (erintettDigestek.length === 0) {
      toast.error("Nincs kiválasztva egyetlen importálandó nap sem.");
      return;
    }
    const hianyzoSofor = erintettDigestek.find((d) => !d.valasztottSoforId);
    if (hianyzoSofor) {
      toast.error(`${hianyzoSofor.fajlnev}: válassz sofőrt az importhoz.`);
      return;
    }

    setAlkalmazasLoading(true);
    try {
      let importaltOsszesen = 0;
      let kihagyvaOsszesen = 0;
      let hibaVolt = false;
      for (const d of erintettDigestek) {
        const napok = d.napok.filter((nap) => d.kivalasztottNapok[nap.datum]);
        const esemenyekOsszefesulve = [
          ...d.esemenyek.map((e) => ({ ...e, tipus: `esemeny_${e.tipus}` })),
          ...d.hibak.map((h) => ({ ...h, tipus: `hiba_${h.tipus}` })),
        ];
        const result = await fetchAction("alkalmazTachografImport", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          napok,
          sofor_id: d.valasztottSoforId,
          kartyaszam: d.kartyabirtokos.cardNumber,
          forrasFajlnev: d.fajlnev,
          esemenyek: esemenyekOsszefesulve,
        });
        if (result?.success) {
          importaltOsszesen += result.importalt;
          kihagyvaOsszesen += result.kihagyva;
        } else {
          hibaVolt = true;
          toast.error(`${d.fajlnev}: ${result?.message || "Az import sikertelen."}`);
        }
      }
      setEredmeny({ importalt: importaltOsszesen, kihagyva: kihagyvaOsszesen, hibaVolt });
      if (importaltOsszesen > 0 || !hibaVolt) {
        toast.success(`${importaltOsszesen} nap importálva (${kihagyvaOsszesen} már korábban rögzítve volt).`);
      }
      setLepes(3);
      onApplied();
    } finally {
      setAlkalmazasLoading(false);
    }
  };

  const LEPES_LABEL = ["Feltöltés", "Áttekintés", "Megerősítés"];

  return (
    <Modal open={open} onClose={handleBezaras} title="Tachográf kártya import" maxWidth="max-w-4xl">
      <div className="mb-5 flex gap-2 font-mono text-xs">
        {LEPES_LABEL.map((label, i) => (
          <span
            key={label}
            aria-current={lepes === i + 1 ? "step" : undefined}
            className={`rounded-full px-3 py-1 ${
              lepes === i + 1
                ? "bg-brand-600 text-white"
                : lepes > i + 1
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-slate-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
            }`}
          >
            {i + 1} · {label}
          </span>
        ))}
      </div>

      {lepes === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Töltsd fel a sofőrkártya-letöltés (.ddd) fájl(oka)t — egyszerre több sofőr kártyája is kiválasztható.
            A feltöltés még nem menti el az adatokat — előbb egy előnézetet mutatunk, amit jóváhagyás után lehet alkalmazni.
          </p>
          <FormField label="Fájlok kiválasztása" type="file" accept=".ddd,.DDD" multiple onChange={handleFajlValasztas} disabled={digestLoading} />
          {digestLoading && (
            <p className="text-sm text-ink-400">
              Fájlok elemzése folyamatban… ({digestHaladas?.kesz ?? 0}/{digestHaladas?.osszes ?? 0})
            </p>
          )}
        </div>
      )}

      {lepes === 2 && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-6 rounded-xl bg-brand-50 p-4 text-sm dark:bg-brand-950/30">
            <div><b className="block font-mono text-lg text-brand-700 dark:text-brand-300">{digests.length}</b>fájl</div>
            <div><b className="block font-mono text-lg text-brand-700 dark:text-brand-300">{osszesito.ujNap}</b>új nap</div>
            <div><b className="block font-mono text-lg text-brand-700 dark:text-brand-300">{osszesito.marImportalt}</b>már importált</div>
          </div>

          {digests.map((d, index) => (
            <div key={d.fajlnev + index} className="space-y-3 rounded-2xl border border-ink-100 p-4 dark:border-ink-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">{d.fajlnev}</p>
              <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-ink-800">
                <p className="font-semibold text-brand-900 dark:text-ink-50">
                  {d.kartyabirtokos.holderSurname} {d.kartyabirtokos.holderFirstNames}
                </p>
                <p className="text-ink-500 dark:text-ink-400">Kártyaszám: {d.kartyabirtokos.cardNumber}</p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <FormField
                    label="Sofőr"
                    as="select"
                    required
                    value={d.valasztottSoforId}
                    onChange={(e) => setDigestMezo(index, "valasztottSoforId", e.target.value)}
                  >
                    <option value="">Válassz sofőrt...</option>
                    {soforok.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </FormField>
                </div>
                {d.valasztottSoforId && d.javaslatForras === "kartyaszam" && (
                  <StatusBadge tone="success">Biztos egyezés (kártyaszám)</StatusBadge>
                )}
                {d.valasztottSoforId && d.javaslatForras === "nev" && (
                  <StatusBadge tone="warning">Erősítsd meg (név alapján)</StatusBadge>
                )}
              </div>

              <div className="max-h-96 overflow-auto rounded-xl border border-ink-100 dark:border-ink-700">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-ink-800">
                    <tr>
                      <th className="p-2 text-left">Import</th>
                      <th className="p-2 text-left">Dátum</th>
                      <th className="p-2 text-left">Táv</th>
                      <th className="p-2 text-left">Vezetés</th>
                      <th className="p-2 text-left">Jármű</th>
                      <th className="p-2 text-left">Állapot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.napok.map((nap) => (
                      <tr key={nap.datum} className="border-t border-ink-100 dark:border-ink-700">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!d.kivalasztottNapok[nap.datum]}
                            disabled={nap.marImportalva}
                            onChange={(e) => setDigestNapKijeloles(index, nap.datum, e.target.checked)}
                          />
                        </td>
                        <td className="p-2">{nap.datum}</td>
                        <td className="p-2">{nap.tavolsagKm} km</td>
                        <td className="p-2">{percToOraPerc(nap.vezetesPerc)}</td>
                        <td className="p-2">{(nap.jarmuvek || []).map((j) => j.rendszam).join(", ") || "—"}</td>
                        <td className="p-2">
                          {nap.marImportalva ? (
                            <StatusBadge tone="neutral">Már importálva</StatusBadge>
                          ) : (
                            <StatusBadge tone="success"><PiCheckCircleLight className="mr-1 inline h-3 w-3" />Új</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleBezaras} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
              Mégsem
            </button>
            <SaveButton onClick={handleAlkalmazas} isSaving={alkalmazasLoading} label="Import alkalmazása" savingLabel="Alkalmazás..." />
          </div>
        </div>
      )}

      {lepes === 3 && eredmeny && (
        <div className="space-y-4 text-center">
          <PiCheckCircleLight className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-lg font-semibold text-brand-900 dark:text-ink-50">
            {eredmeny.importalt} nap importálva
          </p>
          <p className="text-sm text-ink-500 dark:text-ink-400">{eredmeny.kihagyva} nap már korábban rögzítve volt.</p>
          <button
            type="button"
            onClick={handleBezaras}
            className="mx-auto flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Bezárás
          </button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Verify (deferred to Task 10 end-to-end check — this component has no meaning mounted alone)**

- [ ] **Step 3: Commit**

```bash
git add src/components/Tachograf/ImportWizard.js
git commit -m "feat: add 3-step tachograf import wizard with match-confidence and summary"
```

---

### Task 8: `ImportElozmenyek.js` — import audit tab

**Files:**
- Create: `src/components/Tachograf/ImportElozmenyek.js`

**Interfaces:**
- Consumes: `fetchAction("getTachografImportNaplo", { ceg_id, kerelmezo_id })`.
- Produces: default export `ImportElozmenyek()` (self-contained: loads its own data, no props needed).

- [ ] **Step 1: Write the component**

```jsx
import React, { useEffect, useState } from "react";
import { PiClockCounterClockwiseLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const FELTOLTO_LABEL = { admin: "Admin", sofor: "Sofőr" };

export default function ImportElozmenyek() {
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getTachografImportNaplo", { ceg_id: user.ceg_id, kerelmezo_id: user.id })
      .then((result) => setSorok(result?.success ? result.sorok || [] : []))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: "letrehozva", label: "Dátum" },
    { key: "fajlnev", label: "Fájl", render: (row) => row.fajlnev || "—" },
    { key: "sofor_nev", label: "Sofőr" },
    {
      key: "feltolto_nev",
      label: "Feltöltötte",
      render: (row) => (row.feltolto_nev ? `${row.feltolto_nev} (${FELTOLTO_LABEL[row.feltolto_tipus] || row.feltolto_tipus})` : "Ismeretlen"),
    },
    {
      key: "uj_nap",
      label: "Eredmény",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone="success">{row.uj_nap} új nap</StatusBadge>
          {row.kihagyott_nap > 0 && <StatusBadge tone="neutral">{row.kihagyott_nap} kihagyva</StatusBadge>}
        </div>
      ),
      exportValue: (row) => `${row.uj_nap} új, ${row.kihagyott_nap} kihagyva`,
    },
  ];

  return (
    <DataTable
      icon={PiClockCounterClockwiseLight}
      title="Import előzmények"
      columns={columns}
      rows={sorok}
      loading={loading}
      exportFilename="tachograf-import-elozmenyek"
      mobileTitleKey="fajlnev"
      emptyLabel="Még nem volt tachográf-import"
      fill
      searchable
      searchPlaceholder="Keresés fájlnév vagy sofőr szerint..."
    />
  );
}
```

- [ ] **Step 2: Verify (deferred to Task 10 end-to-end check)**

- [ ] **Step 3: Commit**

```bash
git add src/components/Tachograf/ImportElozmenyek.js
git commit -m "feat: add tachograf import history/audit tab component"
```

---

### Task 9: `SoforDrawer.js` — driver detail panel + reassignment

**Files:**
- Create: `src/components/Tachograf/SoforDrawer.js`

**Interfaces:**
- Consumes: `soforId`, `soforNev`, `onClose` props; `soforok` (array `[{id, name}]`, for the reassignment select); fetches its own filtered data via `fetchAction("getTachografNapiAktivitas", { ceg_id, kerelmezo_id, sofor_id })` and `fetchAction("getTachografEsemenyek", { ceg_id, kerelmezo_id, sofor_id })`; calls `fetchAction("atparositTachografNap", { id, ujSoforId, ceg_id, kerelmezo_id })`.
- Produces: default export `SoforDrawer({ soforId, soforNev, soforok, onClose })`.

- [ ] **Step 1: Write the component**

```jsx
import React, { useCallback, useEffect, useState } from "react";
import { PiArrowsLeftRightLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import Modal from "components/UI/Modal.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Heatmap from "components/Tachograf/Heatmap.js";
import NapiIdovonalSav from "components/Tachograf/NapiIdovonalSav.js";
import FormField from "components/UI/FormField.js";

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  return `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;
};

export default function SoforDrawer({ soforId, soforNev, soforok, onClose }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [sorok, setSorok] = useState([]);
  const [esemenyek, setEsemenyek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reszletNap, setReszletNap] = useState(null);
  const [atparositasSor, setAtparositasSor] = useState(null);
  const [ujSoforId, setUjSoforId] = useState("");
  const [atparositasLoading, setAtparositasLoading] = useState(false);

  const betoltes = useCallback(() => {
    if (!soforId) return;
    setLoading(true);
    Promise.all([
      fetchAction("getTachografNapiAktivitas", { ceg_id: user.ceg_id, kerelmezo_id: user.id, sofor_id: soforId }),
      fetchAction("getTachografEsemenyek", { ceg_id: user.ceg_id, kerelmezo_id: user.id, sofor_id: soforId }),
    ])
      .then(([napiResult, esemenyResult]) => {
        setSorok(napiResult?.success ? napiResult.sorok || [] : []);
        setEsemenyek(esemenyResult?.success ? esemenyResult.sorok || [] : []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soforId]);

  useEffect(() => {
    betoltes();
  }, [betoltes]);

  const handleAtparositas = async () => {
    if (!ujSoforId) {
      toast.error("Válassz sofőrt.");
      return;
    }
    setAtparositasLoading(true);
    const result = await fetchAction("atparositTachografNap", {
      id: atparositasSor.id,
      ujSoforId,
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    });
    setAtparositasLoading(false);
    if (result?.success) {
      toast.success("A napló-bejegyzés átpárosítva.");
      setAtparositasSor(null);
      setUjSoforId("");
      betoltes();
    } else {
      toast.error(result?.message || "Az átpárosítás sikertelen.");
    }
  };

  const columns = [
    { key: "datum", label: "Dátum", sortable: true },
    { key: "tavolsag_km", label: "Táv", render: (row) => (row.tavolsag_km != null ? `${row.tavolsag_km} km` : "—") },
    { key: "vezetes_perc", label: "Vezetés", render: (row) => percToOraPerc(row.vezetes_perc) },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiArrowsLeftRightLight />} onClick={() => setAtparositasSor(row)} title="Átpárosítás másik sofőrre" />
        </div>
      ),
    },
  ];

  if (!soforId) return null;

  return (
    <Modal open={!!soforId} onClose={onClose} title={`Sofőr — ${soforNev || ""}`} maxWidth="max-w-3xl">
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Vezetési idő, elmúlt 4 hét</h4>
          <Heatmap sorok={sorok} napokSzama={28} />
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Napi napló</h4>
          <DataTable
            columns={columns}
            rows={sorok}
            loading={loading}
            mobileTitleKey="datum"
            emptyLabel="Nincs importált tachográf-adat erre a sofőrre"
            searchable={false}
          />
        </div>

        {esemenyek.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Események / hibák</h4>
            <ul className="space-y-1 text-sm">
              {esemenyek.map((e) => (
                <li key={e.id} className="text-ink-600 dark:text-ink-300">{e.kezdet} — {e.tipus}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Modal open={!!reszletNap} onClose={() => setReszletNap(null)} title={reszletNap ? `Napi részletek — ${reszletNap.datum}` : ""} maxWidth="max-w-lg">
        {reszletNap && <NapiIdovonalSav valtozasok={reszletNap.aktivitas_json} />}
      </Modal>

      <Modal open={!!atparositasSor} onClose={() => setAtparositasSor(null)} title="Napló-bejegyzés átpárosítása" maxWidth="max-w-md">
        {atparositasSor && (
          <div className="space-y-4">
            <p className="text-sm text-ink-500 dark:text-ink-400">
              A {atparositasSor.datum} napi bejegyzés jelenleg <b>{soforNev}</b> sofőrhöz van rendelve.
            </p>
            <FormField label="Új sofőr" as="select" required value={ujSoforId} onChange={(e) => setUjSoforId(e.target.value)}>
              <option value="">Válassz sofőrt...</option>
              {soforok.filter((s) => String(s.id) !== String(soforId)).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </FormField>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAtparositasSor(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
                Mégsem
              </button>
              <button
                type="button"
                disabled={atparositasLoading}
                onClick={handleAtparositas}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {atparositasLoading ? "Mentés..." : "Átpárosítás"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
}
```

**Note:** `getTachografNapiAktivitas`/`getTachografEsemenyek` already accept an optional `sofor_id` param server-side (`TachografInterface::getNapiAktivitas($sofor_id, ...)`/`getEsemenyek($sofor_id, ...)` from the existing code) — no backend change needed for this filtering, only the frontend call gains the `sofor_id` param.

- [ ] **Step 2: Verify (deferred to Task 10 end-to-end check)**

- [ ] **Step 3: Commit**

```bash
git add src/components/Tachograf/SoforDrawer.js
git commit -m "feat: add per-driver tachograf detail modal with reassignment"
```

---

### Task 10: `SoforokLista.js` — driver-centric tab

**Files:**
- Create: `src/components/Tachograf/SoforokLista.js`

**Interfaces:**
- Consumes: `soforAttekintes` prop (from `getTachografSoforOsszesito`), `loading`, `kezdoSoforId` (string|null, deep-link), `onBezar` (called when the drawer closes, to clear the deep-link query param) props.
- Produces: default export `SoforokLista({ soforAttekintes, loading, kezdoSoforId, onBezar })`.

- [ ] **Step 1: Write the component**

```jsx
import React, { useEffect, useState } from "react";
import { PiUsersLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";
import SoforDrawer from "components/Tachograf/SoforDrawer.js";

const percToOraPerc = (perc) => `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;

export default function SoforokLista({ soforAttekintes, loading, kezdoSoforId, onBezar }) {
  const [nyitottSoforId, setNyitottSoforId] = useState(kezdoSoforId || null);
  const [soforok, setSoforok] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
  }, []);

  useEffect(() => {
    setNyitottSoforId(kezdoSoforId || null);
  }, [kezdoSoforId]);

  const soforNev = (id) => soforAttekintes.find((s) => String(s.sofor_id) === String(id))?.nev;

  const columns = [
    { key: "nev", label: "Sofőr", className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "utolsoDatum",
      label: "Utolsó letöltés",
      render: (row) => row.utolsoDatum || "—",
    },
    {
      key: "vezetesPerc7Nap",
      label: "Vezetés (7 nap)",
      render: (row) => (row.vanAdat ? `${percToOraPerc(row.vezetesPerc7Nap)} óra` : "—"),
    },
    {
      key: "km30Nap",
      label: "Km (30 nap)",
      render: (row) => (row.vanAdat ? `${row.km30Nap.toLocaleString("hu-HU")} km` : "—"),
    },
    {
      key: "tulOraNapok",
      label: "Túlórás napok",
      render: (row) => (row.tulOraNapok > 0 ? <StatusBadge tone="warning">{row.tulOraNapok} nap</StatusBadge> : "—"),
    },
  ];

  return (
    <>
      <DataTable
        icon={PiUsersLight}
        title="Sofőrönként"
        columns={columns}
        rows={soforAttekintes}
        loading={loading}
        exportFilename="tachograf-soforok"
        mobileTitleKey="nev"
        emptyLabel="Nincs megjeleníthető sofőr"
        fill
        searchable
        searchPlaceholder="Keresés név szerint..."
        onRowClick={(row) => setNyitottSoforId(row.sofor_id)}
      />
      {nyitottSoforId && (
        <SoforDrawer
          soforId={nyitottSoforId}
          soforNev={soforNev(nyitottSoforId)}
          soforok={soforok}
          onClose={() => {
            setNyitottSoforId(null);
            onBezar();
          }}
        />
      )}
    </>
  );
}
```

**Note:** this assumes `DataTable` accepts an `onRowClick` prop. Before writing this file, confirm by reading `src/components/UI/DataTable.js`'s prop list — if `onRowClick` doesn't exist yet, add it there first (wire it as an `onClick` on each desktop `<tr>` and each mobile row-card, no-op when not passed, so every other `DataTable` consumer is unaffected), then use it here.

- [ ] **Step 2: Check/add `onRowClick` to `DataTable.js` if missing**

Run: `grep -n "onRowClick" src/components/UI/DataTable.js`

If no match: open `src/components/UI/DataTable.js`, find the desktop `<tr>` render and the mobile card render, and add `onClick={() => onRowClick?.(row)}` plus (desktop only) `className` cursor styling conditional on `onRowClick` being passed — mirroring how the file already handles other optional per-row behaviors (e.g. `mobileHidden` columns). Add `onRowClick` to the component's prop destructuring with a default of `undefined`.

- [ ] **Step 3: Verify (deferred to Task 12 end-to-end check)**

- [ ] **Step 4: Commit**

```bash
git add src/components/Tachograf/SoforokLista.js src/components/UI/DataTable.js
git commit -m "feat: add driver-centric tachograf list tab with drawer drill-down"
```

---

### Task 11: `Tachograf.js` — tab shell rewrite

**Files:**
- Modify: `src/views/admin/Tachograf.js` (full rewrite)

**Interfaces:**
- Consumes: `MegfelelosegiWidget`, `Heatmap`, `SoforokLista`, `ImportElozmenyek`, `ImportWizard`, `NapiIdovonalSav` from Tasks 4–10; `getTachografNapiAktivitas`, `getTachografEsemenyek`, `getTachografMegfeleloseg`, `getTachografSoforOsszesito`, `getSoforok` actions.
- Produces: default export `Tachograf()`, mounted at `/admin/tachograf` (unchanged route), now reading `?sofor=<id>` from the URL to deep-link into the Sofőrök tab.

- [ ] **Step 1: Replace the full file contents**

```jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiIdentificationCardLight,
  PiUploadLight,
  PiWarningCircleLight,
  PiRoadHorizonLight,
  PiUsersLight,
  PiClockCountdownLight,
  PiEyeLight,
} from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import CardStats from "components/Cards/CardStats.js";
import Modal from "components/UI/Modal.js";
import MegfelelosegiWidget from "components/Tachograf/MegfelelosegiWidget.js";
import Heatmap from "components/Tachograf/Heatmap.js";
import SoforokLista from "components/Tachograf/SoforokLista.js";
import ImportElozmenyek from "components/Tachograf/ImportElozmenyek.js";
import ImportWizard from "components/Tachograf/ImportWizard.js";
import NapiIdovonalSav from "components/Tachograf/NapiIdovonalSav.js";

// Tachográf modul — UX-újratervezés (2026-07-23, ld. a publikált koncepció-
// dokumentumot). 4 fülre bontva (Áttekintés/Sofőrök/Napló/Import előzmények)
// a korábbi, mindent egy lapon mutató nézet helyett. A dekódolást változatlanul
// a backend `DddParser.php`-ja végzi.
const FULEK = [
  { key: "attekintes", label: "Áttekintés" },
  { key: "soforok", label: "Sofőrök" },
  { key: "naplo", label: "Napló" },
  { key: "import", label: "Import előzmények" },
];

const percToOraPerc = (perc) => {
  if (perc == null) return "—";
  const ora = Math.floor(perc / 60);
  const p = perc % 60;
  return `${ora}:${String(p).padStart(2, "0")}`;
};

// A "Napló" fül továbbra is a nyers EU-kódot mutatja emberi jelentés nélkül
// (a projekt "no fake data" elve miatt — ld. DddParser.php megjegyzése),
// csak a kategóriát (Esemény/Hiba) fordítja emberi nyelvre.
const formatEsemenyTipus = (tipus) => {
  const [kategoria, kod] = String(tipus || "").split("_");
  const label = kategoria === "hiba" ? "Hiba" : "Esemény";
  return kod ? `${label} (kód: ${kod})` : tipus;
};

export default function Tachograf() {
  const user = JSON.parse(localStorage.getItem("user"));
  const history = useHistory();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const kezdoSoforId = query.get("sofor");

  const [aktivFul, setAktivFul] = useState(kezdoSoforId ? "soforok" : "attekintes");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [reszletModalNap, setReszletModalNap] = useState(null);

  const [sorok, setSorok] = useState([]);
  const [esemenyek, setEsemenyek] = useState([]);
  const [megfeleloseg, setMegfeleloseg] = useState([]);
  const [soforAttekintes, setSoforAttekintes] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [loading, setLoading] = useState(true);

  const betoltes = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchAction("getTachografNapiAktivitas", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografEsemenyek", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografMegfeleloseg", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getTachografSoforOsszesito", { ceg_id: user.ceg_id, kerelmezo_id: user.id }),
    ])
      .then(([napiResult, esemenyResult, megfelResult, attekintesResult]) => {
        setSorok(napiResult?.success ? napiResult.sorok || [] : []);
        setEsemenyek(esemenyResult?.success ? esemenyResult.sorok || [] : []);
        setMegfeleloseg(megfelResult?.success ? megfelResult.sorok || [] : []);
        setSoforAttekintes(attekintesResult?.success ? attekintesResult.sorok || [] : []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    betoltes();
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betoltes]);

  const megySoforre = (soforId) => {
    setAktivFul("soforok");
    history.replace(`/admin/tachograf?sofor=${soforId}`);
  };

  const hetKm = sorok
    .filter((s) => {
      const napja = new Date(s.datum);
      const most = new Date();
      const diffNapok = (most - napja) / (1000 * 60 * 60 * 24);
      return diffNapok >= 0 && diffNapok < 7;
    })
    .reduce((sum, s) => sum + (s.tavolsag_km || 0), 0);
  const tulOraSzam = sorok.filter((s) => s.vezetes_perc > 9 * 60).length;
  const lefedettSoforSzam = soforAttekintes.filter((s) => s.vanAdat).length;

  const naploColumns = [
    { key: "datum", label: "Dátum", sortable: true },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "tavolsag_km", label: "Táv", sortable: true, render: (row) => (row.tavolsag_km != null ? `${row.tavolsag_km} km` : "—") },
    { key: "vezetes_perc", label: "Vezetés", sortable: true, render: (row) => percToOraPerc(row.vezetes_perc) },
    { key: "munka_perc", label: "Munka", render: (row) => percToOraPerc(row.munka_perc), mobileHidden: true },
    { key: "piheno_perc", label: "Pihenő", render: (row) => percToOraPerc(row.piheno_perc), mobileHidden: true },
    {
      key: "jarmuvek_json",
      label: "Jármű",
      render: (row) => (row.jarmuvek_json || []).map((j) => j.rendszam).join(", ") || "—",
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiEyeLight />} onClick={() => setReszletModalNap(row)} title="Napi részletek" />
        </div>
      ),
    },
  ];

  const esemenyColumns = [
    { key: "kezdet", label: "Kezdet" },
    { key: "veg", label: "Vég", render: (row) => row.veg || "—" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "rendszam", label: "Rendszám", render: (row) => row.rendszam || "—" },
    { key: "tipus", label: "Típus", render: (row) => formatEsemenyTipus(row.tipus) },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
      <div className="flex-shrink-0">
        <PageHeader
          eyebrow="Csapat"
          title="Tachográf"
          action={
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              <PiUploadLight className="h-4 w-4" />
              Import
            </button>
          }
        />
      </div>

      <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-ink-100 dark:border-ink-800">
        {FULEK.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setAktivFul(f.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
              aktivFul === f.key
                ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-ink-400 hover:text-ink-600 dark:text-ink-500 dark:hover:text-ink-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {aktivFul === "attekintes" && (
        <>
          <div className="grid flex-shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CardStats statSubtitle="Vezetett km (elmúlt 7 nap)" statTitle={`${hetKm.toLocaleString("hu-HU")} km`} statIcon={PiRoadHorizonLight} tone="brand" layout="row" />
            <CardStats statSubtitle="Rögzített napok száma" statTitle={sorok.length} statIcon={PiIdentificationCardLight} tone="neutral" layout="row" />
            <CardStats statSubtitle="Sofőr lefedettség" statTitle={`${lefedettSoforSzam}/${soforAttekintes.length}`} statIcon={PiUsersLight} tone="neutral" layout="row" />
            <CardStats
              statSubtitle="Napok 9 óra feletti vezetéssel"
              statCaption="Napi 9 óra (EU 561/2006) — nyers küszöbérték, nem jogi minősítés"
              statTitle={tulOraSzam}
              statIcon={PiWarningCircleLight}
              tone={tulOraSzam > 0 ? "warning" : "neutral"}
              layout="row"
            />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900 xl:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-brand-900 dark:text-ink-50">
                <PiClockCountdownLight className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                Kártya-letöltés esedékessége
              </h3>
              <MegfelelosegiWidget sorok={megfeleloseg} onSoforClick={megySoforre} />
            </div>
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900">
              <h3 className="mb-3 font-display text-base font-semibold text-brand-900 dark:text-ink-50">Vezetési idő, elmúlt 4 hét</h3>
              <Heatmap sorok={sorok} napokSzama={28} />
            </div>
          </div>
        </>
      )}

      {aktivFul === "soforok" && (
        <div className="min-h-0 flex-1">
          <SoforokLista
            soforAttekintes={soforAttekintes}
            loading={loading}
            kezdoSoforId={kezdoSoforId}
            onBezar={() => history.replace("/admin/tachograf")}
          />
        </div>
      )}

      {aktivFul === "naplo" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1">
            <DataTable
              icon={PiIdentificationCardLight}
              title="Napi vezetési/pihenő idő"
              columns={naploColumns}
              rows={sorok}
              loading={loading}
              exportFilename="tachograf-napi-aktivitas"
              mobileTitleKey="datum"
              emptyLabel="Nincs még importált tachográf-adat"
              fill
              searchable
              searchPlaceholder="Keresés dátum vagy sofőr szerint..."
            />
          </div>
          {esemenyek.length > 0 && (
            <div className="flex-shrink-0">
              <DataTable
                icon={PiWarningCircleLight}
                title="Rögzített események / hibák"
                columns={esemenyColumns}
                rows={esemenyek}
                loading={false}
                exportFilename="tachograf-esemenyek"
                mobileTitleKey="tipus"
                emptyLabel="Nincs rögzített esemény vagy hiba"
              />
            </div>
          )}
        </div>
      )}

      {aktivFul === "import" && (
        <div className="min-h-0 flex-1">
          <ImportElozmenyek />
        </div>
      )}

      <ImportWizard open={importModalOpen} onClose={() => setImportModalOpen(false)} soforok={soforok} onApplied={betoltes} />

      <Modal open={!!reszletModalNap} onClose={() => setReszletModalNap(null)} title={reszletModalNap ? `Napi részletek — ${reszletModalNap.datum}` : ""} maxWidth="max-w-lg">
        {reszletModalNap && <NapiIdovonalSav valtozasok={reszletModalNap.aktivitas_json} />}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Rebuild Tailwind (new classes introduced across Tasks 4–11)**

Run: `npx tailwindcss -i ./src/assets/styles/index.css -o ./src/assets/styles/tailwind.css`
Then confirm the new classes actually compiled: `grep -c "bg-brand-200\|bg-amber-500\|bg-emerald-500" src/assets/styles/tailwind.css` — expected: a nonzero count for each (this project has a documented gotcha where a class present in JSX but never used elsewhere silently doesn't exist in the pre-built CSS until this rebuild runs).

- [ ] **Step 3: Manual end-to-end verification in the browser**

With the CRA dev server (port 3000) and PHP backend (port 8001) both running, and a real admin session set in `localStorage` (`user`/`sessionToken`, per this project's documented headless-verification pattern):

1. Navigate to `/admin/tachograf` — confirm the page title reads "Tachográf" (not "Tachográf kártya") and 4 tabs render.
2. Áttekintés tab: confirm 4 KPI tiles, the "Kártya-letöltés esedékessége" list (with colored badges), and the heatmap grid all render without console errors.
3. Click a driver name in the compliance list — confirm it switches to the Sofőrök tab, the URL becomes `/admin/tachograf?sofor=<id>`, and that driver's detail modal opens automatically.
4. In the driver modal: confirm the heatmap, the per-driver table, and (if any exist) events render; close it and confirm the URL reverts to `/admin/tachograf`.
5. Sofőrök tab: click a table row directly — confirm the same detail modal opens.
6. Napló tab: confirm the original flat table still works (search, sort, export), and clicking the eye icon opens the day-detail modal showing a **colored bar**, not a bulleted list.
7. Import előzmények tab: confirm it loads (empty state acceptable if no imports exist locally yet).
8. Click "+ Import", upload the real sample `.ddd` file used in prior sessions of this project (`HU_HUG00002180770_ZSOLT LASZLO_VER_202607171825.DDD` per this project's own history, if still available locally) — confirm step 1→2 transition happens automatically, the step indicator highlights step 2, the summary bar shows nonzero counts, and the driver select shows a "Biztos egyezés"/"Erősítsd meg" badge next to it. Apply the import and confirm step 3 shows a success summary, then close and confirm the Áttekintés tab's numbers updated.
9. Re-open Import előzmények — confirm the just-applied import now appears as a row with the correct file name and day counts.
10. Repeat steps 1–3 in dark mode (`document.documentElement` `data-theme="dark"` or the app's own dark-mode toggle) — confirm no light-mode leaks on any new component (compliance badges, heatmap cells, wizard summary bar, step indicator).

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/Tachograf.js src/assets/styles/tailwind.css
git commit -m "feat: rewrite Tachograf.js as a 4-tab module (Áttekintés/Sofőrök/Napló/Import előzmények)"
```

---

### Task 12: Rename in Sidebar navigation

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js`

**Interfaces:**
- No new interfaces — pure label change at the two locations found by `grep -n "Tachograf" src/components/Sidebar/Sidebar.js` (desktop nav item text and mobile nav item text, both currently "Tachográf kártya").

- [ ] **Step 1: Rename the label**

Find both occurrences of the visible label `Tachográf kártya` in `src/components/Sidebar/Sidebar.js` (desktop nav around line 102's `to: "/admin/tachograf"` entry, and the mobile nav around line 664's `to="/admin/tachograf"` entry) and change the label text to `Tachográf`. Do not change the `to`/route paths.

- [ ] **Step 2: Verify in the browser**

Navigate the app and confirm both the desktop sidebar "Csapat" group and the mobile bottom-nav "Csapat" picker now show "Tachográf" (not "Tachográf kártya"), on both a desktop-width and a mobile-width viewport.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/Sidebar.js
git commit -m "fix: rename Tachográf kártya nav label to Tachográf"
```

---

### Task 13: Cross-link from Sofőr-riport

**Files:**
- Modify: `src/views/admin/SoforScorecard.js`

**Interfaces:**
- No backend change — uses `react-router-dom`'s `useHistory` to navigate to `/admin/tachograf?sofor=<id>`, the deep-link contract established in Task 11.

- [ ] **Step 1: Make the tachográf column clickable**

In `src/views/admin/SoforScorecard.js`, add the import:

```js
import { useHistory } from "react-router-dom";
```

Inside `export default function SoforScorecard()`, add right after the existing `useState`/`useCallback` declarations:

```js
  const history = useHistory();
```

Then replace the `tachograf` column's `render` function:

```js
      render: (row) => {
        if (row.tachograf_utolso_datum == null) return "—";
        return (
          <div className="flex items-center gap-2">
            <span>{percToOraPerc(row.tachograf_vezetes_perc_7nap || 0)} óra</span>
            {row.tachograf_tul_ora_napok > 0 && (
              <StatusBadge tone="warning">{row.tachograf_tul_ora_napok} nap 9ó felett</StatusBadge>
            )}
          </div>
        );
      },
```

with:

```js
      render: (row) => {
        if (row.tachograf_utolso_datum == null) return "—";
        return (
          <button
            type="button"
            onClick={() => history.push(`/admin/tachograf?sofor=${row.sofor_id}`)}
            className="flex items-center gap-2 hover:underline"
          >
            <span>{percToOraPerc(row.tachograf_vezetes_perc_7nap || 0)} óra</span>
            {row.tachograf_tul_ora_napok > 0 && (
              <StatusBadge tone="warning">{row.tachograf_tul_ora_napok} nap 9ó felett</StatusBadge>
            )}
          </button>
        );
      },
```

- [ ] **Step 2: Verify in the browser**

Navigate to `/admin/sofor-riport` (or the app's actual Sofőr-riport route), click a driver's tachográf-time cell, and confirm it navigates to `/admin/tachograf?sofor=<that driver's id>` with the driver's detail modal open.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/SoforScorecard.js
git commit -m "feat: link Sofőr-riport tachograf column to the Tachográf driver drawer"
```

---

### Task 14: Dashboard "Teendők" — 4th source

**Files:**
- Modify: `src/views/admin/Dashboard.js`

**Interfaces:**
- Consumes: `getTeendok` action's new `tachografLetoltesek` field (Task 3).
- Produces: `TeendokCard` renders a 4th list section; total count badge includes it.

- [ ] **Step 1: Add the icon import**

Find the `react-icons/pi` import block in `src/views/admin/Dashboard.js` and add `PiIdentificationCardLight` to it (alongside the existing icons already imported there).

- [ ] **Step 2: Extend `TeendokCard`'s total count and state shape**

Replace:

```jsx
function TeendokCard({ className, teendok, onElbiral, onAjanlatkeresFelvette, onNavigate, elbiralasAlatt }) {
  const osszesen = teendok.jarmuValtas.length + teendok.bejelentesek.length + teendok.ajanlatkeresek.length;
  if (osszesen === 0) return null;
```

with:

```jsx
function TeendokCard({ className, teendok, onElbiral, onAjanlatkeresFelvette, onNavigate, elbiralasAlatt }) {
  const osszesen =
    teendok.jarmuValtas.length + teendok.bejelentesek.length + teendok.ajanlatkeresek.length + teendok.tachografLetoltesek.length;
  if (osszesen === 0) return null;
```

- [ ] **Step 3: Add the 4th `<li>` block**

Right after the closing `))}` of the existing `teendok.ajanlatkeresek.map((a) => (...))` block (i.e. right before the closing `</ul>`), add:

```jsx
        {teendok.tachografLetoltesek.map((t) => (
          <li key={`tacho-${t.sofor_id}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="flex items-start gap-2.5 min-w-0">
              <PiIdentificationCardLight className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <p className="min-w-0 text-sm text-ink-700 dark:text-ink-100">
                <span className="font-semibold">{t.nev}</span>{" "}
                {t.statusz === "lejart" ? "kártya-letöltése lejárt" : "kártya-letöltése esedékes"}
                <span className="block text-xs text-ink-400 dark:text-ink-500">
                  {t.utolsoDatum ? `utolsó letöltés: ${t.utolsoDatum} · ${t.napokOta} napja` : "még nincs adat"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(`/admin/tachograf?sofor=${t.sofor_id}`)}
              className="flex flex-shrink-0 items-center gap-1 self-end rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 sm:self-auto"
            >
              Megnyitás <PiArrowRightLight className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
```

- [ ] **Step 4: Update the `teendok` state default and mapping**

Replace:

```jsx
  const [teendok, setTeendok] = useState({ jarmuValtas: [], bejelentesek: [], ajanlatkeresek: [] });
```

with:

```jsx
  const [teendok, setTeendok] = useState({ jarmuValtas: [], bejelentesek: [], ajanlatkeresek: [], tachografLetoltesek: [] });
```

Replace:

```jsx
        setTeendok({
          jarmuValtas: result.jarmuValtas || [],
          bejelentesek: result.bejelentesek || [],
          ajanlatkeresek: result.ajanlatkeresek || [],
        });
```

with:

```jsx
        setTeendok({
          jarmuValtas: result.jarmuValtas || [],
          bejelentesek: result.bejelentesek || [],
          ajanlatkeresek: result.ajanlatkeresek || [],
          tachografLetoltesek: result.tachografLetoltesek || [],
        });
```

- [ ] **Step 5: Verify in the browser**

With at least one driver in the local DB whose `tachograf_napi_aktivitas` rows are all older than 21 days (or who has none at all is NOT enough — `nincs_adat` drivers are intentionally excluded from Teendők, only `esedekes`/`lejart` show), navigate to `/admin/dashboard` and confirm the Teendők card shows a "kártya-letöltése esedékes/lejárt" row with a working "Megnyitás" link to the Tachográf module's driver drawer. If no local driver currently qualifies, temporarily backdate one test row's `datum` in `tachograf_napi_aktivitas` via `mysql -uroot kamion`, verify, then restore/delete the test row.

- [ ] **Step 6: Commit**

```bash
git add src/views/admin/Dashboard.js
git commit -m "feat: surface overdue tachograf card downloads in Dashboard Teendők"
```

---

## Self-Review Notes

- **Spec coverage:** every MVP item (4 tabs, compliance widget, import wizard summary+confidence, visual timeline, rename) is covered by Tasks 4, 6, 7, 11, 12. Every V2 item (import audit tab, heatmap, Sofőr-riport deep link, reassignment, Teendők integration) is covered by Tasks 5, 8, 9, 13, 14.
- **Type consistency checked:** `getSoforOsszesito()` (Task 2) return shape (`utolsoDatum`/`vezetesPerc7Nap`/`km30Nap`/`tulOraNapok`, keyed by `sofor_id`) is used identically in the refactored `getSoforScorecard()` (Task 3) and in `getSoforAttekintes()` (Task 2) — same key names throughout. `getMegfelelosegiLista()`'s row shape (`sofor_id`/`nev`/`utolsoDatum`/`napokOta`/`statusz`) is consumed identically by `MegfelelosegiWidget.js` (Task 6), `Tachograf.js`'s Áttekintés tab (Task 11), and `getTeendok()`'s new field (Task 3) — no renamed fields across these.
- **No placeholders:** every task above contains complete, copy-pasteable code — confirmed by re-reading each task.
- **Known follow-up, not in this plan's scope:** the concept's V3 items (driver-facing self-view, median-based consumption anomaly detection, real EU event/fault code meanings) are intentionally excluded per the user's chosen scope (MVP + V2 only).
