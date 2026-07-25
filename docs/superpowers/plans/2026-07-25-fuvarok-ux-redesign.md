# Fuvarok / Beérkezett dokumentumok UX-redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the two-module/two-table structure (`beerkezett_dokumentumok` staging,
`fuvarok` final record) but make the connection between them visible and usable: sidebar
badge + cross-links, a real inbox (multi-upload, search/filter, document preview, discard),
and a Kanban/status-overview layer on the Fuvarok list — per
`docs/superpowers/specs/2026-07-25-fuvarok-ux-redesign-design.md`.

**Architecture:** One additive SQL column (`fuvarok.beerkezett_dokumentum_id`), five new/extended
backend actions on the existing `FuvarInterface`/`BeerkezettDokumentumInterface` classes (no new
interface files), and a `src/components/Fuvarok/` component folder (mirroring the existing
`src/components/Fajlok/` split) for the new frontend pieces. No new npm/composer dependencies —
the Kanban drag&drop is native HTML5 `draggable`/`onDragStart`/`onDragOver`/`onDrop`.

**Tech Stack:** PHP 8.2 (no framework), PDO/MySQL (MariaDB, InnoDB), React 17 + `react-router-dom`
v5, Tailwind (pre-built `tailwind.css`, not auto-compiled).

## Global Constraints

- No composer/npm dependencies may be added.
- Every new/changed PHP query scopes by `admin = :ceg_id` (server-resolved via
  `resolveKerelmezo()['ceg_id']`, never trusted from the client) and, where the table has it,
  `torolt <> 'I'`.
- Every new/changed action needs 3 wiring points in `backend/ApiHandler.php`: `getActions()`
  entry, `process()` `case` block, and `MODULE_PERMISSION_MAP` entry (`['fuvarok', 'hozzaferes'
  |'szerkesztes'|'torles']`) — this project's own CLAUDE.md flags this as the easiest step to
  forget.
- New Tailwind utility classes used in JSX are not auto-compiled by the CRA dev server — run
  `npm run build:tailwind` after adding any class not already present in the compiled
  `tailwind.css`, before visually verifying in a browser.
- SQL migrations go in `backend/sql/N.sql`, sequential. The latest **committed** file as of this
  plan is `34.sql` — this plan's migration is `backend/sql/35.sql`.
- No PHP or JS test framework exists in this repo. "Tests" in this plan are live verification: a
  `curl` call against the running local API (`cd backend && php8.2 -S localhost:8001`), checked
  against the real local MariaDB (`mysql -uroot kamion`), and/or a real browser click-through
  (Playwright or manual). `php8.2 -l` lints every touched PHP file.
- Every list/edit action in this plan reuses the *existing* session-resolution helpers
  (`resolveKerelmezo()`) exactly as `FuvarInterface`/`BeerkezettDokumentumInterface` already do —
  no new auth pattern is introduced.

---

### Task 1: SQL migration — `fuvarok.beerkezett_dokumentum_id`

**Files:**
- Create: `backend/sql/35.sql`

**Interfaces:**
- Produces: column `fuvarok.beerkezett_dokumentum_id` (nullable INT, indexed) — the reverse
  cross-link Task 2 populates and Task 13's `FuvarDokumentumLink` reads.

- [ ] **Step 1: Write the migration file**

```sql
-- Fuvarok / Beérkezett dokumentumok UX-redesign (docs/superpowers/specs/
-- 2026-07-25-fuvarok-ux-redesign-design.md, 7. pont). Additív oszlop —
-- fordított irányú kereszthivatkozás: a beerkezett_dokumentumok.fuvar_id
-- már létezik (33.sql), ez a fordított irány, hogy a Fuvar-form/lista is
-- meg tudja mutatni "ebből a dokumentumból készült". Nem hard FK
-- constraint — a projekt egyetlen táblája sem definiál valódi FOREIGN
-- KEY-t, a referenciális integritás mindenhol konvenció-alapú.
ALTER TABLE fuvarok ADD COLUMN beerkezett_dokumentum_id INT NULL AFTER fuvarlevel_szam;
ALTER TABLE fuvarok ADD INDEX idx_beerkezett_dokumentum (beerkezett_dokumentum_id);
```

- [ ] **Step 2: Run it against the local DB**

Run: `mysql -uroot kamion < backend/sql/35.sql`
Expected: no output (success).

- [ ] **Step 3: Verify**

Run: `mysql -uroot kamion -e "SHOW COLUMNS FROM fuvarok LIKE 'beerkezett_dokumentum_id';"`
Expected: one row, `Type: int(11)`, `Null: YES`.

- [ ] **Step 4: Commit**

```bash
git add backend/sql/35.sql
git commit -m "$(cat <<'EOF'
feat(fuvar): add fuvarok.beerkezett_dokumentum_id reverse cross-link

Additive column so a Fuvar record can point back at the document it was
created from (beerkezett_dokumentumok.fuvar_id already covers the other
direction). Part of the Fuvarok/Beérkezett dokumentumok UX redesign.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `FuvarInterface` — persist the reverse link on document→fuvar creation

**Files:**
- Modify: `backend/interface/fuvarInterface.php`

**Interfaces:**
- Consumes: `fuvarok.beerkezett_dokumentum_id` (Task 1).
- Produces: `newFuvar($data, $ceg_id)`/`updateFuvar($data, $ceg_id)` now also persist
  `$data['beerkezett_dokumentum_id']`; `letrehozDokumentumbol()` always sets it to the source
  document's id (never overridable via `$felulirasok`).

- [ ] **Step 1: Add the column to both queries and the shared binder**

In `newFuvar()`, change the INSERT:
```php
$query = "INSERT INTO fuvarok (admin, sofor_id, kamion_id, furgon_id, potkocsi_id, teljesites_datuma, felrako, lerako, tavolsag_km, megbizo_id, aru_megnevezese, megjegyzes, fuvardij, egyeb_koltseg, fuvarlevel_szam, beerkezett_dokumentum_id, allapot)
          VALUES (:admin, :sofor_id, :kamion_id, :furgon_id, :potkocsi_id, :teljesites_datuma, :felrako, :lerako, :tavolsag_km, :megbizo_id, :aru_megnevezese, :megjegyzes, :fuvardij, :egyeb_koltseg, :fuvarlevel_szam, :beerkezett_dokumentum_id, :allapot)";
```

In `updateFuvar()`, add `beerkezett_dokumentum_id = :beerkezett_dokumentum_id,` right after
`fuvarlevel_szam = :fuvarlevel_szam,` in the `SET` clause.

In `bindFuvarMezok()`, add right after the `:fuvarlevel_szam` bind:
```php
$stmt->bindValue(':beerkezett_dokumentum_id', empty($data['beerkezett_dokumentum_id']) ? null : (int) $data['beerkezett_dokumentum_id'], empty($data['beerkezett_dokumentum_id']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
```

- [ ] **Step 2: Force the link in `letrehozDokumentumbol()`**

Right after the existing `$adatok = array_merge([...], $felulirasok);` line, add:
```php
        // A forrás-dokumentum id-je SOSEM felülírható a $felulirasok által —
        // ez szerver-oldali tény (melyik dokumentumból hívtuk ezt a
        // metódust), nem admin-szerkeszthető mező.
        $adatok['beerkezett_dokumentum_id'] = $dokumentumId;
```

- [ ] **Step 3: Also return it from `getFuvar()`/`getFuvarok()`**

No change needed — both already do `SELECT *`, so `beerkezett_dokumentum_id` is automatically
included once Task 1's column exists.

- [ ] **Step 4: Lint-check**

Run: `php8.2 -l backend/interface/fuvarInterface.php`
Expected: `No syntax errors detected`.

- [ ] **Step 5: Live-verify via curl**

Ensure the local PHP server is running (`cd backend && php8.2 -S localhost:8001 &`) and you have
a valid admin session token (`SELECT token FROM sessions WHERE felhasznalo_tipus='admin' AND
lejarat > NOW() LIMIT 1;`, insert one if none exists — see the original OCR plan's Task 3 for the
exact insert pattern).

You need an existing `beerkezett_dokumentumok` row with `fuvar_id IS NULL` for this test. Check:
```bash
mysql -uroot kamion -e "SELECT id FROM beerkezett_dokumentumok WHERE fuvar_id IS NULL AND torolt <> 'I' LIMIT 1;"
```
If none exists, upload a test document first via `elemezBeerkezettDokumentum` (any small JPEG,
OCR failure is fine — `ocr_allapot='hiba'` rows still get a `beerkezett_dokumentumok` row).

Then:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "letrehozFuvarDokumentumbol",
  "ceg_id": 1,
  "kerelmezo_id": 1,
  "dokumentumId": <ID_FROM_ABOVE>
}' | python3 -m json.tool
```
Expected: `{"success": true, "fuvar": {..., "beerkezett_dokumentum_id": <ID_FROM_ABOVE>, ...}}`.

Then confirm the DB:
```bash
mysql -uroot kamion -e "SELECT id, beerkezett_dokumentum_id FROM fuvarok ORDER BY id DESC LIMIT 1;"
```
Expected: `beerkezett_dokumentum_id` matches the source document's id. Delete the test fuvar/document
row afterward if they were created purely for this test (`deleteFuvar` action, or direct
`UPDATE ... SET torolt='I'`).

- [ ] **Step 6: Commit**

```bash
git add backend/interface/fuvarInterface.php
git commit -m "$(cat <<'EOF'
feat(fuvar): persist beerkezett_dokumentum_id when a fuvar is created from a document

letrehozDokumentumbol() now always sets it (never overridable via the
review-form's felulirasok), so the Fuvar record can later show "created
from this document" — Task 13 consumes this.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `updateFuvarAllapot` — dedicated single-column state change

**Files:**
- Modify: `backend/interface/fuvarInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Produces: `FuvarInterface::updateAllapot($id, $ceg_id, $allapot)` → `{success, message, fuvar}`;
  action `updateFuvarAllapot`.

**Why this can't just reuse `updateFuvar`:** `updateFuvar`'s `bindFuvarMezok()` reads every field
via `$data['x'] ?? null` and does a full `UPDATE ... SET` — it has no concept of "leave the other
columns alone". If the Kanban drag&drop or a quick status-change control (Tasks 15-16) sent only
`{id, allapot}` through `updateFuvar`, every other column (sofőr/jármű/megbízó/díjak) would be
silently wiped to `NULL`. A dedicated, single-column action avoids this failure mode entirely.

- [ ] **Step 1: Add the method to `FuvarInterface`**

Add after `updateFuvar()`:
```php
    const ALLAPOT_ERTEKEK = ['rogzitett', 'szamlazasra_var', 'szamlazva', 'fizetesre_var', 'teljesitve'];

    // Dedikált, EGY oszlopot módosító UPDATE — szándékosan nem a teljes
    // updateFuvar()-t hívja, ld. a Task 3 fejlécének indoklását: a Kanban
    // drag&drop és a gyors állapotváltó popover csak {id, allapot}-ot küld,
    // egy teljes-payload update ezt NULL-ra írná a többi mezőn.
    public function updateAllapot($id, $ceg_id, $allapot) {
        if (!in_array($allapot, self::ALLAPOT_ERTEKEK, true)) {
            return ['success' => false, 'message' => 'Érvénytelen állapot.'];
        }
        $stmt = $this->db->prepare("UPDATE fuvarok SET allapot = :allapot WHERE id = :id AND admin = :admin AND torolt <> 'I'");
        $stmt->bindValue(':allapot', $allapot);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        if ($stmt->rowCount() === 0) {
            return ['success' => false, 'message' => 'A fuvar nem található.'];
        }
        return ['success' => true, 'message' => 'Állapot frissítve.', 'fuvar' => $this->getFuvar($id, $ceg_id)['fuvar']];
    }
```

- [ ] **Step 2: Wire into `ApiHandler.php`**

Add to `getActions()`, right after the `'letrehozFuvarDokumentumbol'` entry (~line 362):
```php
            'updateFuvarAllapot' => ['id', 'ceg_id', 'kerelmezo_id', 'allapot'],
```

Add to `MODULE_PERMISSION_MAP`, right after `'letrehozFuvarDokumentumbol'` (~line 145):
```php
        'updateFuvarAllapot' => ['fuvarok', 'szerkesztes'],
```

Add a `case` right after the existing `case 'letrehozFuvarDokumentumbol':` block (~line 1710,
before `case 'getUgyfelFuvarElozmeny':`):
```php
                case 'updateFuvarAllapot':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->updateAllapot($request['id'], $kerelmezo['ceg_id'], $request['allapot']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'allapotvaltas', $request['allapot']);
                    }
                    echo json_encode($result);
                    return;
```

- [ ] **Step 3: Lint-check**

Run: `php8.2 -l backend/interface/fuvarInterface.php && php8.2 -l backend/ApiHandler.php`
Expected: no syntax errors on either file.

- [ ] **Step 4: Live-verify via curl**

```bash
mysql -uroot kamion -e "SELECT id, allapot FROM fuvarok WHERE torolt <> 'I' LIMIT 1;"
```
Note the `id` and current `allapot`, then:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "updateFuvarAllapot",
  "ceg_id": 1,
  "kerelmezo_id": 1,
  "id": <ID>,
  "allapot": "szamlazasra_var"
}' | python3 -m json.tool
```
Expected: `{"success": true, ..., "fuvar": {"id": <ID>, "allapot": "szamlazasra_var", ...}}`, **and
every other field on that fuvar row (sofor_id, kamion_id, felrako, fuvardij, ...) unchanged** —
confirm with `mysql -uroot kamion -e "SELECT * FROM fuvarok WHERE id = <ID>;"` compared against a
`SELECT *` taken before this test. Restore the original `allapot` afterward if this was a real row.

Also verify the rejection path: repeat the curl call with `"allapot": "nemletezo"` — expected
`{"success": false, "message": "Érvénytelen állapot."}`.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add updateFuvarAllapot — single-column state change

Dedicated action for the Kanban drag&drop and quick status-change
popover (Tasks 15-16), deliberately NOT reusing updateFuvar()'s
full-payload UPDATE, which would null out every other field on a
partial {id, allapot} payload.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `getFuvarAllapotOsszesito` — status-count aggregate

**Files:**
- Modify: `backend/interface/fuvarInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Produces: `FuvarInterface::getAllapotOsszesito($ceg_id)` → `{success, osszesito: {rogzitett: N,
  szamlazasra_var: N, szamlazva: N, fizetesre_var: N, teljesitve: N}}`. Always the full,
  unfiltered per-`allapot` count (independent of whatever search/filter the list currently has) —
  consumed by Task 14's `AllapotOsszesitoChips`.

- [ ] **Step 1: Add the method**

```php
    // Mindig a TELJES állomány állapotonkénti száma, függetlenül a lista
    // aktuális keresésétől/szűrőjétől — az összesítő-chipek "hol tartunk
    // összesen" áttekintést adnak, nem a szűrt eredményhalmaz számát.
    public function getAllapotOsszesito($ceg_id) {
        $stmt = $this->db->prepare("SELECT allapot, COUNT(*) AS db FROM fuvarok WHERE admin = :admin AND torolt <> 'I' GROUP BY allapot");
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();

        $osszesito = array_fill_keys(self::ALLAPOT_ERTEKEK, 0);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (isset($osszesito[$row['allapot']])) {
                $osszesito[$row['allapot']] = (int) $row['db'];
            }
        }
        return ['success' => true, 'osszesito' => $osszesito];
    }
```

(Uses the `ALLAPOT_ERTEKEK` const added in Task 3 — this task must run after Task 3, or add the
const here too if run standalone.)

- [ ] **Step 2: Wire into `ApiHandler.php`**

`getActions()`, after `updateFuvarAllapot`:
```php
            'getFuvarAllapotOsszesito' => ['ceg_id'],
```

`MODULE_PERMISSION_MAP`, after `updateFuvarAllapot`:
```php
        'getFuvarAllapotOsszesito' => ['fuvarok', 'hozzaferes'],
```

`case`, after `updateFuvarAllapot`'s case:
```php
                case 'getFuvarAllapotOsszesito':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($fuvarInterface->getAllapotOsszesito($kerelmezo['ceg_id']));
                    return;
```

- [ ] **Step 3: Lint-check**

Run: `php8.2 -l backend/interface/fuvarInterface.php && php8.2 -l backend/ApiHandler.php`

- [ ] **Step 4: Live-verify via curl**

```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getFuvarAllapotOsszesito",
  "ceg_id": 1
}' | python3 -m json.tool
```
Expected: `{"success": true, "osszesito": {"rogzitett": N, "szamlazasra_var": N, "szamlazva": N,
"fizetesre_var": N, "teljesitve": N}}` with all 5 keys present (even at 0), and the sum of all
5 values equal to `SELECT COUNT(*) FROM fuvarok WHERE admin=1 AND torolt <> 'I';`.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add getFuvarAllapotOsszesito status-count aggregate

Backs the Fuvarok list's status-overview chips (Task 14) — always
full-inventory counts, independent of the list's current filter/search.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `getBeerkezettDokumentumokSzama` — lightweight badge count

**Files:**
- Modify: `backend/interface/beerkezettDokumentumInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Produces: `BeerkezettDokumentumInterface::getSzama($ceg_id)` → `{success, szam}` — a plain
  `COUNT(*)`, no OCR JSON transferred. Consumed by both Task 9 (sidebar badge) and Task 13
  (Fuvarok header reminder pill) via the exact same call.

- [ ] **Step 1: Add the method**

Add to `BeerkezettDokumentumInterface`, after `getDokumentumok()`:
```php
    // Könnyűsúlyú darabszám a sidebar-jelvényhez/Fuvarok fejléc-pillhez —
    // szándékosan NEM getDokumentumok()-ot hívja (ami minden ocr_adatok
    // JSON-t áthúzna a hálózaton egy puszta számért).
    public function getSzama($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) AS db FROM beerkezett_dokumentumok WHERE admin = :admin AND torolt <> 'I' AND fuvar_id IS NULL"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'szam' => (int) $stmt->fetch(PDO::FETCH_ASSOC)['db']];
    }
```

- [ ] **Step 2: Wire into `ApiHandler.php`**

`getActions()`, after `'getBeerkezettDokumentumok'`:
```php
            'getBeerkezettDokumentumokSzama' => ['ceg_id'],
```

`MODULE_PERMISSION_MAP`, after `'getBeerkezettDokumentumok'`:
```php
        'getBeerkezettDokumentumokSzama' => ['fuvarok', 'hozzaferes'],
```

`case`, after the existing `case 'getBeerkezettDokumentumok':` block:
```php
                case 'getBeerkezettDokumentumokSzama':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($beerkezettDokumentumInterface->getSzama($kerelmezo['ceg_id']));
                    return;
```

- [ ] **Step 3: Lint-check**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php && php8.2 -l backend/ApiHandler.php`

- [ ] **Step 4: Live-verify via curl**

```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getBeerkezettDokumentumokSzama",
  "ceg_id": 1
}' | python3 -m json.tool
```
Expected: `{"success": true, "szam": N}`, matching `SELECT COUNT(*) FROM beerkezett_dokumentumok
WHERE admin=1 AND torolt <> 'I' AND fuvar_id IS NULL;`.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add getBeerkezettDokumentumokSzama lightweight count action

Backs the sidebar badge (Task 9) and the Fuvarok header reminder pill
(Task 13) — a bare COUNT(*), not the full OCR-payload listing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `torolBeerkezettDokumentum` — discard an unconverted document

**Files:**
- Modify: `backend/interface/beerkezettDokumentumInterface.php`
- Modify: `backend/ApiHandler.php`
- Modify: `src/views/admin/Naplo.js`

**Interfaces:**
- Produces: `BeerkezettDokumentumInterface::torol($id, $ceg_id)` → `{success, message}` — soft
  deletes, but **only if `fuvar_id IS NULL`** (a document already converted to a fuvar can't be
  discarded through this path — `deleteFuvar`'s existing `visszaallitForrasDokumentumot()` is the
  only way a converted document becomes eligible for discard again).

- [ ] **Step 1: Add the method**

```php
    // Csak "fuvar_id IS NULL" dokumentum vethető el — egy már fuvarrá
    // alakított dokumentumot deleteFuvar() (ami visszaallitForrasDokumentumot()-
    // tal reparentálja) tesz újra elérhetővé, ez a metódus szándékosan nem
    // nyúl egy már összekapcsolt sorhoz.
    public function torol($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT fuvar_id FROM beerkezett_dokumentumok WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($sor === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }
        if (!empty($sor['fuvar_id'])) {
            return ['success' => false, 'message' => 'Ehhez a dokumentumhoz már tartozik fuvar, nem vethető el.'];
        }

        $update = $this->db->prepare("UPDATE beerkezett_dokumentumok SET torolt = 'I' WHERE id = :id AND admin = :admin");
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $update->execute();
        return ['success' => true, 'message' => 'Dokumentum elvetve.'];
    }
```

- [ ] **Step 2: Wire into `ApiHandler.php`**

`getActions()`, after `'updateBeerkezettDokumentumTipus'`:
```php
            'torolBeerkezettDokumentum' => ['id', 'ceg_id'],
```

`MODULE_PERMISSION_MAP`, after `'updateBeerkezettDokumentumTipus'`:
```php
        'torolBeerkezettDokumentum' => ['fuvarok', 'torles'],
```

`case`, after `case 'updateBeerkezettDokumentumTipus':`:
```php
                case 'torolBeerkezettDokumentum':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $beerkezettDokumentumInterface->torol($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'beerkezett_dokumentumok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
```

- [ ] **Step 3: Add a Napló label for the new `tabla` value**

In `src/views/admin/Naplo.js`, find the `TABLA_LABEL` object and add:
```js
  beerkezett_dokumentumok: "Beérkezett dokumentum",
```

- [ ] **Step 4: Lint-check**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php && php8.2 -l backend/ApiHandler.php`

- [ ] **Step 5: Live-verify via curl**

Using a document id with `fuvar_id IS NULL` (from Task 2's check query):
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "torolBeerkezettDokumentum",
  "ceg_id": 1,
  "id": <ID>
}' | python3 -m json.tool
```
Expected: `{"success": true, "message": "Dokumentum elvetve."}`, and
`mysql -uroot kamion -e "SELECT torolt FROM beerkezett_dokumentumok WHERE id=<ID>;"` shows `I`.

Then verify the rejection path against a document that already has `fuvar_id` set (reuse the one
from Task 2's test, or create one): expected `{"success": false, "message": "Ehhez a
dokumentumhoz már tartozik fuvar, nem vethető el."}`.

- [ ] **Step 6: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php backend/ApiHandler.php src/views/admin/Naplo.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add torolBeerkezettDokumentum — discard an unconverted document

Soft-delete, blocked once the document already has a fuvar attached.
Gives the inbox review flow (Task 12) a real "this isn't relevant" exit
path, which didn't exist before.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `getBeerkezettDokumentumok` — search/filter/sort/paginate

**Files:**
- Modify: `backend/interface/beerkezettDokumentumInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: existing `getDokumentumok()` shape.
- Produces: `getDokumentumok($ceg_id, $ocrAllapot, $csakFeldolgozatlan, $tipus, $search, $datumTol,
  $datumIg, $sortKey, $sortDir, $page, $pageSize)` — when `$page !== null`, response also carries
  `total`/`page`/`pageSize` (mirrors `FuvarInterface::getFuvarok()`'s exact shape). Task 10 uses
  this: the "Feldolgozásra vár" tab calls it with `$page = null` (single, unpaged fetch — the
  queue is self-draining), the "Archívum" tab calls it with real paging.

- [ ] **Step 1: Add a sortable-columns const**

Add inside `BeerkezettDokumentumInterface`, right after the `class` line:
```php
    const RENDEZHETO_OSZLOPOK = [
        'letrehozva' => 'bd.letrehozva',
        'tipus' => 'bd.tipus',
    ];
```

- [ ] **Step 2: Add a filename-search helper**

Add after `fajlnevekFeloldasa()`:
```php
    // Fájlnév alapján keres id-ket a `fajlok` táblában (ugyanaz a JOIN-
    // mentes, PHP-oldali összefésülő minta, mint `FuvarInterface::
    // keresIdkNevAlapjan()`), hogy a getDokumentumok() keresése a fájlnévre
    // is kiterjedjen, ne csak az ocr_adatok nyers JSON-szövegére.
    private function keresFajlIdkNevAlapjan($ceg_id, $search) {
        $stmt = $this->db->prepare(
            "SELECT sorszam FROM fajlok WHERE admin = :ceg_id AND tabla = 'beerkezett_dokumentum' AND filename LIKE :search"
        );
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':search', '%' . $search . '%');
        $stmt->execute();
        return array_map('intval', array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'sorszam'));
    }
```

- [ ] **Step 3: Replace `getDokumentumok()`'s signature and body**

```php
    public function getDokumentumok(
        $ceg_id,
        $ocrAllapot = null,
        $csakFeldolgozatlan = true,
        $tipus = null,
        $search = null,
        $datumTol = null,
        $datumIg = null,
        $sortKey = null,
        $sortDir = 'asc',
        $page = null,
        $pageSize = null
    ) {
        $query = "SELECT bd.id, bd.fajl_id, bd.tipus, bd.ocr_allapot, bd.ocr_adatok,
                         bd.feltolto_tipus, bd.feltolto_id, bd.feltolto_nev, bd.fuvar_id, bd.letrehozva
                  FROM beerkezett_dokumentumok bd
                  WHERE bd.admin = :admin AND bd.torolt <> 'I'";
        $params = [':admin' => $ceg_id];

        if ($csakFeldolgozatlan) {
            $query .= " AND bd.fuvar_id IS NULL";
        }
        if (!empty($ocrAllapot)) {
            $query .= " AND bd.ocr_allapot = :ocr_allapot";
            $params[':ocr_allapot'] = $ocrAllapot;
        }
        if (!empty($tipus)) {
            $query .= " AND bd.tipus = :tipus";
            $params[':tipus'] = $tipus;
        }
        if (!empty($datumTol)) {
            $query .= " AND bd.letrehozva >= :datum_tol";
            $params[':datum_tol'] = $datumTol . ' 00:00:00';
        }
        if (!empty($datumIg)) {
            $query .= " AND bd.letrehozva <= :datum_ig";
            $params[':datum_ig'] = $datumIg . ' 23:59:59';
        }
        if (!empty($search)) {
            $fajlIdk = $this->keresFajlIdkNevAlapjan($ceg_id, $search);
            $feltetel = "bd.ocr_adatok LIKE :search";
            if (!empty($fajlIdk)) {
                $feltetel .= " OR bd.fajl_id IN (" . implode(',', $fajlIdk) . ")";
            }
            $query .= " AND ($feltetel)";
            $params[':search'] = '%' . $search . '%';
        }

        $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'bd.letrehozva';
        $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
        $query .= " ORDER BY $rendezoOszlop $irany";

        $total = null;
        if ($page !== null) {
            [$sorok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
        } else {
            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $fajlnevek = $this->fajlnevekFeloldasa(array_column($sorok, 'fajl_id'));
        foreach ($sorok as &$sor) {
            $sor['filename'] = $fajlnevek[$sor['fajl_id']] ?? null;
            $sor['ocr_adatok'] = $sor['ocr_adatok'] !== null ? json_decode($sor['ocr_adatok'], true) : null;
        }
        unset($sor);

        $valasz = ['success' => true, 'dokumentumok' => $sorok];
        if ($page !== null) {
            $valasz['total'] = $total;
            $valasz['page'] = $page;
            $valasz['pageSize'] = $pageSize;
        }
        return $valasz;
    }
```

- [ ] **Step 4: Pass the new params through in `ApiHandler.php`**

Replace the existing `case 'getBeerkezettDokumentumok':` body with:
```php
                case 'getBeerkezettDokumentumok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($beerkezettDokumentumInterface->getDokumentumok(
                        $kerelmezo['ceg_id'],
                        $request['ocrAllapot'] ?? null,
                        $request['csakFeldolgozatlan'] ?? true,
                        $request['tipus'] ?? null,
                        $request['search'] ?? null,
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $request['sortKey'] ?? null,
                        $request['sortDir'] ?? 'asc',
                        $request['page'] ?? null,
                        $request['pageSize'] ?? null
                    ));
                    return;
```

- [ ] **Step 5: Lint-check**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php && php8.2 -l backend/ApiHandler.php`

- [ ] **Step 6: Live-verify via curl**

Unpaged (existing behavior must still work):
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getBeerkezettDokumentumok",
  "ceg_id": 1
}' | python3 -m json.tool
```
Expected: `{"success": true, "dokumentumok": [...]}`, **no** `total`/`page`/`pageSize` keys (unpaged
mode unchanged).

Paged archívum mode:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getBeerkezettDokumentumok",
  "ceg_id": 1,
  "csakFeldolgozatlan": false,
  "page": 1,
  "pageSize": 5
}' | python3 -m json.tool
```
Expected: `{"success": true, "dokumentumok": [...max 5...], "total": N, "page": 1, "pageSize": 5}`,
including both `fuvar_id IS NULL` and already-converted rows.

- [ ] **Step 7: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add search/filter/sort/paginate to getBeerkezettDokumentumok

Backs the inbox's search bar and the Archívum tab's server-side paging
(Task 10) — unpaged mode (page=null, the "Feldolgozásra vár" queue)
keeps its exact prior response shape.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Generalize `uploadFajlXhr` to accept an action name

**Files:**
- Modify: `src/components/Fajlok/fajlUploadXhr.js`

**Interfaces:**
- Produces: `uploadFajlXhr(payload, onProgress, action = "fileUpload")` — backward compatible
  (every existing call site omits the 3rd argument and keeps calling `fileUpload`). Task 10's
  upload zone is the only new caller, passing `"elemezBeerkezettDokumentum"`.

- [ ] **Step 1: Check the existing call site still works unmodified**

Run: `grep -rn "uploadFajlXhr(" src/` — confirm every current call passes exactly 2 arguments
(payload, onProgress). This confirms the 3rd-parameter default won't change existing behavior.

- [ ] **Step 2: Add the parameter**

Change the function signature and the `action` field in the sent body:
```js
export const uploadFajlXhr = (payload, onProgress, action = "fileUpload") => {
```
```js
    xhr.send(
      JSON.stringify({
        authHash,
        sessionToken: localStorage.getItem("sessionToken") || "",
        action,
        ...payload,
      }),
    );
```
(Only the `action: "fileUpload"` literal becomes `action` — everything else in the file is
unchanged.)

- [ ] **Step 3: Verify in the browser (regression check on the existing Fájlok upload)**

Start `npm start` (reuse existing dev server if already running) and `cd backend && php8.2 -S
localhost:8001` if not already running. Log in as admin, go to `/admin/fajlok`, upload a small
test file via drag&drop, confirm the progress bar still animates and the file appears in the list
afterward exactly as before. Delete the test file row afterward.

- [ ] **Step 4: Commit**

```bash
git add src/components/Fajlok/fajlUploadXhr.js
git commit -m "$(cat <<'EOF'
refactor(fajlok): let uploadFajlXhr target a non-default action

Adds an optional 3rd `action` param (defaults to "fileUpload", so every
existing call site is unaffected) — Task 10's document-inbox upload zone
reuses this instead of duplicating the XHR-progress plumbing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Sidebar badge for "Beérkezett dokumentumok"

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js`

**Interfaces:**
- Consumes: `getBeerkezettDokumentumokSzama` (Task 5).
- Produces: a live `badge` count on the "Beérkezett dokumentumok" `NavItem` — `NavItem` already
  supports a `badge` prop (used by Bejelentések), no change needed there.

- [ ] **Step 1: Add state + loader, mirroring the exact `nyitottBejelentesek` pattern**

Right after the existing `nyitottBejelentesek` state/effects block (~line 366-384), add:
```js
  const [beerkezettDokSzam, setBeerkezettDokSzam] = React.useState(0);
  const loadBeerkezettDokSzam = React.useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getBeerkezettDokumentumokSzama", { ceg_id: user.ceg_id }).then(
      (result) => {
        if (result?.success) setBeerkezettDokSzam(result.szam);
      },
    );
  }, []);

  React.useEffect(() => {
    loadBeerkezettDokSzam();
  }, [loadBeerkezettDokSzam, location.pathname]);

  React.useEffect(() => {
    const intervalId = setInterval(loadBeerkezettDokSzam, 60000);
    return () => clearInterval(intervalId);
  }, [loadBeerkezettDokSzam]);
```

- [ ] **Step 2: Pass the badge to the nav item**

In the "Fuvarok" `GroupHeader` block (~line 700-704), change:
```jsx
                <NavItem
                  to="/admin/beerkezettDokumentumok"
                  icon={PiFileTextLight}
                  text="Beérkezett dokumentumok"
                />
```
to:
```jsx
                <NavItem
                  to="/admin/beerkezettDokumentumok"
                  icon={PiFileTextLight}
                  text="Beérkezett dokumentumok"
                  badge={beerkezettDokSzam}
                />
```

- [ ] **Step 3: Verify in the browser**

With at least one `beerkezett_dokumentumok` row having `fuvar_id IS NULL` (upload one if needed),
log in as admin, confirm the "Beérkezett dokumentumok" sidebar item shows a red badge with the
correct count. Convert that document to a fuvar (or discard it via Task 6's action once Task 12
ships the UI — for now, a direct `curl` call to `letrehozFuvarDokumentumbol`/
`torolBeerkezettDokumentum` is enough), navigate to a different page, and confirm the badge drops
after the next route-change fetch.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar/Sidebar.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add sidebar badge for pending inbox documents

Route-change + 60s poll, the exact same pattern already used for the
Bejelentések unread-badge — makes the inbox visible without requiring
the admin to remember to check it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `DokumentumKartya` — thumbnail card component

**Files:**
- Create: `src/components/Fuvarok/DokumentumKartya.js`

**Interfaces:**
- Consumes: a `dokumentum` object shaped like `getBeerkezettDokumentumok()`'s rows (`id`, `fajl_id`,
  `filename`, `tipus`, `ocr_allapot`, `ocr_adatok`, `letrehozva`).
- Produces: `<DokumentumKartya dokumentum={...} onOpen={(dok) => void} />` — a card with a lazy
  image thumbnail (image files only) or a generic document icon (PDF/other), OCR-status accent,
  and a one-line preview of key extracted fields.

- [ ] **Step 1: Write the component**

```jsx
import React, { useEffect, useRef, useState } from "react";
import { PiFileTextLight, PiFilePdfLight, PiWarningCircleLight, PiCheckCircleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const OCR_ALLAPOT_LABEL = {
  kesz: "Ellenőrzésre vár",
  hiba: "Kézi kitöltés szükséges",
  feldolgozatlan: "Feldolgozás alatt",
};

// Csak kép-kiterjesztésű fájloknál töltünk le valódi bélyegképet (a Fájlok
// modul FajlGrid.js-ének IntersectionObserver-mintáját követve) — PDF-nél
// egyszerű ikon, nem a teljes FileTypeIcon kategória-rendszer (a
// beerkezett_dokumentumok sor nem hordoz fajl_kategoria mezőt).
function isKepFajlnev(filename) {
  return /\.(jpe?g|png|gif|webp)$/i.test(filename || "");
}

export default function DokumentumKartya({ dokumentum, onOpen }) {
  const isKep = isKepFajlnev(dokumentum.filename);
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const thumbRef = useRef(null);
  const hibas = dokumentum.ocr_allapot === "hiba";

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
        hibas ? "border-amber-300 dark:border-amber-700" : "border-ink-100 dark:border-ink-800"
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
            hibas ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hibas ? <PiWarningCircleLight className="h-3.5 w-3.5" /> : <PiCheckCircleLight className="h-3.5 w-3.5" />}
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

- [ ] **Step 2: No standalone verification** — this component has no page mounting it yet; it is
  exercised end-to-end by Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/components/Fuvarok/DokumentumKartya.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add DokumentumKartya thumbnail card component

Lazy image thumbnail (IntersectionObserver, mirroring the Fájlok
module's FajlGrid.js pattern) for image documents, plain icon for
PDF/other — used by the inbox rewrite (Task 11).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `DokumentumReviewPanel` — preview + editable fields + Elvetés/Fuvar-létrehozás

**Files:**
- Create: `src/components/Fuvarok/DokumentumReviewPanel.js`

**Interfaces:**
- Consumes: `downloadFile` (existing action, `{id: fajl_id}` → `{success, mime, file(base64)}`),
  `updateBeerkezettDokumentumTipus`, `torolBeerkezettDokumentum` (Task 6), `confirmDialog` (
  `utils/confirm.js`), `toast` (`utils/toast.js`).
- Produces: `<DokumentumReviewPanel dokumentum={...} onClose={fn} onDiscarded={fn}
  onCreateFuvar={(dokumentum) => void} />` — desktop: right-side slide-over panel (same
  `fixed inset-y-0 right-0` shell as `FajlPreviewPanel.js`, not literally imported since the field
  shapes differ, but same visual language); mobile: full-screen overlay. Left/top: original
  document preview (image/PDF via `downloadFile` → data URI, same technique as
  `FajlPreviewPanel.js`). Right/bottom: type selector + read-only OCR field summary + Elvetés/
  Fuvar-létrehozás buttons.

- [ ] **Step 1: Write the component**

```jsx
import React, { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { PiXLight, PiWarningCircleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import Spinner from "components/UI/Spinner.js";

const TIPUS_OPTIONS = [
  { value: "fuvarlevel", label: "Fuvarlevél" },
  { value: "szallitolevel", label: "Szállítólevél" },
  { value: "ismeretlen", label: "Ismeretlen típus" },
];

function ElonezetKep({ dataUrl, mime, loading, filename }) {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 dark:bg-ink-800">
        <Spinner />
      </div>
    );
  }
  if (dataUrl && mime?.startsWith("image/")) {
    return <img src={dataUrl} alt={filename} className="mx-auto max-h-96 max-w-full rounded-xl" />;
  }
  if (dataUrl && mime === "application/pdf") {
    return (
      <iframe
        title={filename}
        src={dataUrl}
        className="h-96 w-full rounded-xl border border-ink-100 dark:border-ink-700"
      />
    );
  }
  return (
    <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-xs text-ink-400 dark:bg-ink-800 dark:text-ink-500">
      Nincs előnézet ehhez a fájltípushoz.
    </div>
  );
}

export default function DokumentumReviewPanel({ dokumentum, onClose, onDiscarded, onCreateFuvar }) {
  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState(null);
  const [mime, setMime] = useState(null);
  const [tipus, setTipus] = useState(dokumentum?.tipus || "ismeretlen");
  const [discarding, setDiscarding] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 1023 });
  const ocr = dokumentum?.ocr_adatok || {};

  useEffect(() => {
    if (!dokumentum) return;
    setTipus(dokumentum.tipus);
    setLoading(true);
    setDataUrl(null);
    fetchAction("downloadFile", { id: dokumentum.fajl_id }).then((result) => {
      if (result?.success) {
        setMime(result.mime);
        setDataUrl(`data:${result.mime};base64,${result.file}`);
      }
      setLoading(false);
    });
  }, [dokumentum]);

  useEffect(() => {
    if (!dokumentum) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dokumentum, onClose]);

  if (!dokumentum) return null;

  const handleTipusChange = async (ujTipus) => {
    setTipus(ujTipus);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("updateBeerkezettDokumentumTipus", {
      ceg_id: user.ceg_id,
      id: dokumentum.id,
      tipus: ujTipus,
    });
    if (!result?.success) {
      toast.error(result?.message || "A típus módosítása sikertelen.");
      setTipus(dokumentum.tipus);
    }
  };

  const handleElvetes = async () => {
    if (!(await confirmDialog("Biztosan elveted ezt a dokumentumot? Ez nem hozható létre belőle fuvar a jövőben."))) {
      return;
    }
    setDiscarding(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("torolBeerkezettDokumentum", { ceg_id: user.ceg_id, id: dokumentum.id });
    setDiscarding(false);
    if (result?.success) {
      toast.success("Dokumentum elvetve.");
      onDiscarded(dokumentum.id);
    } else {
      toast.error(result?.message || "A dokumentum elvetése sikertelen.");
    }
  };

  const bizonytalan = ocr.egyeb_megjegyzes && /bizonytalan/i.test(ocr.egyeb_megjegyzes);

  const tartalom = (
    <>
      <ElonezetKep dataUrl={dataUrl} mime={mime} loading={loading} filename={dokumentum.filename} />

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400">
          Típus
          <select
            value={tipus}
            onChange={(e) => handleTipusChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm normal-case tracking-normal text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            {TIPUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <dl className="space-y-1 text-sm text-ink-700 dark:text-ink-200">
          {ocr.felrako && <div><dt className="inline font-semibold text-ink-400">Felrakó: </dt><dd className="inline">{ocr.felrako}</dd></div>}
          {ocr.lerako && <div><dt className="inline font-semibold text-ink-400">Lerakó: </dt><dd className="inline">{ocr.lerako}</dd></div>}
          {ocr.megbizo && <div><dt className="inline font-semibold text-ink-400">Megbízó: </dt><dd className="inline">{ocr.megbizo}</dd></div>}
          {ocr.datum && <div><dt className="inline font-semibold text-ink-400">Dátum: </dt><dd className="inline">{ocr.datum}</dd></div>}
          {ocr.rendszam && <div><dt className="inline font-semibold text-ink-400">Rendszám: </dt><dd className="inline">{ocr.rendszam}</dd></div>}
        </dl>

        {bizonytalan && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <PiWarningCircleLight className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {ocr.egyeb_megjegyzes}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
        <button
          type="button"
          onClick={handleElvetes}
          disabled={discarding}
          className="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Elvetés
        </button>
        <button
          type="button"
          onClick={() => onCreateFuvar(dokumentum)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700"
        >
          Fuvar létrehozása →
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-ink-950" role="dialog" aria-modal="true" aria-label="Dokumentum ellenőrzése">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <p className="truncate text-sm font-semibold text-brand-900 dark:text-ink-50">Dokumentum ellenőrzése</p>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
            <PiXLight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{tartalom}</div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-950/20" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Dokumentum ellenőrzése"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-ink-100 bg-white p-5 shadow-soft-lg dark:border-ink-800 dark:bg-ink-950"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="truncate pr-2 text-sm font-semibold text-brand-900 dark:text-ink-50">Dokumentum ellenőrzése</p>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800">
            <PiXLight className="h-5 w-5" />
          </button>
        </div>
        {tartalom}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: No standalone verification** — exercised end-to-end by Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/components/Fuvarok/DokumentumReviewPanel.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add DokumentumReviewPanel — image/PDF preview + Elvetés

Shows the original scanned document next to the OCR-extracted fields
before the admin commits to creating a fuvar from it — the previous
inbox only showed the raw OCR text, no source-document preview.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Rewrite `BeerkezettDokumentumok.js` — multi-upload, groups, tabs, search

**Files:**
- Modify: `src/views/admin/BeerkezettDokumentumok.js`

**Interfaces:**
- Consumes: `uploadFajlXhr` (Task 8), `DokumentumKartya` (Task 10), `DokumentumReviewPanel`
  (Task 11), `getBeerkezettDokumentumok` (Task 7), `fileToBase64` (existing util).
- Produces: the full rewritten inbox page — multi-file drag&drop with per-file progress, grouped
  cards ("Kézi kitöltés szükséges" first, then "Ellenőrzésre vár") in the "Feldolgozásra vár" tab,
  a paginated/searchable/filterable "Archívum" tab, and the review panel wired to
  create-fuvar/discard.

- [ ] **Step 1: Replace the file**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { PiUploadLight, PiMagnifyingGlassLight } from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import DokumentumKartya from "components/Fuvarok/DokumentumKartya.js";
import DokumentumReviewPanel from "components/Fuvarok/DokumentumReviewPanel.js";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { uploadFajlXhr } from "components/Fajlok/fajlUploadXhr.js";
import { toast } from "utils/toast";

const ARCHIVUM_OLDALMERET = 12;

export default function BeerkezettDokumentumok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

  const [nezet, setNezet] = useState("varakozik"); // "varakozik" | "archivum"
  const [dokumentumok, setDokumentumok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feltoltesSor, setFeltoltesSor] = useState([]); // [{key, nev, progress, hiba}]
  const [reviewDokumentum, setReviewDokumentum] = useState(null);

  const [kereses, setKereses] = useState("");
  const [tipusSzuro, setTipusSzuro] = useState("");
  const [archivumOldal, setArchivumOldal] = useState(1);
  const [archivumTotal, setArchivumTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    if (nezet === "varakozik") {
      const result = await fetchAction("getBeerkezettDokumentumok", {
        ceg_id: user.ceg_id,
        csakFeldolgozatlan: true,
        tipus: tipusSzuro || undefined,
        search: kereses || undefined,
      });
      setDokumentumok(result?.success ? result.dokumentumok || [] : []);
    } else {
      const result = await fetchAction("getBeerkezettDokumentumok", {
        ceg_id: user.ceg_id,
        csakFeldolgozatlan: false,
        tipus: tipusSzuro || undefined,
        search: kereses || undefined,
        page: archivumOldal,
        pageSize: ARCHIVUM_OLDALMERET,
      });
      setDokumentumok(result?.success ? result.dokumentumok || [] : []);
      setArchivumTotal(result?.success ? result.total || 0 : 0);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nezet, tipusSzuro, kereses, archivumOldal, user.ceg_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    const sorTetelek = files.map((file, i) => ({ key: `${Date.now()}-${i}`, nev: file.name, progress: 0 }));
    setFeltoltesSor((prev) => [...prev, ...sorTetelek]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const kulcs = sorTetelek[i].key;
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadFajlXhr(
          { ceg_id: user.ceg_id, kerelmezo_id: user.id, base64, fajlnev: file.name },
          (percent) => {
            setFeltoltesSor((prev) => prev.map((t) => (t.key === kulcs ? { ...t, progress: percent } : t)));
          },
          "elemezBeerkezettDokumentum",
        );
        if (result?.success) {
          toast.success(
            result.dokumentum.ocr_allapot === "kesz"
              ? `${file.name}: feldolgozva.`
              : `${file.name}: feltöltve, de az automatikus feldolgozás sikertelen — töltsd ki kézzel.`,
          );
        } else {
          toast.error(`${file.name}: ${result?.message || "a feltöltés sikertelen."}`);
        }
      } catch (error) {
        toast.error(`${file.name}: a feltöltés sikertelen.`);
      } finally {
        setFeltoltesSor((prev) => prev.filter((t) => t.key !== kulcs));
      }
    }
    load();
  };

  const handleDiscarded = (id) => {
    setDokumentumok((prev) => prev.filter((d) => d.id !== id));
    setReviewDokumentum(null);
  };

  const handleCreateFuvar = (dokumentum) => {
    history.push("/admin/fuvarForm", {
      dokumentumId: dokumentum.id,
      ocrAdatok: dokumentum.ocr_adatok || {},
    });
  };

  const hibasak = dokumentumok.filter((d) => d.ocr_allapot === "hiba");
  const keszek = dokumentumok.filter((d) => d.ocr_allapot !== "hiba");

  return (
    <>
      <PageHeader eyebrow="Fuvarok" title="Beérkezett dokumentumok" />

      <div className="mb-4 flex gap-2 rounded-full bg-slate-100 p-1 dark:bg-ink-800">
        <button
          type="button"
          onClick={() => setNezet("varakozik")}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            nezet === "varakozik" ? "bg-white text-brand-700 shadow-soft dark:bg-ink-900 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
          }`}
        >
          Feldolgozásra vár
        </button>
        <button
          type="button"
          onClick={() => {
            setNezet("archivum");
            setArchivumOldal(1);
          }}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            nezet === "archivum" ? "bg-white text-brand-700 shadow-soft dark:bg-ink-900 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
          }`}
        >
          Archívum
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-dashed border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700">
          <PiUploadLight className="h-4 w-4" />
          Dokumentum feltöltése (több is kijelölhető)
          <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFilesSelected} />
        </label>

        {feltoltesSor.length > 0 && (
          <div className="mt-3 space-y-2">
            {feltoltesSor.map((t) => (
              <div key={t.key} className="text-xs text-ink-500 dark:text-ink-400">
                <div className="mb-0.5 flex justify-between">
                  <span className="truncate">{t.nev}</span>
                  <span>{t.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${t.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <PiMagnifyingGlassLight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={kereses}
            onChange={(e) => setKereses(e.target.value)}
            placeholder="Keresés fájlnév vagy kinyert adat szerint..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          />
        </div>
        <select
          value={tipusSzuro}
          onChange={(e) => setTipusSzuro(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
        >
          <option value="">Minden típus</option>
          <option value="fuvarlevel">Fuvarlevél</option>
          <option value="szallitolevel">Szállítólevél</option>
          <option value="ismeretlen">Ismeretlen</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Betöltés...</p>
      ) : dokumentumok.length === 0 ? (
        <p className="text-sm text-ink-400">
          {nezet === "varakozik" ? "Nincs feldolgozásra váró dokumentum." : "Nincs a szűrésnek megfelelő dokumentum."}
        </p>
      ) : nezet === "varakozik" ? (
        <div className="space-y-6">
          {hibasak.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Kézi kitöltés szükséges ({hibasak.length})
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {hibasak.map((dok) => (
                  <DokumentumKartya key={dok.id} dokumentum={dok} onOpen={setReviewDokumentum} />
                ))}
              </div>
            </div>
          )}
          {keszek.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                Ellenőrzésre vár ({keszek.length})
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {keszek.map((dok) => (
                  <DokumentumKartya key={dok.id} dokumentum={dok} onOpen={setReviewDokumentum} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dokumentumok.map((dok) => (
              <DokumentumKartya key={dok.id} dokumentum={dok} onOpen={setReviewDokumentum} />
            ))}
          </div>
          {archivumTotal > ARCHIVUM_OLDALMERET && (
            <div className="mt-4 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
              <button
                type="button"
                disabled={archivumOldal <= 1}
                onClick={() => setArchivumOldal((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-ink-800"
              >
                Előző
              </button>
              <span>
                {archivumOldal}. oldal / {Math.ceil(archivumTotal / ARCHIVUM_OLDALMERET)}
              </span>
              <button
                type="button"
                disabled={archivumOldal >= Math.ceil(archivumTotal / ARCHIVUM_OLDALMERET)}
                onClick={() => setArchivumOldal((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-ink-800"
              >
                Következő
              </button>
            </div>
          )}
        </>
      )}

      <DokumentumReviewPanel
        dokumentum={reviewDokumentum}
        onClose={() => setReviewDokumentum(null)}
        onDiscarded={handleDiscarded}
        onCreateFuvar={handleCreateFuvar}
      />
    </>
  );
}
```

- [ ] **Step 2: Rebuild Tailwind if any new utility class was introduced**

Run: `npm run build:tailwind`
Check: `grep -c "rounded-full" src/assets/styles/tailwind.css` (or any other new class used above)
returns a non-zero count.

- [ ] **Step 3: Verify in the browser**

Start `npm start` + `cd backend && php8.2 -S localhost:8001` (reuse if already running). Log in
as admin, go to `/admin/beerkezettDokumentumok`:
1. Upload 2+ files at once (small JPEGs) — confirm each gets its own progress row that reaches
   100% and disappears, and both land as cards afterward.
2. Confirm a card with `ocr_allapot='hiba'` (upload a non-image file with a `.jpg` extension to
   force an OCR failure, or temporarily unset `GEMINI_API_KEY` in `backend/.env`) renders under
   "Kézi kitöltés szükséges", not mixed with the "Ellenőrzésre vár" group.
3. Click a card → confirm the review panel opens with the image preview and fields.
4. Type in the search box → confirm the card list narrows.
5. Switch to "Archívum" → confirm previously fuvar-converted documents appear there (not in
   "Feldolgozásra vár"), with working pager if there are more than 12.
6. Click "Elvetés" on a card with no fuvar yet → confirm it disappears from the list and does not
   reappear in Archívum either (soft-deleted, `torolt <> 'I'` excludes it everywhere).
7. Repeat in dark mode.

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/BeerkezettDokumentumok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): rewrite Beérkezett dokumentumok as a real triage inbox

Multi-file upload with per-file progress, OCR-failure documents grouped
above ready-for-review ones, search/type filter, and a searchable/
paginated Archívum tab (via the extended getBeerkezettDokumentumok) —
replaces the single-file-only, filter-less card grid.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Cross-links — Fuvarok header reminder pill + `FuvarDokumentumLink` on the form

**Files:**
- Modify: `src/views/admin/Fuvarok.js`
- Modify: `src/views/admin/FuvarForm.js`
- Create: `src/components/Fuvarok/FuvarDokumentumLink.js`

**Interfaces:**
- Consumes: `getBeerkezettDokumentumokSzama` (Task 5), `downloadFile` (existing), `formData.
  beerkezett_dokumentum_id`/`fajl_id` (Task 2's data).
- Produces: a "N dokumentum feldolgozásra vár →" pill in the Fuvarok `PageHeader` action slot
  (only rendered when count > 0), and a small "Forrás dokumentum" block on `FuvarForm.js` (only
  rendered when the fuvar has a linked document).

- [ ] **Step 1: Write `FuvarDokumentumLink`**

```jsx
import React, { useEffect, useState } from "react";
import { PiFileTextLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

// Csak akkor renderel bármit, ha a fuvarnak van forrás-dokumentuma
// (beerkezett_dokumentum_id, ld. Task 2) — a legtöbb fuvar kézzel rögzített,
// azoknál ez a komponens null-t ad vissza.
export default function FuvarDokumentumLink({ beerkezettDokumentumId }) {
  const [dokumentum, setDokumentum] = useState(null);

  useEffect(() => {
    if (!beerkezettDokumentumId) {
      setDokumentum(null);
      return;
    }
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getBeerkezettDokumentumok", { ceg_id: user.ceg_id, csakFeldolgozatlan: false }).then(
      (result) => {
        if (!result?.success) return;
        const talalt = (result.dokumentumok || []).find((d) => d.id === beerkezettDokumentumId);
        setDokumentum(talalt || null);
      },
    );
  }, [beerkezettDokumentumId]);

  if (!dokumentum) return null;

  return (
    <a
      href={`/admin/beerkezettDokumentumok`}
      className="mb-4 flex items-center gap-2 rounded-xl border border-ink-100 bg-sand-50 px-3 py-2 text-xs text-ink-600 hover:bg-sand-100 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300"
    >
      <PiFileTextLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
      Ez a fuvar a(z) <span className="font-semibold">{dokumentum.filename}</span> dokumentumból készült.
    </a>
  );
}
```

- [ ] **Step 2: Mount it in `FuvarForm.js`**

Add the import at the top, and right after the `<PageHeader ... />` line (before `<PageCard>`):
```jsx
import FuvarDokumentumLink from "components/Fuvarok/FuvarDokumentumLink.js";
```
```jsx
      <FuvarDokumentumLink beerkezettDokumentumId={formData.beerkezett_dokumentum_id} />
```

- [ ] **Step 3: Add the reminder pill to `Fuvarok.js`**

Add state + effect (mirrors Task 9's Sidebar loader) and pass it as `PageHeader`'s `action`:
```jsx
import { useHistory } from "react-router-dom";
```
```jsx
  const history = useHistory();
  const [dokSzam, setDokSzam] = useState(0);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getBeerkezettDokumentumokSzama", { ceg_id: user.ceg_id }).then((result) => {
      if (result?.success) setDokSzam(result.szam);
    });
  }, []);
```
Change the `<PageHeader ... />` call:
```jsx
      <PageHeader
        eyebrow="Fuvarok"
        title="Fuvarok"
        action={
          dokSzam > 0 && (
            <button
              type="button"
              onClick={() => history.push("/admin/beerkezettDokumentumok")}
              className="rounded-full bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {dokSzam} dokumentum feldolgozásra vár →
            </button>
          )
        }
      />
```

- [ ] **Step 4: Verify in the browser**

With ≥1 pending document: open `/admin/fuvarok`, confirm the pill shows the correct count and
navigates to the inbox on click. Convert or discard all pending documents, reload, confirm the
pill disappears (no empty action slot). Open a fuvar that was created from a document (Task 2's
test data), confirm `FuvarForm.js` shows the "Ez a fuvar a(z) ... dokumentumból készült" block;
open a manually-created fuvar, confirm the block does not render.

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/Fuvarok.js src/views/admin/FuvarForm.js src/components/Fuvarok/FuvarDokumentumLink.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add cross-links between Fuvarok and the document inbox

A header reminder pill on Fuvarok (only when documents are pending) and
a "created from this document" block on FuvarForm — closes the loop the
IA doc calls out: the connection between the two modules was previously
invisible in both directions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: `AllapotOsszesitoChips` — clickable status-count bar

**Files:**
- Create: `src/components/Fuvarok/AllapotOsszesitoChips.js`
- Modify: `src/views/admin/Fuvarok.js`

**Interfaces:**
- Consumes: `getFuvarAllapotOsszesito` (Task 4).
- Produces: `<AllapotOsszesitoChips osszesito={...} active={allapotSzuro} onSelect={fn} />` —
  clicking a chip sets/clears the `allapot` filter already supported by `getFuvarok()`.

- [ ] **Step 1: Write the component**

```jsx
import React from "react";

const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};
const SORREND = ["rogzitett", "szamlazasra_var", "szamlazva", "fizetesre_var", "teljesitve"];

export default function AllapotOsszesitoChips({ osszesito, active, onSelect }) {
  if (!osszesito) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          !active
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
        }`}
      >
        Összes
      </button>
      {SORREND.map((kulcs) => (
        <button
          key={kulcs}
          type="button"
          onClick={() => onSelect(active === kulcs ? "" : kulcs)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === kulcs
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          }`}
        >
          {ALLAPOT_LABEL[kulcs]}: {osszesito[kulcs] ?? 0}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `Fuvarok.js`**

Add state + loader + filter param + render:
```jsx
import AllapotOsszesitoChips from "components/Fuvarok/AllapotOsszesitoChips.js";
```
```jsx
  const [allapotSzuro, setAllapotSzuro] = useState("");
  const [osszesito, setOsszesito] = useState(null);

  const loadOsszesito = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getFuvarAllapotOsszesito", { ceg_id: user.ceg_id });
    if (result?.success) setOsszesito(result.osszesito);
  }, []);

  useEffect(() => {
    loadOsszesito();
  }, [loadOsszesito]);
```

Add `allapot: allapotSzuro || undefined` to the `getFuvarok` call's payload inside the existing
`fetchData` effect, and add `allapotSzuro` to that effect's dependency array (and reset `page` to
1 when it changes, same as the existing `search`/`sortKey` behavior). Render the chips row right
after `<PageHeader ... />`:
```jsx
      <AllapotOsszesitoChips osszesito={osszesito} active={allapotSzuro} onSelect={(v) => { setAllapotSzuro(v); setPage(1); }} />
```

Also call `loadOsszesito()` after any successful bulk/quick status change (wired in Task 15) so
the chip counts stay in sync.

- [ ] **Step 3: Rebuild Tailwind if needed**

Run: `npm run build:tailwind`

- [ ] **Step 4: Verify in the browser**

`/admin/fuvarok`: confirm the chip row shows all 5 states + "Összes" with correct counts (compare
against `SELECT allapot, COUNT(*) FROM fuvarok WHERE admin=1 AND torolt<>'I' GROUP BY allapot;`).
Click a chip → confirm the table narrows to that `allapot` and the chip highlights; click it again
→ confirm it clears back to "Összes".

- [ ] **Step 5: Commit**

```bash
git add src/components/Fuvarok/AllapotOsszesitoChips.js src/views/admin/Fuvarok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add clickable status-count chips to the Fuvarok list

Gives an at-a-glance "how many are stuck at each stage" view and doubles
as the allapot filter control — getFuvarok() already supported the
allapot param, this just wires it up.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Quick status-change popover + bulk status change

**Files:**
- Create: `src/components/UI/StatusChangePopover.js`
- Modify: `src/components/Table/CardTableForFuvarok.js`

**Interfaces:**
- Consumes: `updateFuvarAllapot` (Task 3), `DataTable`'s existing `selectable`/`bulkActions` props.
- Produces: `<StatusChangePopover value={allapot} onChange={(uj) => void} />` — click-to-open
  popover replacing the plain `StatusBadge` in the `allapot` column; a "Állapot módosítása"
  bulk action added to `CardTableForFuvarok.js`'s `DataTable`.

- [ ] **Step 1: Write `StatusChangePopover`**

```jsx
import React, { useState, useRef, useEffect } from "react";
import StatusBadge from "components/UI/StatusBadge.js";

const OPTIONS = [
  { value: "rogzitett", label: "Rögzítve", tone: "neutral" },
  { value: "szamlazasra_var", label: "Számlázásra vár", tone: "warning" },
  { value: "szamlazva", label: "Számlázva", tone: "info" },
  { value: "fizetesre_var", label: "Fizetésre vár", tone: "warning" },
  { value: "teljesitve", label: "Teljesítve", tone: "success" },
];

export default function StatusChangePopover({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-ink-100 bg-white p-1 shadow-soft-lg dark:border-ink-800 dark:bg-ink-900">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (o.value !== value) onChange(o.value);
              }}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-ink-800 ${
                o.value === value ? "text-brand-700 dark:text-brand-300" : "text-ink-600 dark:text-ink-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the `allapot` column + add a bulk action**

In `CardTableForFuvarok.js`, import `StatusChangePopover` and `fetchAction`, replace the `allapot`
column's `render`:
```jsx
    {
      key: "allapot",
      label: "Állapot",
      sortable: true,
      render: (row) => (
        <StatusChangePopover
          value={row.allapot}
          onChange={async (ujAllapot) => {
            const result = await fetchAction("updateFuvarAllapot", {
              ceg_id: user.ceg_id,
              kerelmezo_id: user.id,
              id: row.id,
              allapot: ujAllapot,
            });
            if (result?.success) {
              onAllapotValtozott?.();
            } else {
              toast.error(result?.message || "Az állapot módosítása sikertelen.");
            }
          }}
        />
      ),
    },
```
(Import `toast` from `utils/toast` at the top if not already imported.)

Add a new prop `onAllapotValtozott` to `CardTable`'s destructured props (so `Fuvarok.js` can
refetch the list + Task 14's chip counts after any change), and thread it through to a new bulk
action:
```jsx
  const bulkActions = [
    {
      label: "Állapot: Számlázásra vár",
      onClick: async (rows) => {
        await Promise.all(
          rows.map((row) =>
            fetchAction("updateFuvarAllapot", {
              ceg_id: user.ceg_id,
              kerelmezo_id: user.id,
              id: row.id,
              allapot: "szamlazasra_var",
            }),
          ),
        );
        onAllapotValtozott?.();
      },
    },
    {
      label: "Állapot: Teljesítve",
      onClick: async (rows) => {
        await Promise.all(
          rows.map((row) =>
            fetchAction("updateFuvarAllapot", {
              ceg_id: user.ceg_id,
              kerelmezo_id: user.id,
              id: row.id,
              allapot: "teljesitve",
            }),
          ),
        );
        onAllapotValtozott?.();
      },
    },
  ];
```
Pass `selectable bulkActions={bulkActions}` to the `<DataTable ... />` call.

- [ ] **Step 3: Pass `onAllapotValtozott` from `Fuvarok.js`**

In `Fuvarok.js`, pass a prop to `<CardTable ...>`:
```jsx
            onAllapotValtozott={() => {
              fetchData();
              loadOsszesito();
            }}
```
(`fetchData` needs to be lifted out of the `useEffect` into a `useCallback` if it currently isn't
— extract the existing effect body into a named `fetchData` function, call it both from the
`useEffect` and from this new prop.)

- [ ] **Step 4: Rebuild Tailwind if needed**

Run: `npm run build:tailwind`

- [ ] **Step 5: Verify in the browser**

`/admin/fuvarok`: click a row's status badge → confirm a popover opens with all 5 options, click
a different one → confirm the badge updates in place (no full page reload) and Task 14's chips
update their counts. Select 2+ rows via checkboxes → confirm "Állapot: Számlázásra vár"/"Állapot:
Teljesítve" bulk actions appear and correctly update all selected rows at once. **Critically**,
after any of these, run `SELECT sofor_id, kamion_id, felrako, fuvardij FROM fuvarok WHERE id=<a
changed row's id>;` and confirm those fields are unchanged (this is the exact failure mode Task 3
was designed to avoid).

- [ ] **Step 6: Commit**

```bash
git add src/components/UI/StatusChangePopover.js src/components/Table/CardTableForFuvarok.js src/views/admin/Fuvarok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add quick status-change popover + bulk status change

Both call the dedicated updateFuvarAllapot action (Task 3), never the
full-payload updateFuvar — avoids nulling out other fields on a partial
change. Saves opening the full edit form for a routine status bump.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Kanban board view for Fuvarok

**Files:**
- Create: `src/components/Fuvarok/KanbanBoard.js`
- Create: `src/components/Fuvarok/FuvarKanbanCard.js`
- Modify: `src/views/admin/Fuvarok.js`

**Interfaces:**
- Consumes: `updateFuvarAllapot` (Task 3), the same `fuvarok` array `Fuvarok.js` already loads for
  the table.
- Produces: a Táblázat/Kanban view toggle (persisted in `localStorage` under `fuvarok-nezet-mod`,
  mirroring the Fájlok module's grid/table toggle convention) — Kanban groups the **currently
  loaded, unpaginated** fuvar set by `allapot` into 5 columns, cards draggable between columns via
  native HTML5 drag&drop.

- [ ] **Step 1: Write `FuvarKanbanCard`**

```jsx
import React from "react";

export default function FuvarKanbanCard({ fuvar, onDragStart }) {
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam || "—";
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(fuvar.id));
        onDragStart(fuvar.id);
      }}
      className="cursor-grab rounded-xl border border-ink-100 bg-white p-3 text-xs shadow-soft active:cursor-grabbing dark:border-ink-800 dark:bg-ink-900"
    >
      <p className="mb-1 font-semibold text-ink-700 dark:text-ink-200">
        {fuvar.felrako || "—"} → {fuvar.lerako || "—"}
      </p>
      <p className="text-ink-500 dark:text-ink-400">{fuvar.megbizo_nev || "—"}</p>
      <div className="mt-2 flex items-center justify-between text-ink-400 dark:text-ink-500">
        <span>{fuvar.teljesites_datuma || "—"}</span>
        <span>{jarmu}</span>
      </div>
      {fuvar.osszesen != null && (
        <p className="mt-1 font-semibold text-ink-600 dark:text-ink-300">
          {Number(fuvar.osszesen).toLocaleString("hu-HU")} Ft
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `KanbanBoard`**

```jsx
import React, { useState } from "react";
import FuvarKanbanCard from "components/Fuvarok/FuvarKanbanCard.js";

const OSZLOPOK = [
  { key: "rogzitett", label: "Rögzítve" },
  { key: "szamlazasra_var", label: "Számlázásra vár" },
  { key: "szamlazva", label: "Számlázva" },
  { key: "fizetesre_var", label: "Fizetésre vár" },
  { key: "teljesitve", label: "Teljesítve" },
];

export default function KanbanBoard({ fuvarok, onAllapotChange }) {
  const [dragOverKulcs, setDragOverKulcs] = useState(null);

  const handleDrop = (e, ujAllapot) => {
    e.preventDefault();
    setDragOverKulcs(null);
    const fuvarId = Number(e.dataTransfer.getData("text/plain"));
    if (!fuvarId) return;
    const fuvar = fuvarok.find((f) => f.id === fuvarId);
    if (fuvar && fuvar.allapot !== ujAllapot) {
      onAllapotChange(fuvarId, ujAllapot);
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {OSZLOPOK.map((oszlop) => {
        const idevalok = fuvarok.filter((f) => f.allapot === oszlop.key);
        return (
          <div
            key={oszlop.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverKulcs(oszlop.key);
            }}
            onDragLeave={() => setDragOverKulcs((k) => (k === oszlop.key ? null : k))}
            onDrop={(e) => handleDrop(e, oszlop.key)}
            className={`flex w-64 flex-shrink-0 flex-col rounded-2xl p-2 transition-colors ${
              dragOverKulcs === oszlop.key ? "bg-brand-50 dark:bg-brand-950/30" : "bg-slate-50 dark:bg-ink-800/50"
            }`}
          >
            <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {oszlop.label}
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] dark:bg-ink-900">{idevalok.length}</span>
            </p>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {idevalok.map((fuvar) => (
                <FuvarKanbanCard key={fuvar.id} fuvar={fuvar} onDragStart={() => {}} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add the view toggle to `Fuvarok.js`**

```jsx
import KanbanBoard from "components/Fuvarok/KanbanBoard.js";
import { PiListLight, PiKanbanLight } from "react-icons/pi";
```
```jsx
  const [nezetMod, setNezetMod] = useState(() => localStorage.getItem("fuvarok-nezet-mod") || "tablazat");
  useEffect(() => {
    localStorage.setItem("fuvarok-nezet-mod", nezetMod);
  }, [nezetMod]);

  const handleKanbanAllapotChange = async (fuvarId, ujAllapot) => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("updateFuvarAllapot", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      id: fuvarId,
      allapot: ujAllapot,
    });
    if (result?.success) {
      fetchData();
      loadOsszesito();
    } else {
      toast.error(result?.message || "Az állapot módosítása sikertelen.");
    }
  };
```

Add the toggle buttons next to `AllapotOsszesitoChips` (or in the same row), and branch the body:
```jsx
      <div className="mb-3 flex justify-end gap-1">
        <button
          type="button"
          onClick={() => setNezetMod("tablazat")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
            nezetMod === "tablazat" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          }`}
        >
          <PiListLight className="h-4 w-4" /> Táblázat
        </button>
        <button
          type="button"
          onClick={() => setNezetMod("kanban")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
            nezetMod === "kanban" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          }`}
        >
          <PiKanbanLight className="h-4 w-4" /> Kanban
        </button>
      </div>

      {nezetMod === "kanban" ? (
        <KanbanBoard fuvarok={fuvarok} onAllapotChange={handleKanbanAllapotChange} />
      ) : (
        <CardTable ... /* unchanged */ />
      )}
```

Note: the Kanban view groups whatever `fuvarok` the page currently has loaded (the current page's
`pageSize` rows, same server-paginated array the table uses) — it does **not** fetch a separate,
unpaginated dataset. This is a deliberate scope-limiting choice for this task (documented as an
open question in the design spec, section 12); if a full-inventory Kanban turns out to be
necessary in practice, `getFuvarok` already accepts a large `pageSize` as a workaround, or a
dedicated unpaginated fetch can be added later.

- [ ] **Step 4: Rebuild Tailwind if needed**

Run: `npm run build:tailwind`

- [ ] **Step 5: Verify in the browser**

`/admin/fuvarok`: click "Kanban" → confirm 5 columns render with correct per-column counts
matching Task 14's chips. Drag a card from one column to another → confirm it moves and
`SELECT allapot FROM fuvarok WHERE id=<id>;` reflects the change, and that dragging does **not**
alter any other column on that row (same check as Task 15 Step 5). Reload the page → confirm the
view mode (Kanban vs Táblázat) persisted. Switch back to Táblázat → confirm the existing table is
unaffected. Test in dark mode and on a narrow (mobile) viewport (horizontal scroll across
columns should work via the `overflow-x-auto` wrapper).

- [ ] **Step 6: Commit**

```bash
git add src/components/Fuvarok/KanbanBoard.js src/components/Fuvarok/FuvarKanbanCard.js src/views/admin/Fuvarok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add Kanban board view for Fuvarok

Native HTML5 drag&drop (no new dependency), localStorage-persisted view
toggle mirroring the Fájlok module's grid/table pattern — an optional
view alongside the table, not a replacement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage**: every section of `2026-07-25-fuvarok-ux-redesign-design.md` maps to a task —
  §7 (schema) → Task 1; §8 (backend actions) → Tasks 2-7; §9 (frontend table) → Tasks 8-16;
  sidebar badge/reminder pill (§5/§11) → Tasks 9/13; Kanban (§6/§10) → Task 16; bulk/quick status
  change (§6) → Task 15.
- **Type/name consistency checked**: `updateFuvarAllapot` (action name) / `updateAllapot` (PHP
  method name) used identically across Tasks 3, 15, 16; `getFuvarAllapotOsszesito` /
  `getAllapotOsszesito` likewise across Tasks 4, 14; `torolBeerkezettDokumentum` / `torol()`
  across Tasks 6, 11. `beerkezett_dokumentum_id` spelled identically in Tasks 1, 2, 13.
- **No placeholders**: every step has real, runnable code or an exact `curl`/`mysql` command with
  a stated expected output.
