# Fuvar-first munkafolyamat + sofőr push/feltöltés Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverse the Fuvar module from document-first (OCR) to fuvar-first: admin creates the fuvar with a driver assigned, the driver gets a push notification, uploads menetlevél/szállítólevél photos against that specific fuvar, and the fuvar drops off the driver's active list either when the menetlevél photo lands or when admin manually closes it out — with the sofőr dashboard/nav restructured around this, and the old OCR inbox fully retired.

**Architecture:** Plain PHP (no framework, PDO) backend dispatched through `backend/ApiHandler.php`'s single `process()` switch, calling into `backend/interface/*.php` domain classes; a CRA React frontend split into `layouts/Admin.js` and `layouts/User.js` route trees. No new interface files are needed — `FuvarInterface`, `PushInterface`, `FilesInterface` are already wired into `ApiHandler`. This plan adds a `fuvarok.dokumentum_feltoltve` column, generalizes `push_feliratkozasok` to admin+sofőr recipients, adds sofőr-facing read/upload actions with explicit per-row ownership checks (the codebase's existing generic `fileUpload`/`getFiles` actions only check company-level ownership, not "does this specific fuvar belong to this specific driver" — every new action here closes that gap), and removes the OCR-based `beerkezett_dokumentumok` inbox module end-to-end.

**Tech Stack:** PHP 8.2, PDO/MySQL (MariaDB locally), React 18 (CRA), react-router-dom v5, Tailwind CSS, Web Push (VAPID, already configured in `backend/config.php`).

## Global Constraints

- No automated test suite exists in this repo (confirmed in CLAUDE.md: no PHP tests, no JS test files) — every task's "test" step is a **live verification** against the local MySQL DB / running PHP dev server / running CRA dev server, per this project's own mandated workflow (CLAUDE.md "Szerver oldali módosítások kritikus tesztelése", "Workflow notes for Claude Code"). Do not skip this and call a task done from code-reading alone.
- SQL migrations are sequential numbered files in `backend/sql/N.sql`; the latest committed file at plan-writing time is `41.sql` — verify with `git log --oneline -1 -- backend/sql/` before creating `42.sql`, in case another session has since added `42.sql`.
- New backend actions: 3-step wiring in `backend/ApiHandler.php` — (1) `getActions()` required-params entry, (2) `MODULE_PERMISSION_MAP` entry **only** for admin-side/dual-role-safe actions (a sofőr-only action must NOT get one — `requirePermission()` calls admin-only `resolveKerelmezo()` in `validation()`, before the case-arm ever runs), (3) `case` in `process()`'s switch. All three interfaces used here (`$fuvarInterface`, `$pushInterface`, `$filesInterface`) are already in the single `global $x, $y, ...;` list inside `process()` — no change needed there.
- `resolveSajatSoforId($request)` / `resolveSajatCegId($request)` / `resolveFeltolto($request)` / `requireValidSession($request)` already exist as private `ApiHandler` methods (see `backend/ApiHandler.php:566-658`) — reuse them, do not reinvent.
- Both a local MariaDB `kamion` DB and (usually) a running CRA dev server (port 3000) and PHP dev server (port 8001) are already available in this environment — reuse them.
- Frontend currency: driver-facing fuvar data must never include `fuvardij`/`egyeb_koltseg`/`szamlaszam` — these are admin-only financial fields.

---

### Task 1: DB migration — `dokumentum_feltoltve` column + `push_feliratkozasok` generalization

**Files:**
- Create: `backend/sql/42.sql` (verify this number is still free first)

**Interfaces:**
- Produces: `fuvarok.dokumentum_feltoltve DATETIME NULL` column; `push_feliratkozasok.felhasznalo_tipus ENUM('admin','sofor')` + `push_feliratkozasok.felhasznalo_id INT` (replacing `admin_id`) — every later backend task depends on both.

- [ ] **Step 1: Confirm the next free migration number**

```bash
git log --oneline -1 -- backend/sql/
ls backend/sql/ | sort -V | tail -3
git status --short backend/sql/
```
If `42.sql` already exists (committed or not), use the next free number instead and adjust every reference to `42.sql` below accordingly.

- [ ] **Step 2: Write the migration file**

```sql
-- backend/sql/42.sql
-- Fuvar-first munkafolyamat: a sofőr "aktív fuvarjaim" listája ettől az
-- oszloptól szűr (NULL = még nincs menetlevél-fotó feltöltve). Szándékosan
-- független a `allapot` munkafolyamattól, ld. docs/superpowers/specs/
-- 2026-07-28-fuvar-first-workflow-design.md 5.3.
ALTER TABLE fuvarok ADD COLUMN dokumentum_feltoltve DATETIME NULL AFTER allapot;

-- Push-feliratkozások admin+sofőr címzettre általánosítva. A meglévő
-- sorok (mind admin-feliratkozások) DEFAULT 'admin'-t kapnak a
-- felhasznalo_tipus oszlopon, tehát a régi admin push továbbra is
-- működik módosítás nélkül.
ALTER TABLE push_feliratkozasok
  ADD COLUMN felhasznalo_tipus ENUM('admin','sofor') NOT NULL DEFAULT 'admin' AFTER id,
  CHANGE COLUMN admin_id felhasznalo_id INT NOT NULL,
  DROP INDEX idx_admin,
  ADD INDEX idx_felhasznalo (felhasznalo_tipus, felhasznalo_id);
```

- [ ] **Step 3: Run the migration against the local DB and verify the schema**

```bash
cd backend
php8.2 -r '
$db = new PDO("mysql:host=localhost;dbname=kamion;charset=utf8mb4", "kamion", "VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ");
$db->exec(file_get_contents("sql/42.sql"));
echo "migration applied\n";
$cols = $db->query("SHOW COLUMNS FROM fuvarok LIKE \"dokumentum_feltoltve\"")->fetchAll(PDO::FETCH_ASSOC);
print_r($cols);
$cols2 = $db->query("SHOW COLUMNS FROM push_feliratkozasok")->fetchAll(PDO::FETCH_ASSOC);
print_r($cols2);
'
```
Expected: `dokumentum_feltoltve` shows `Type: datetime`, `Null: YES`. `push_feliratkozasok` shows `felhasznalo_tipus` (`enum('admin','sofor')`, default `admin`) and `felhasznalo_id` (no more `admin_id`).

**IMPORTANT — `ALTER TABLE ... ADD COLUMN`/`CHANGE COLUMN` is not `CREATE TABLE IF NOT EXISTS`, so it is NOT safely re-runnable.** If this exact DB already has these columns from a previous partial run, `$db->exec()` will throw — check with `SHOW COLUMNS` first if Step 3 errors, and skip re-applying if already present.

- [ ] **Step 4: Commit**

```bash
git add backend/sql/42.sql
git commit -m "$(cat <<'EOF'
feat: add dokumentum_feltoltve column and generalize push subscriptions

Lays the DB groundwork for the fuvar-first workflow: fuvarok gets a
dokumentum_feltoltve timestamp (sofőr active-list signal, independent
of allapot), and push_feliratkozasok gains a felhasznalo_tipus column
so both admin and sofőr sessions can subscribe to push notifications.
EOF
)"
```

---

### Task 2: `PushInterface` — generalize to admin+sofőr recipients

**Files:**
- Modify: `backend/interface/pushInterface.php`

**Interfaces:**
- Consumes: `push_feliratkozasok.felhasznalo_tipus`/`felhasznalo_id` (Task 1).
- Produces: `PushInterface::saveFeliratkozas($felhasznaloTipus, $felhasznaloId, $endpoint, $p256dh, $auth)`, `deleteFeliratkozas($felhasznaloTipus, $felhasznaloId, $endpoint)`, `vanFeliratkozva($felhasznaloTipus, $felhasznaloId)`, `sendPushAdminnak($admin_id, $cim, $szoveg, $url=null)` (unchanged call signature, now a thin wrapper), and new `sendPushSofornak($sofor_id, $cim, $szoveg, $url=null)` — Task 3/6 call these.

- [ ] **Step 1: Read the current file for exact context**

```bash
cat backend/interface/pushInterface.php
```
(Already read in full during planning — reproduced below for reference. The current methods are `saveFeliratkozas($admin_id, ...)`, `deleteFeliratkozas($admin_id, $endpoint)`, `vanFeliratkozva($admin_id)`, `sendPushAdminnak($admin_id, $cim, $szoveg, $url=null)`, all keyed by a bare `admin_id` column that Task 1 renamed to `felhasznalo_id` and paired with a new `felhasznalo_tipus` column.)

- [ ] **Step 2: Rewrite `pushInterface.php`**

Replace the entire file content with:

```php
<?php

require_once __DIR__ . '/../WebPushSender.php';

// R11 (fejlesztési audit, 2026-07-19): Web Push feliratkozások tárolása +
// tényleges küldés. A `public/service-worker.js` (ld. ott a `push` event
// listener) már a meglévő PWA-infrastruktúrára épül — ez csak a hiányzó
// másik felét adja hozzá: a feliratkozás perzisztálását és a szerver
// oldali küldést (WebPushSender, composer-függőség nélkül).
//
// 2026-07-28: admin+sofőr címzettre általánosítva (ld. docs/superpowers/
// specs/2026-07-28-fuvar-first-workflow-design.md 4.3/5.5) — korábban
// kizárólag admin-munkamenetre épült (`admin_id` oszlop). A
// `felhasznalo_tipus`/`felhasznalo_id` pár ugyanaz a minta, mint
// `beerkezett_dokumentumok.feltolto_tipus`/`feltolto_id`.
class PushInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Ugyanaz a böngészőnkénti "írás-only" minta, mint a GPSmart/NAV
    // jelszavaknál: egy adott `endpoint` (böngésző-eszköz) mindig csak egy
    // felhasználóhoz tartozhat — újra-feliratkozáskor (pl. kulcs-csere) az
    // `ON DUPLICATE KEY UPDATE` frissíti a meglévő sort ahelyett, hogy
    // duplikálná.
    public function saveFeliratkozas($felhasznaloTipus, $felhasznaloId, $endpoint, $p256dh, $auth) {
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO push_feliratkozasok (felhasznalo_tipus, felhasznalo_id, endpoint, p256dh, auth_kulcs)
                 VALUES (:felhasznalo_tipus, :felhasznalo_id, :endpoint, :p256dh, :auth_kulcs)
                 ON DUPLICATE KEY UPDATE felhasznalo_tipus = :felhasznalo_tipus2, felhasznalo_id = :felhasznalo_id2, p256dh = :p256dh2, auth_kulcs = :auth_kulcs2'
            );
            $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
            $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
            $stmt->bindValue(':endpoint', $endpoint);
            $stmt->bindValue(':p256dh', $p256dh);
            $stmt->bindValue(':auth_kulcs', $auth);
            $stmt->bindValue(':felhasznalo_tipus2', $felhasznaloTipus);
            $stmt->bindValue(':felhasznalo_id2', $felhasznaloId);
            $stmt->bindValue(':p256dh2', $p256dh);
            $stmt->bindValue(':auth_kulcs2', $auth);
            $stmt->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteFeliratkozas($felhasznaloTipus, $felhasznaloId, $endpoint) {
        $stmt = $this->db->prepare(
            'DELETE FROM push_feliratkozasok WHERE felhasznalo_tipus = :felhasznalo_tipus AND felhasznalo_id = :felhasznalo_id AND endpoint = :endpoint'
        );
        $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
        $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
        $stmt->bindValue(':endpoint', $endpoint);
        $stmt->execute();
        return ['success' => true];
    }

    public function vanFeliratkozva($felhasznaloTipus, $felhasznaloId) {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM push_feliratkozasok WHERE felhasznalo_tipus = :felhasznalo_tipus AND felhasznalo_id = :felhasznalo_id'
        );
        $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
        $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
        $stmt->execute();
        return ['success' => true, 'van' => (int) $stmt->fetchColumn() > 0];
    }

    // Egy adott felhasználó MINDEN feliratkozott eszközének elküldi
    // ugyanazt az üzenetet. A már érvénytelen (404/410) feliratkozásokat
    // rögtön törli is.
    private function kuldMinden($felhasznaloTipus, $felhasznaloId, $cim, $szoveg, $url, $alapertelmezettUrl) {
        global $apiConfig;
        if (empty($apiConfig['vapidPrivateKeyPem']) || empty($apiConfig['vapidPublicKey'])) {
            return;
        }

        $stmt = $this->db->prepare(
            'SELECT endpoint, p256dh, auth_kulcs FROM push_feliratkozasok WHERE felhasznalo_tipus = :felhasznalo_tipus AND felhasznalo_id = :felhasznalo_id'
        );
        $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
        $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
        $stmt->execute();
        $feliratkozasok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($feliratkozasok)) {
            return;
        }

        $sender = new WebPushSender($apiConfig['vapidPrivateKeyPem'], $apiConfig['vapidPublicKey'], $apiConfig['vapidSubject']);
        $payload = ['title' => $cim, 'body' => $szoveg, 'url' => $url ?: $alapertelmezettUrl];

        foreach ($feliratkozasok as $f) {
            try {
                $status = $sender->send([
                    'endpoint' => $f['endpoint'],
                    'p256dh' => $f['p256dh'],
                    'auth' => $f['auth_kulcs'],
                ], $payload);

                if ($status === 404 || $status === 410) {
                    $this->deleteFeliratkozas($felhasznaloTipus, $felhasznaloId, $f['endpoint']);
                }
            } catch (Exception $e) {
                error_log('Web push küldés sikertelen: ' . $e->getMessage());
            }
        }
    }

    public function sendPushAdminnak($admin_id, $cim, $szoveg, $url = null) {
        $this->kuldMinden('admin', $admin_id, $cim, $szoveg, $url, '/admin/dashboard');
    }

    // Új: sofőr-címzett push (ld. docs/superpowers/specs/2026-07-28-fuvar-
    // first-workflow-design.md 5.4/5.5) — jelenleg egyetlen hívója az "új
    // fuvar hozzárendelve" esemény (ApiHandler newFuvar/updateFuvar).
    public function sendPushSofornak($sofor_id, $cim, $szoveg, $url = null) {
        $this->kuldMinden('sofor', $sofor_id, $cim, $szoveg, $url, '/user/dashboard');
    }
}

$pushInterface = new PushInterface();
```

- [ ] **Step 3: Lint the file**

```bash
php8.2 -l backend/interface/pushInterface.php
```
Expected: `No syntax errors detected`.

- [ ] **Step 4: Commit**

```bash
git add backend/interface/pushInterface.php
git commit -m "$(cat <<'EOF'
refactor: generalize PushInterface to admin+sofőr recipients

Splits the shared send-to-all-subscriptions logic into a private
kuldMinden() helper keyed by felhasznalo_tipus/felhasznalo_id, adds
sendPushSofornak() alongside the existing sendPushAdminnak().
EOF
)"
```

---

### Task 3: `ApiHandler` — dual-role push subscription actions

**Files:**
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `PushInterface::saveFeliratkozas/deleteFeliratkozas/vanFeliratkozva` (Task 2, new signatures), `requireValidSession($request)` (existing, returns `['felhasznalo_tipus'=>'admin'|'sofor', 'felhasznalo_id'=>int]`).
- Produces: `savePushFeliratkozas`/`deletePushFeliratkozas`/`getPushStatusz` actions now callable from either an admin or a sofőr session — `PushFeliratkozas.js` (Task 12) depends on this.

- [ ] **Step 1: Locate and replace the three push cases**

Find (currently around line 1510-1524):

```php
                case 'savePushFeliratkozas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($pushInterface->saveFeliratkozas($kerelmezo['id'], $request['endpoint'], $request['p256dh'], $request['auth']));
                    return;

                case 'deletePushFeliratkozas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($pushInterface->deleteFeliratkozas($kerelmezo['id'], $request['endpoint']));
                    return;

                case 'getPushStatusz':
                    global $apiConfig;
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $statusz = $pushInterface->vanFeliratkozva($kerelmezo['id']);
                    $statusz['vapidPublicKey'] = $apiConfig['vapidPublicKey'];
                    echo json_encode($statusz);
```

Replace with:

```php
                case 'savePushFeliratkozas':
                    // Mind admin, mind sofőr munkamenetből hívható (ld. a
                    // spec 5.5 pontja) — ezért NEM resolveKerelmezo()
                    // (admin-only), hanem a nyers session, ugyanaz a
                    // tanulság, mint az elemezBeerkezettDokumentum-nál:
                    // egy dual-role actionnek nincs MODULE_PERMISSION_MAP
                    // bejegyzése sem (ld. getActions() alatti komment).
                    $session = $this->requireValidSession($request);
                    echo json_encode($pushInterface->saveFeliratkozas($session['felhasznalo_tipus'], $session['felhasznalo_id'], $request['endpoint'], $request['p256dh'], $request['auth']));
                    return;

                case 'deletePushFeliratkozas':
                    $session = $this->requireValidSession($request);
                    echo json_encode($pushInterface->deleteFeliratkozas($session['felhasznalo_tipus'], $session['felhasznalo_id'], $request['endpoint']));
                    return;

                case 'getPushStatusz':
                    global $apiConfig;
                    $session = $this->requireValidSession($request);
                    $statusz = $pushInterface->vanFeliratkozva($session['felhasznalo_tipus'], $session['felhasznalo_id']);
                    $statusz['vapidPublicKey'] = $apiConfig['vapidPublicKey'];
                    echo json_encode($statusz);
```

(The `return;` after the `getPushStatusz` block already exists further down — do not duplicate it, only replace the lines shown.)

- [ ] **Step 2: Update `getActions()` required params**

Find (around line 418-420):
```php
            'savePushFeliratkozas' => ['endpoint', 'p256dh', 'auth', 'kerelmezo_id'],
            'deletePushFeliratkozas' => ['endpoint', 'kerelmezo_id'],
            'getPushStatusz' => ['kerelmezo_id'],
```
Replace with (both roles send `sessionToken`, already a universal requirement checked elsewhere — `kerelmezo_id` was admin-only terminology and is no longer accurate for a sofőr caller, so it's dropped from the required list; the frontend can keep sending it harmlessly, but the backend no longer requires it):
```php
            'savePushFeliratkozas' => ['endpoint', 'p256dh', 'auth'],
            'deletePushFeliratkozas' => ['endpoint'],
            'getPushStatusz' => [],
```

- [ ] **Step 3: Confirm no `MODULE_PERMISSION_MAP` entry exists for these three** (it never did — just confirm with a grep, don't add one):

```bash
grep -n "savePushFeliratkozas\|deletePushFeliratkozas\|getPushStatusz" backend/ApiHandler.php
```
Expected: only the `getActions()` and `case` lines you just edited — nothing inside `const MODULE_PERMISSION_MAP = [...]`.

- [ ] **Step 4: Lint**

```bash
php8.2 -l backend/ApiHandler.php
```

- [ ] **Step 5: Live-verify both roles can subscribe**

Start (or confirm already running) the PHP dev server, then insert a real sofőr session and admin session, and call all three actions as each role:

```bash
php8.2 -S localhost:8001 > /tmp/php_server.log 2>&1 &
sleep 1
php8.2 -r '
$db = new PDO("mysql:host=localhost;dbname=kamion;charset=utf8mb4", "kamion", "VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ");
$admToken = bin2hex(random_bytes(16));
$soforToken = bin2hex(random_bytes(16));
$db->prepare("INSERT INTO sessions (felhasznalo_id, felhasznalo_tipus, token, lejarat) VALUES (1, \"admin\", :t, DATE_ADD(NOW(), INTERVAL 1 DAY))")->execute([":t" => $admToken]);
$sofor = $db->query("SELECT id FROM user WHERE admin=1 AND torolt<>\"I\" LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$db->prepare("INSERT INTO sessions (felhasznalo_id, felhasznalo_tipus, token, lejarat) VALUES (:id, \"sofor\", :t, DATE_ADD(NOW(), INTERVAL 1 DAY))")->execute([":id" => $sofor["id"], ":t" => $soforToken]);
echo "admToken=$admToken\nsoforToken=$soforToken\nsoforId={$sofor["id"]}\n";
' | tee /tmp/tokens.txt
```

```bash
AUTH="nIrINP&o!PU|+pM*Q8'j1R07U57W,qD"
ADM=$(grep admToken /tmp/tokens.txt | cut -d= -f2)
SOF=$(grep soforToken /tmp/tokens.txt | cut -d= -f2)
echo "--- admin subscribe ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"savePushFeliratkozas\",\"sessionToken\":\"$ADM\",\"endpoint\":\"https://example.com/admin-ep\",\"p256dh\":\"x\",\"auth\":\"y\"}"
echo
echo "--- sofor subscribe ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"savePushFeliratkozas\",\"sessionToken\":\"$SOF\",\"endpoint\":\"https://example.com/sofor-ep\",\"p256dh\":\"x\",\"auth\":\"y\"}"
echo
echo "--- sofor getPushStatusz ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"getPushStatusz\",\"sessionToken\":\"$SOF\"}"
echo
echo "--- sofor unsubscribe ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"deletePushFeliratkozas\",\"sessionToken\":\"$SOF\",\"endpoint\":\"https://example.com/sofor-ep\"}"
echo
```
Expected: all four calls return `{"success":true,...}`, `getPushStatusz` returns `"van":true` before unsubscribing.

- [ ] **Step 6: Clean up test data**

```bash
ADM=$(grep "^admToken=" /tmp/tokens.txt | cut -d= -f2)
SOF=$(grep "^soforToken=" /tmp/tokens.txt | cut -d= -f2)
php8.2 -r "
\$db = new PDO('mysql:host=localhost;dbname=kamion;charset=utf8mb4', 'kamion', 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ');
\$db->exec('DELETE FROM push_feliratkozasok WHERE endpoint IN (\"https://example.com/admin-ep\",\"https://example.com/sofor-ep\")');
\$db->prepare('DELETE FROM sessions WHERE token IN (?, ?)')->execute(['$ADM', '$SOF']);
echo 'cleaned';
"
rm -f /tmp/tokens.txt
```

- [ ] **Step 7: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat: make push subscription actions callable from admin or sofőr sessions

savePushFeliratkozas/deletePushFeliratkozas/getPushStatusz now resolve
identity from requireValidSession() instead of the admin-only
resolveKerelmezo(), so a driver session can subscribe to push too.
EOF
)"
```

---

### Task 4: `FuvarInterface` — sofőr-facing read queries

**Files:**
- Modify: `backend/interface/fuvarInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `fuvarok.dokumentum_feltoltve` (Task 1), existing private `dusitSorokat()`/`dusitEgySort()`/`batchLekerdezes()` methods already in `FuvarInterface`.
- Produces: `FuvarInterface::getSajatFuvarok($sofor_id, $ceg_id, $aktivOnly)`, `getSajatFuvar($id, $sofor_id, $ceg_id)`, `allitDokumentumFeltoltve($fuvarId, $ceg_id)` — Task 5, 6, 9, 10 depend on these.

- [ ] **Step 1: Add the three methods to `FuvarInterface`**

Insert after the existing `getUgyfelElozmeny()` method (right before `keresMegbizoNevAlapjan()`, or anywhere else at class scope — exact position doesn't matter, but keep them together):

```php
    // Sofőr-oldali "saját fuvarjaim" lekérdezés — csak operatív mezőket ad
    // vissza (útvonal/dátum/jármű/megbízó), SOHA fuvardíj/egyéb költség/
    // számlaszámot (ezek admin-oldali pénzügyi mezők, ld. design spec 5.1).
    // `$aktivOnly=true`: a sofőr még nem zárta le (nincs menetlevél-fotó) ÉS
    // az admin sem zárta le (`allapot<>'teljesitve'`) — a kettő bármelyike
    // független módon lezárhatja a fuvart a sofőr szemszögéből (ld. spec 4.1).
    public function getSajatFuvarok($sofor_id, $ceg_id, $aktivOnly = true) {
        $lezarasFeltetel = $aktivOnly
            ? "AND dokumentum_feltoltve IS NULL AND allapot <> 'teljesitve'"
            : "AND (dokumentum_feltoltve IS NOT NULL OR allapot = 'teljesitve')";
        $stmt = $this->db->prepare(
            "SELECT id, kamion_id, furgon_id, potkocsi_id, teljesites_datuma, felrako, lerako,
                    tavolsag_km, tomeg_kg, megbizo_id, aru_megnevezese, megjegyzes, allapot,
                    dokumentum_feltoltve
             FROM fuvarok
             WHERE sofor_id = :sofor_id AND admin = :ceg_id AND torolt <> 'I' $lezarasFeltetel
             ORDER BY teljesites_datuma DESC, letrehozva DESC"
        );
        $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $this->dusitSorokat($stmt->fetchAll(PDO::FETCH_ASSOC), $ceg_id)];
    }

    // Egyetlen fuvar, `sofor_id` egyezés-ellenőrzéssel — ha a fuvar nem
    // létezik VAGY nem a hívó sofőré, `success:false` (ugyanaz az IDOR-
    // védelmi minta, mint `BeerkezettDokumentumInterface::torolSajat()`-nál).
    public function getSajatFuvar($id, $sofor_id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, kamion_id, furgon_id, potkocsi_id, teljesites_datuma, felrako, lerako,
                    tavolsag_km, tomeg_kg, megbizo_id, aru_megnevezese, megjegyzes, allapot,
                    dokumentum_feltoltve
             FROM fuvarok
             WHERE id = :id AND sofor_id = :sofor_id AND admin = :ceg_id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvar = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($fuvar === false) {
            return ['success' => false, 'message' => 'A fuvar nem található.'];
        }
        return ['success' => true, 'fuvar' => $this->dusitEgySort($fuvar, $ceg_id)];
    }

    // Csak az ELSŐ menetlevél-feltöltéskor ír ténylegesen (idempotens) —
    // ld. design spec 5.1. Sosem hívjuk közvetlenül kliensből; a
    // feltoltFuvarDokumentumot action (Task 5) hívja belülről sikeres
    // 'menetlevel'-tagelt feltöltés után.
    public function allitDokumentumFeltoltve($fuvarId, $ceg_id) {
        $stmt = $this->db->prepare(
            "UPDATE fuvarok SET dokumentum_feltoltve = NOW()
             WHERE id = :id AND admin = :ceg_id AND dokumentum_feltoltve IS NULL"
        );
        $stmt->bindValue(':id', $fuvarId, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true];
    }
```

- [ ] **Step 2: Wire `getSajatFuvarok`/`getSajatFuvar` into `ApiHandler`**

Add to `getActions()` (near the other `Fuvar*` entries, e.g. right after `'getFuvarok' => ['ceg_id'],`):
```php
            'getSajatFuvarok' => ['sofor_id'],
            'getSajatFuvar' => ['id', 'sofor_id'],
```

Add cases in `process()`'s switch (near `getFuvarok`):
```php
                case 'getSajatFuvarok':
                    // Sofőr-önkiszolgáló akció, nincs MODULE_PERMISSION_MAP
                    // bejegyzése — a sofőr mindig látja a SAJÁT fuvarjait,
                    // ugyanaz a minta, mint getSajatBeerkezettDokumentumok-nál.
                    echo json_encode($fuvarInterface->getSajatFuvarok(
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request),
                        !isset($request['aktivOnly']) || $request['aktivOnly']
                    ));
                    return;
                case 'getSajatFuvar':
                    echo json_encode($fuvarInterface->getSajatFuvar(
                        $request['id'],
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request)
                    ));
                    return;
```
Do **not** add `MODULE_PERMISSION_MAP` entries for these two (sofőr-only, would break via `resolveKerelmezo()` inside `requirePermission()`).

- [ ] **Step 3: Lint both files**

```bash
php8.2 -l backend/interface/fuvarInterface.php
php8.2 -l backend/ApiHandler.php
```

- [ ] **Step 4: Live-verify against the local DB**

```bash
php8.2 -S localhost:8001 > /tmp/php_server.log 2>&1 &
sleep 1
php8.2 -r '
$db = new PDO("mysql:host=localhost;dbname=kamion;charset=utf8mb4", "kamion", "VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ");
$sofor = $db->query("SELECT id FROM user WHERE admin=1 AND torolt<>\"I\" LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$token = bin2hex(random_bytes(16));
$db->prepare("INSERT INTO sessions (felhasznalo_id, felhasznalo_tipus, token, lejarat) VALUES (:id, \"sofor\", :t, DATE_ADD(NOW(), INTERVAL 1 DAY))")->execute([":id" => $sofor["id"], ":t" => $token]);
$fuvarId = $db->query("SELECT id FROM fuvarok WHERE admin=1 AND torolt<>\"I\" LIMIT 1")->fetchColumn();
echo "token=$token\nsoforId={$sofor["id"]}\nfuvarId=" . var_export($fuvarId, true) . "\n";
' | tee /tmp/tokens.txt
```
```bash
AUTH="nIrINP&o!PU|+pM*Q8'j1R07U57W,qD"
TOK=$(grep "^token=" /tmp/tokens.txt | cut -d= -f2)
echo "--- getSajatFuvarok (aktivOnly default true) ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"getSajatFuvarok\",\"sessionToken\":\"$TOK\"}"
echo
echo "--- getSajatFuvarok (aktivOnly=false) ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"getSajatFuvarok\",\"sessionToken\":\"$TOK\",\"aktivOnly\":false}"
echo
```
Expected: both return `{"success":true,"fuvarok":[...]}` (arrays may legitimately be empty if this sofőr has no fuvar rows yet — if so, insert one first: `INSERT INTO fuvarok (admin, sofor_id, felrako, lerako, allapot) VALUES (1, <soforId>, 'Teszt A', 'Teszt B', 'rogzitett')` and re-run). Confirm the response never contains `fuvardij`/`egyeb_koltseg`/`szamlaszam` keys.

- [ ] **Step 5: Clean up test data**

```bash
TOK=$(grep "^token=" /tmp/tokens.txt | cut -d= -f2)
php8.2 -r "
\$db = new PDO('mysql:host=localhost;dbname=kamion;charset=utf8mb4', 'kamion', 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ');
\$db->prepare('DELETE FROM sessions WHERE token = ?')->execute(['$TOK']);
"
rm -f /tmp/tokens.txt
```

- [ ] **Step 6: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat: add sofőr-facing getSajatFuvarok/getSajatFuvar queries

Driver-scoped fuvar lookups, ownership-checked by sofor_id, returning
only operational fields (never fuvardíj/egyéb költség/számlaszám).
allitDokumentumFeltoltve() stamps the active-list-closing timestamp.
EOF
)"
```

---

### Task 5: `FuvarInterface`/`ApiHandler` — ownership-checked document upload/delete/list actions

**Files:**
- Modify: `backend/interface/fuvarInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `FuvarInterface::getSajatFuvar()` (Task 4), `FuvarInterface::allitDokumentumFeltoltve()` (Task 4), `FilesInterface::fileUpload()`/`deleteFile()`/`getFiles()` (existing), `resolveFeltolto($request)` (existing, returns `[$tipus, $id, $nev]`).
- Produces: actions `feltoltFuvarDokumentumot`, `torolSajatFuvarDokumentumot`, `getSajatFuvarDokumentumai` — Task 10 (`FuvarReszletek.js`) depends on all three.

- [ ] **Step 1: Add a fuvar-ownership-of-a-file helper + two wrapper actions' backing logic to `FuvarInterface`**

Add these new methods (place them near `getSajatFuvar()`):

```php
    // A `fajlok` sor `rowid`-jából (egy fuvar id) visszaadja, TÉNYLEG a
    // hívó sofőré-e az a fuvar — a `feltoltFuvarDokumentumot`/
    // `torolSajatFuvarDokumentumot`/`getSajatFuvarDokumentumai` közös
    // védelmi rétege (ld. design spec 5.2: a generikus `FilesInterface::
    // fileUpload()`/`getFiles()` csak céges szinten szűr, egy sofőr
    // fuvar-tulajdonjogát nem ismeri).
    private function sajatFuvarE($fuvarId, $sofor_id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id FROM fuvarok WHERE id = :id AND sofor_id = :sofor_id AND admin = :ceg_id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $fuvarId, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
    }
```

- [ ] **Step 2: Add the three actions to `ApiHandler`**

`getActions()` (near the `getSajatFuvar*` entries added in Task 4):
```php
            'feltoltFuvarDokumentumot' => ['fuvarId', 'tipus', 'file', 'name', 'size'],
            'torolSajatFuvarDokumentumot' => ['fajlId'],
            'getSajatFuvarDokumentumai' => ['fuvarId'],
```

`process()` switch (near the `getSajatFuvar` case):
```php
                case 'feltoltFuvarDokumentumot':
                    // Sofőr-only, ownership-ellenőrzött feltöltés — ld.
                    // design spec 5.2. Nincs MODULE_PERMISSION_MAP-bejegyzés
                    // (ugyanaz az ok, mint a getSajatFuvar*-nál).
                    $tipus = $request['tipus'] ?? '';
                    if (!in_array($tipus, ['menetlevel', 'szallitolevel'], true)) {
                        echo json_encode(['success' => false, 'message' => 'Érvénytelen dokumentumtípus.']);
                        return;
                    }
                    $soforId = $this->resolveSajatSoforId($request);
                    $cegId = $this->resolveSajatCegId($request);
                    $fuvarJavaslat = $fuvarInterface->getSajatFuvar($request['fuvarId'], $soforId, $cegId);
                    if (!$fuvarJavaslat['success']) {
                        echo json_encode(['success' => false, 'message' => 'A fuvar nem található.']);
                        return;
                    }
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    $result = $filesInterface->fileUpload(
                        $cegId,
                        'fuvar',
                        $request['fuvarId'],
                        $request['file'],
                        $request['name'],
                        $request['size'],
                        null,
                        $feltoltoTipus,
                        $feltoltoId,
                        $feltoltoNev,
                        $tipus
                    );
                    if ($result['success'] && $tipus === 'menetlevel') {
                        $fuvarInterface->allitDokumentumFeltoltve($request['fuvarId'], $cegId);
                    }
                    echo json_encode($result);
                    return;
                case 'torolSajatFuvarDokumentumot':
                    $soforId = $this->resolveSajatSoforId($request);
                    $cegId = $this->resolveSajatCegId($request);
                    $fajlSor = $this->db->prepare("SELECT rowid FROM fajlok WHERE sorszam = :id AND tabla = 'fuvar' AND admin = :ceg_id");
                    $fajlSor->bindValue(':id', $request['fajlId'], PDO::PARAM_INT);
                    $fajlSor->bindValue(':ceg_id', $cegId, PDO::PARAM_INT);
                    $fajlSor->execute();
                    $fuvarId = $fajlSor->fetchColumn();
                    if ($fuvarId === false || !$fuvarInterface->getSajatFuvar($fuvarId, $soforId, $cegId)['success']) {
                        echo json_encode(['success' => false, 'message' => 'A dokumentum nem található.']);
                        return;
                    }
                    echo json_encode($filesInterface->deleteFile($request['fajlId'], $cegId));
                    return;
                case 'getSajatFuvarDokumentumai':
                    $soforId = $this->resolveSajatSoforId($request);
                    $cegId = $this->resolveSajatCegId($request);
                    if (!$fuvarInterface->getSajatFuvar($request['fuvarId'], $soforId, $cegId)['success']) {
                        echo json_encode(['success' => false, 'message' => 'A fuvar nem található.']);
                        return;
                    }
                    echo json_encode($filesInterface->getFiles('fuvar', $request['fuvarId'], null, null, null, $cegId));
                    return;
```

- [ ] **Step 3: Lint**

```bash
php8.2 -l backend/interface/fuvarInterface.php
php8.2 -l backend/ApiHandler.php
```

- [ ] **Step 4: Live-verify — happy path + ownership rejection**

```bash
php8.2 -S localhost:8001 > /tmp/php_server.log 2>&1 &
sleep 1
php8.2 -r '
$db = new PDO("mysql:host=localhost;dbname=kamion;charset=utf8mb4", "kamion", "VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ");
$soforok = $db->query("SELECT id FROM user WHERE admin=1 AND torolt<>\"I\" LIMIT 2")->fetchAll(PDO::FETCH_ASSOC);
$soforA = $soforok[0]["id"]; $soforB = $soforok[1]["id"] ?? null;
$fuvarId = $db->prepare("INSERT INTO fuvarok (admin, sofor_id, felrako, lerako, allapot) VALUES (1, :s, \"Teszt A\", \"Teszt B\", \"rogzitett\")");
$fuvarId->execute([":s" => $soforA]);
$fid = $db->lastInsertId();
$tokA = bin2hex(random_bytes(16)); $tokB = bin2hex(random_bytes(16));
$db->prepare("INSERT INTO sessions (felhasznalo_id, felhasznalo_tipus, token, lejarat) VALUES (:id,\"sofor\",:t,DATE_ADD(NOW(),INTERVAL 1 DAY))")->execute([":id"=>$soforA,":t"=>$tokA]);
if ($soforB) $db->prepare("INSERT INTO sessions (felhasznalo_id, felhasznalo_tipus, token, lejarat) VALUES (:id,\"sofor\",:t,DATE_ADD(NOW(),INTERVAL 1 DAY))")->execute([":id"=>$soforB,":t"=>$tokB]);
echo "fuvarId=$fid\ntokA=$tokA\ntokB=" . ($soforB ? $tokB : "NONE") . "\n";
' | tee /tmp/tokens.txt
```
```bash
AUTH="nIrINP&o!PU|+pM*Q8'j1R07U57W,qD"
FID=$(grep "^fuvarId=" /tmp/tokens.txt | cut -d= -f2)
TOKA=$(grep "^tokA=" /tmp/tokens.txt | cut -d= -f2)
TOKB=$(grep "^tokB=" /tmp/tokens.txt | cut -d= -f2)
B64=$(echo -n "teszt tartalom" | base64)
echo "--- soforA feltolt menetlevelet a SAJAT fuvarjara (varhato: success) ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"feltoltFuvarDokumentumot\",\"sessionToken\":\"$TOKA\",\"fuvarId\":$FID,\"tipus\":\"menetlevel\",\"file\":\"$B64\",\"name\":\"teszt.jpg\",\"size\":14}"
echo
echo "--- getSajatFuvar most mar dokumentum_feltoltve legyen kitoltve ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"getSajatFuvar\",\"sessionToken\":\"$TOKA\",\"id\":$FID}"
echo
if [ "$TOKB" != "NONE" ]; then
echo "--- soforB probal feltolteni soforA fuvarjara (varhato: elutasitas) ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"feltoltFuvarDokumentumot\",\"sessionToken\":\"$TOKB\",\"fuvarId\":$FID,\"tipus\":\"menetlevel\",\"file\":\"$B64\",\"name\":\"idegen.jpg\",\"size\":14}"
echo
fi
echo "--- getSajatFuvarDokumentumai (soforA) ---"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"getSajatFuvarDokumentumai\",\"sessionToken\":\"$TOKA\",\"fuvarId\":$FID}"
echo
```
Expected: soforA's upload succeeds (`success:true`), `getSajatFuvar` afterwards shows a non-null `dokumentum_feltoltve`, soforB's attempt returns `success:false` with "A fuvar nem található.", and `getSajatFuvarDokumentumai` lists the one uploaded file with `cimkek: "menetlevel"`.

- [ ] **Step 5: Clean up test data**

```bash
FID=$(grep "^fuvarId=" /tmp/tokens.txt | cut -d= -f2)
TOKA=$(grep "^tokA=" /tmp/tokens.txt | cut -d= -f2)
TOKB=$(grep "^tokB=" /tmp/tokens.txt | cut -d= -f2)
php8.2 -r "
\$db = new PDO('mysql:host=localhost;dbname=kamion;charset=utf8mb4', 'kamion', 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ');
\$rows = \$db->query('SELECT sorszam, hely FROM fajlok WHERE tabla=\"fuvar\" AND rowid=$FID')->fetchAll(PDO::FETCH_ASSOC);
foreach (\$rows as \$r) { if (file_exists(\$r['hely'])) unlink(\$r['hely']); }
\$db->exec('DELETE FROM fajlok WHERE tabla=\"fuvar\" AND rowid=$FID');
\$db->exec('DELETE FROM fuvarok WHERE id=$FID');
\$db->prepare('DELETE FROM sessions WHERE token IN (?, ?)')->execute(['$TOKA', '$TOKB']);
echo 'cleaned';
"
rm -f /tmp/tokens.txt
```

- [ ] **Step 6: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat: add ownership-checked fuvar document upload/delete/list actions

feltoltFuvarDokumentumot/torolSajatFuvarDokumentumot/getSajatFuvarDokumentumai
verify the target fuvar's sofor_id matches the caller before touching
the generic fileUpload/deleteFile/getFiles primitives, which only
check company-level ownership on their own.
EOF
)"
```

---

### Task 6: Push notification on fuvar assignment

**Files:**
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `PushInterface::sendPushSofornak()` (Task 2).
- Produces: side effect on `newFuvar`/`updateFuvar` — no new interface for later tasks.

- [ ] **Step 1: Update the `newFuvar` case**

Find:
```php
                case 'newFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->newFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', $request['felrako'] ?? null);
                    }
                    echo json_encode($result);
                    return;
```
Replace with:
```php
                case 'newFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->newFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', $request['felrako'] ?? null);
                        if (!empty($result['fuvar']['sofor_id'])) {
                            $pushInterface->sendPushSofornak(
                                $result['fuvar']['sofor_id'],
                                'Új fuvar érkezett',
                                trim(($result['fuvar']['felrako'] ?? '') . ' → ' . ($result['fuvar']['lerako'] ?? '')) . ($result['fuvar']['teljesites_datuma'] ? ' · ' . $result['fuvar']['teljesites_datuma'] : ''),
                                '/user/fuvarReszletek?id=' . $result['fuvar']['id']
                            );
                        }
                    }
                    echo json_encode($result);
                    return;
```

- [ ] **Step 2: Update the `updateFuvar` case**

Find:
```php
                case 'updateFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->updateFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'modositas', $request['felrako'] ?? null);
                    }
                    echo json_encode($result);
                    return;
```
Replace with:
```php
                case 'updateFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    // A push-küldés eldöntéséhez a RÉGI sofor_id-t az UPDATE
                    // előtt kell megnézni — csak akkor küldünk, ha ténylegesen
                    // ÚJ (nem üres) sofőrre került a fuvar, a leváltott sofőr
                    // nem kap semmit (ld. design spec 5.4, jóváhagyott döntés).
                    $regiSoforId = $this->db->prepare("SELECT sofor_id FROM fuvarok WHERE id = :id AND admin = :ceg_id");
                    $regiSoforId->bindValue(':id', $request['id'], PDO::PARAM_INT);
                    $regiSoforId->bindValue(':ceg_id', $kerelmezo['ceg_id'], PDO::PARAM_INT);
                    $regiSoforId->execute();
                    $regiSoforIdErtek = $regiSoforId->fetchColumn();

                    $result = $fuvarInterface->updateFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'modositas', $request['felrako'] ?? null);
                        $ujSoforId = $result['fuvar']['sofor_id'] ?? null;
                        if (!empty($ujSoforId) && (string) $ujSoforId !== (string) $regiSoforIdErtek) {
                            $pushInterface->sendPushSofornak(
                                $ujSoforId,
                                'Új fuvar érkezett',
                                trim(($result['fuvar']['felrako'] ?? '') . ' → ' . ($result['fuvar']['lerako'] ?? '')) . ($result['fuvar']['teljesites_datuma'] ? ' · ' . $result['fuvar']['teljesites_datuma'] : ''),
                                '/user/fuvarReszletek?id=' . $result['fuvar']['id']
                            );
                        }
                    }
                    echo json_encode($result);
                    return;
```

- [ ] **Step 2: Lint**

```bash
php8.2 -l backend/ApiHandler.php
```

- [ ] **Step 3: Live-verify**

```bash
php8.2 -S localhost:8001 > /tmp/php_server.log 2>&1 &
sleep 1
php8.2 -r '
$db = new PDO("mysql:host=localhost;dbname=kamion;charset=utf8mb4", "kamion", "VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ");
$sofor = $db->query("SELECT id FROM user WHERE admin=1 AND torolt<>\"I\" LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$token = bin2hex(random_bytes(16));
$db->prepare("INSERT INTO sessions (felhasznalo_id, felhasznalo_tipus, token, lejarat) VALUES (1,\"admin\",:t,DATE_ADD(NOW(),INTERVAL 1 DAY))")->execute([":t"=>$token]);
// egy fake push-feliratkozas, hogy a sendPushSofornak() ne 0-sorosan terjen vissza
$db->prepare("INSERT INTO push_feliratkozasok (felhasznalo_tipus, felhasznalo_id, endpoint, p256dh, auth_kulcs) VALUES (\"sofor\", :id, \"https://example.com/fake-endpoint\", \"x\", \"y\")")->execute([":id" => $sofor["id"]]);
echo "adminToken=$token\nsoforId={$sofor["id"]}\n";
' | tee /tmp/tokens.txt
```
```bash
AUTH="nIrINP&o!PU|+pM*Q8'j1R07U57W,qD"
TOK=$(grep "^adminToken=" /tmp/tokens.txt | cut -d= -f2)
SID=$(grep "^soforId=" /tmp/tokens.txt | cut -d= -f2)
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"newFuvar\",\"sessionToken\":\"$TOK\",\"ceg_id\":1,\"kerelmezo_id\":1,\"sofor_id\":$SID,\"felrako\":\"Teszt Fel\",\"lerako\":\"Teszt Le\"}"
echo
tail -5 /tmp/php_server.log
```
Expected: `newFuvar` returns `success:true`; `WebPushSender` attempts a send to the fake endpoint (which will fail against a non-existent real push service — a caught exception logged via `error_log`, visible in `/tmp/php_server.log`, is the CORRECT outcome here — it proves the code path executed, not that push delivery itself works against a fake URL).

- [ ] **Step 4: Clean up test data**

```bash
SID=$(grep "^soforId=" /tmp/tokens.txt | cut -d= -f2)
TOK=$(grep "^adminToken=" /tmp/tokens.txt | cut -d= -f2)
php8.2 -r "
\$db = new PDO('mysql:host=localhost;dbname=kamion;charset=utf8mb4', 'kamion', 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ');
\$db->exec('DELETE FROM fuvarok WHERE felrako=\"Teszt Fel\" AND lerako=\"Teszt Le\"');
\$db->exec('DELETE FROM push_feliratkozasok WHERE endpoint=\"https://example.com/fake-endpoint\"');
\$db->prepare('DELETE FROM sessions WHERE token = ?')->execute(['$TOK']);
"
rm -f /tmp/tokens.txt
```

- [ ] **Step 5: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat: push-notify the assigned sofőr on new/reassigned fuvar

newFuvar always notifies if a driver is set; updateFuvar compares the
pre-update sofor_id and only notifies the NEW driver on an actual
reassignment, never the one who got replaced.
EOF
)"
```

---

### Task 7: Retire the OCR-based Beérkezett Dokumentumok backend module

**Files:**
- Delete: `backend/interface/beerkezettDokumentumInterface.php`
- Delete: `backend/GeminiOcrClient.php`
- Modify: `backend/ApiHandler.php`
- Modify: `backend/interface/fuvarInterface.php`

**Interfaces:**
- Removes: `elemezBeerkezettDokumentum`, `getBeerkezettDokumentumok`, `getBeerkezettDokumentumokSzama`, `updateBeerkezettDokumentumTipus`, `updateBeerkezettDokumentumSofor`, `torolBeerkezettDokumentum`, `getSajatBeerkezettDokumentumok`, `torolSajatBeerkezettDokumentum`, `getFuvarEgyeztetesJavaslat`, `letrehozFuvarDokumentumbol`, `csatolBeerkezettDokumentumotFuvarhoz` actions entirely. `beerkezett_dokumentumok` **DB table stays** (not dropped).

- [ ] **Step 1: Delete the two PHP files**

```bash
rm backend/interface/beerkezettDokumentumInterface.php backend/GeminiOcrClient.php
```

- [ ] **Step 2: Remove the `require` line**

In `backend/ApiHandler.php`, delete:
```php
require 'interface/beerkezettDokumentumInterface.php';
```
(near the top, alongside the other `require 'interface/...'` lines).

- [ ] **Step 3: Remove `$beerkezettDokumentumInterface` from the `global` list in `process()`**

Find (around line 719):
```php
        global $kamionInterface, $potkocsiInterface, $furgonInterface, $soforokInterface, $filesInterface, $emailInterface, $bejelentesekInterface, $karbantartasInterface, $szabadsagInterface, $tankolasInterface, $jarmuValtasInterface, $ugyfelInterface, $csapatInterface, $helyszinInterface, $jogosultsagInterface, $szerepkorInterface, $listaInterface, $keresesInterface, $koltsegInterface, $ertesitesInterface, $navSzamlaInterface, $gpsmartInterface, $piaciArakInterface, $pushInterface, $bankImportInterface, $molTankolasInterface, $tachografInterface, $tachografVuInterface, $beerkezettDokumentumInterface, $fuvarInterface;
```
Replace with (drop `$beerkezettDokumentumInterface`):
```php
        global $kamionInterface, $potkocsiInterface, $furgonInterface, $soforokInterface, $filesInterface, $emailInterface, $bejelentesekInterface, $karbantartasInterface, $szabadsagInterface, $tankolasInterface, $jarmuValtasInterface, $ugyfelInterface, $csapatInterface, $helyszinInterface, $jogosultsagInterface, $szerepkorInterface, $listaInterface, $keresesInterface, $koltsegInterface, $ertesitesInterface, $navSzamlaInterface, $gpsmartInterface, $piaciArakInterface, $pushInterface, $bankImportInterface, $molTankolasInterface, $tachografInterface, $tachografVuInterface, $fuvarInterface;
```

- [ ] **Step 4: Remove the `getActions()` entries**

Delete these lines from `getActions()`:
```php
            'elemezBeerkezettDokumentum' => ['base64', 'fajlnev', 'ceg_id', 'kerelmezo_id'],
            'getBeerkezettDokumentumok' => ['ceg_id'],
            'getBeerkezettDokumentumokSzama' => ['ceg_id'],
            'updateBeerkezettDokumentumTipus' => ['id', 'ceg_id', 'tipus'],
            'updateBeerkezettDokumentumSofor' => ['id', 'ceg_id'],
            'torolBeerkezettDokumentum' => ['id', 'ceg_id'],
            'getSajatBeerkezettDokumentumok' => ['sofor_id'],
            'torolSajatBeerkezettDokumentum' => ['id', 'sofor_id'],
```
and:
```php
            'getFuvarEgyeztetesJavaslat' => ['dokumentumId', 'ceg_id'],
```
and:
```php
            'csatolBeerkezettDokumentumotFuvarhoz' => ['dokumentumId', 'fuvarId', 'ceg_id', 'kerelmezo_id'],
```
and (inside `letrehozFuvarDokumentumbol`'s own line):
```php
            'letrehozFuvarDokumentumbol' => ['dokumentumId', 'ceg_id', 'kerelmezo_id'],
```

- [ ] **Step 5: Remove the `MODULE_PERMISSION_MAP` entries**

Delete the whole comment block + these lines:
```php
        // 'elemezBeerkezettDokumentum' szándékosan NINCS itt (ld. a case-ág
        // saját kommentjét lentebb) — mind admin, mind sofőr munkamenetből
        // hívható (sofőr-oldali fuvarlevél-feltöltés), és a
        // requirePermission() saját maga is resolveKerelmezo()-t hív, ami
        // admin-only, tehát bármelyik MODULE_PERMISSION_MAP-bejegyzés itt
        // a sofőr-hívást már a validation()-ben elvérezteti, mielőtt a
        // case-ág saját resolveSajatCegId()-fixe egyáltalán lefutna —
        // ugyanaz a minta, mint a `fileUpload`/`getHelyszinek`/stb. egyéb,
        // mindkét munkamenet-típusból hívható akcióknál, amik szintén nem
        // szerepelnek ebben a map-ben.
        'getBeerkezettDokumentumok' => ['fuvarok', 'hozzaferes'],
        'getBeerkezettDokumentumokSzama' => ['fuvarok', 'hozzaferes'],
        'updateBeerkezettDokumentumTipus' => ['fuvarok', 'szerkesztes'],
        'updateBeerkezettDokumentumSofor' => ['fuvarok', 'szerkesztes'],
        'torolBeerkezettDokumentum' => ['fuvarok', 'torles'],
```
and:
```php
        'getFuvarEgyeztetesJavaslat' => ['fuvarok', 'hozzaferes'],
```
and:
```php
        'letrehozFuvarDokumentumbol' => ['fuvarok', 'szerkesztes'],
        'csatolBeerkezettDokumentumotFuvarhoz' => ['fuvarok', 'szerkesztes'],
```

- [ ] **Step 6: Remove the `case` blocks from `process()`**

Delete these entire case blocks (each ends with its own `return;`):
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
                case 'getBeerkezettDokumentumokSzama':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($beerkezettDokumentumInterface->getSzama($kerelmezo['ceg_id']));
                    return;
                case 'updateBeerkezettDokumentumTipus':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($beerkezettDokumentumInterface->updateTipus($request['id'], $kerelmezo['ceg_id'], $request['tipus']));
                    return;
                case 'updateBeerkezettDokumentumSofor':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($beerkezettDokumentumInterface->updateSofor($request['id'], $kerelmezo['ceg_id'], $request['soforId'] ?? null));
                    return;
                case 'torolBeerkezettDokumentum':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $beerkezettDokumentumInterface->torol($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'beerkezett_dokumentumok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getSajatBeerkezettDokumentumok':
                    // Sofőr-önkiszolgáló akció (ld. getBejelentesekSofor
                    // mintáját) — nincs MODULE_PERMISSION_MAP-bejegyzése,
                    // mert nem admin-konfigurálható modul-jogosultság alá
                    // tartozik, a sofőr mindig látja a SAJÁT feltöltéseit.
                    echo json_encode($beerkezettDokumentumInterface->getSajatDokumentumok(
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request),
                        $request['limit'] ?? null
                    ));
                    return;
                case 'torolSajatBeerkezettDokumentum':
                    echo json_encode($beerkezettDokumentumInterface->torolSajat(
                        $request['id'],
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request)
                    ));
                    return;
```
and:
```php
                case 'getFuvarEgyeztetesJavaslat':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($fuvarInterface->getEgyeztetesJavaslatDokumentumhoz($request['dokumentumId'], $kerelmezo['ceg_id']));
                    return;
```
and:
```php
                case 'letrehozFuvarDokumentumbol':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->letrehozDokumentumbol($request['dokumentumId'], $kerelmezo['ceg_id'], $request['felulirasok'] ?? []);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', 'dokumentumból');
                    }
                    echo json_encode($result);
                    return;
                case 'csatolBeerkezettDokumentumotFuvarhoz':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->csatolDokumentumot($request['dokumentumId'], $request['fuvarId'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['fuvarId'], 'dokumentum_csatolva', null);
                    }
                    echo json_encode($result);
                    return;
```
(keep `getFuvarAllapotOsszesito` and everything after — do not delete past the intended blocks; use the exact case-name markers above to find boundaries).

**Note:** the `newFuvar`/`updateFuvar` cases shown here are from BEFORE Task 6 modified them — by the time you reach this task, those two cases already contain Task 6's push-notification additions. Only delete the blocks shown above; leave `newFuvar`/`updateFuvar` exactly as Task 6 left them.

- [ ] **Step 7: Remove the now-dead OCR-matching methods from `FuvarInterface`**

Delete these entire methods (in the order they currently appear): `egyeztetOcrAlapjan()`, `potkocsiIdKamionhoz()`, `getEgyeztetesJavaslatDokumentumhoz()`, `letrehozDokumentumbol()`, `csatolDokumentumot()`, `normalizaltRendszam()`, `keresRendszamAlapjan()`, `normalizalNev()`, `keresSoforNevAlapjan()`, `keresMegbizoNevAlapjan()`. Confirm each is unused elsewhere first:

```bash
grep -n "egyeztetOcrAlapjan\|potkocsiIdKamionhoz\|getEgyeztetesJavaslatDokumentumhoz\|letrehozDokumentumbol\|csatolDokumentumot\|normalizaltRendszam\|keresRendszamAlapjan\|normalizalNev\|keresSoforNevAlapjan\|keresMegbizoNevAlapjan" backend/interface/fuvarInterface.php
```
Every remaining hit after your deletion should be exactly one (the method's own declaration line) — if any name still appears twice, something still calls it; stop and investigate before deleting further.

- [ ] **Step 8: Remove the `visszaallitForrasDokumentumot()` call + method from `deleteFuvar()`**

Find in `deleteFuvar()`:
```php
    public function deleteFuvar($id, $ceg_id) {
        $this->visszaallitForrasDokumentumot($id, $ceg_id);

        $stmt = $this->db->prepare("UPDATE fuvarok SET torolt = 'I' WHERE id = :id AND admin = :admin");
```
Replace with:
```php
    public function deleteFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare("UPDATE fuvarok SET torolt = 'I' WHERE id = :id AND admin = :admin");
```
Then delete the entire `visszaallitForrasDokumentumot()` private method (the one that reparents `beerkezett_dokumentumok`/`fajlok` rows — no longer reachable, since no fuvar will ever again be created from a document).

- [ ] **Step 9: Remove `FuvarDokumentumLink.js` usage's backing data need** — no backend action left for it (handled fully in Task 13, frontend side; this step is just a note, no action here).

- [ ] **Step 10: Lint**

```bash
php8.2 -l backend/ApiHandler.php
php8.2 -l backend/interface/fuvarInterface.php
```

- [ ] **Step 11: Grep-verify no dangling references remain**

```bash
grep -rn "beerkezettDokumentumInterface\|BeerkezettDokumentumInterface\|GeminiOcrClient\|elemezBeerkezettDokumentum\|getFuvarEgyeztetesJavaslat\|letrehozFuvarDokumentumbol\|csatolBeerkezettDokumentumotFuvarhoz" backend/
```
Expected: no output.

- [ ] **Step 12: Live-verify the server still boots and unrelated fuvar actions still work**

```bash
php8.2 -S localhost:8001 > /tmp/php_server.log 2>&1 &
sleep 1
AUTH="nIrINP&o!PU|+pM*Q8'j1R07U57W,qD"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{\"authHash\":\"$AUTH\",\"action\":\"loginUser\",\"email\":\"sziago12@gmail.com\",\"password\":\"wrong-password-on-purpose\"}"
echo
cat /tmp/php_server.log
```
Expected: a normal `{"success":false,...}` login response (proves `ApiHandler`/`api.php` still parse and execute without a fatal error from the removed `require`/`global` references), and no PHP fatal errors in the log.

- [ ] **Step 13: Commit**

```bash
git add -A backend/
git commit -m "$(cat <<'EOF'
refactor: retire the OCR-based Beérkezett Dokumentumok backend module

Deletes BeerkezettDokumentumInterface and GeminiOcrClient entirely,
removes every related API action (elemez/get/update/torol* + the
document->fuvar entity-matching actions added earlier this project),
and drops the now-unreachable OCR-matching methods from
FuvarInterface. The beerkezett_dokumentumok DB table is left in place,
unused — same precedent as the earlier fuvarok/Fuvartervező retirement.
EOF
)"
```

---

### Task 8: Sofőr frontend — BottomNav FAB swap + new routes wiring

**Files:**
- Modify: `src/components/UI/BottomNav.js`
- Modify: `src/layouts/User.js`
- Delete: `src/views/user/DokumentumFeltoltes.js` (content moves into Task 10's `FuvarReszletek.js`)

**Interfaces:**
- Produces: routes `/user/fuvarok` and `/user/fuvarReszletek` registered (pointing at files created in Task 9/10) — Task 9/10 must exist before this compiles cleanly; if executed independently, create placeholder files first and let Task 9/10 fill them in.

- [ ] **Step 1: Update `BottomNav.js`**

Find:
```jsx
import {
  PiSquaresFourLight,
  PiSquaresFourFill,
  PiMapPinLight,
  PiMapPinFill,
  PiWarningCircleLight,
  PiWarningCircleFill,
  PiUserLight,
  PiUserFill,
} from "react-icons/pi";
```
Replace with:
```jsx
import {
  PiSquaresFourLight,
  PiSquaresFourFill,
  PiMapPinLight,
  PiMapPinFill,
  PiClipboardTextLight,
  PiClipboardTextFill,
  PiUserLight,
  PiUserFill,
} from "react-icons/pi";
```

Find the comment + `items` array:
```jsx
// Sofőr-oldali alsó navigáció (csak mobilon, md-től a desktop felső
// navigáció veszi át a szerepét) — a Bejelentés középen kiemelt, piros
// FAB-ként (ez az egyetlen művelet, amit vezetés közbeni vészhelyzetben
// egy kézzel, gondolkodás nélkül kell elérni). A jármű-kiválasztás,
// dokumentumok, tankolás és értesítések szándékosan nincsenek itt —
// azok a Kezdőlap gyorsműveletein keresztül érhetők el, hogy a sáv ne
// zsúfolódjon túl (ld. a sofőr UX terv 01. pontját). A Helyszínek viszont
// elég gyakran kellő eligazodási segédlet ahhoz, hogy önálló, mindig
// elérhető sávelem legyen, ne csak a Kezdőlap gyorsműveletei közt.
const items = [
  { to: "/user/dashboard", label: "Kezdőlap", icon: PiSquaresFourLight, activeIcon: PiSquaresFourFill },
  { to: "/user/helyszinek", label: "Helyszínek", icon: PiMapPinLight, activeIcon: PiMapPinFill },
  { to: "/user/bejelentes/uj", label: "Bejelentés", icon: PiWarningCircleLight, activeIcon: PiWarningCircleFill, fab: true },
  { to: "/user/profil", label: "Profil", icon: PiUserLight, activeIcon: PiUserFill },
];
```
Replace with:
```jsx
// Sofőr-oldali alsó navigáció (csak mobilon, md-től a desktop felső
// navigáció veszi át a szerepét). 2026-07-28: a középső FAB Bejelentésről
// Fuvarokra váltott (ld. docs/superpowers/specs/2026-07-28-fuvar-first-
// workflow-design.md 6.1, explicit felhasználói döntés) — a Fuvar-first
// munkafolyamatban ez lett a naponta legtöbbször használt, egy kézzel
// elérendő művelet. A Bejelentés emiatt elvesztette az "egy érintésre,
// bárhonnan" tulajdonságát (ld. a spec 10. pontjának nyitott kockázata) —
// továbbra is elérhető a Dashboard kis összegző során és a
// /user/bejelentesek oldalon, csak nem a BottomNav-on.
const items = [
  { to: "/user/dashboard", label: "Kezdőlap", icon: PiSquaresFourLight, activeIcon: PiSquaresFourFill },
  { to: "/user/helyszinek", label: "Helyszínek", icon: PiMapPinLight, activeIcon: PiMapPinFill },
  { to: "/user/fuvarok", label: "Fuvarok", icon: PiClipboardTextLight, activeIcon: PiClipboardTextFill, fab: true },
  { to: "/user/profil", label: "Profil", icon: PiUserLight, activeIcon: PiUserFill },
];
```

- [ ] **Step 2: Update `layouts/User.js` — remove the old route/import, add the two new ones**

Find:
```jsx
const DokumentumFeltoltes = React.lazy(() => import("views/user/DokumentumFeltoltes.js"));
```
Replace with:
```jsx
const Fuvarok = React.lazy(() => import("views/user/Fuvarok.js"));
const FuvarReszletek = React.lazy(() => import("views/user/FuvarReszletek.js"));
```

Find:
```jsx
            <PrivateRoute
              path="/user/dokumentum-feltoltes"
              exact
              component={DokumentumFeltoltes}
            />
```
Replace with:
```jsx
            <PrivateRoute path="/user/fuvarok" exact component={Fuvarok} />
            <PrivateRoute
              path="/user/fuvarReszletek"
              exact
              component={FuvarReszletek}
            />
```

Find `desktopLinks`:
```jsx
const desktopLinks = [
  { to: "/user/dashboard", label: "Kezdőlap" },
  { to: "/user/bejelentesek", label: "Bejelentéseim" },
  { to: "/user/helyszinek", label: "Helyszínek" },
  { to: "/user/tankolas", label: "Tankolás" },
  { to: "/user/profil", label: "Profil" },
];
```
Replace with:
```jsx
const desktopLinks = [
  { to: "/user/dashboard", label: "Kezdőlap" },
  { to: "/user/fuvarok", label: "Fuvarjaim" },
  { to: "/user/bejelentesek", label: "Bejelentéseim" },
  { to: "/user/helyszinek", label: "Helyszínek" },
  { to: "/user/tankolas", label: "Tankolás" },
  { to: "/user/profil", label: "Profil" },
];
```

- [ ] **Step 3: Delete the old upload page**

```bash
rm src/views/user/DokumentumFeltoltes.js
```

- [ ] **Step 4: Create placeholder files so the app compiles** (Task 9/10 will fill these in with real content — this step only exists so this task is independently testable; skip it if Task 9/10 run in the same session immediately after)

```bash
cat > src/views/user/Fuvarok.js <<'EOF'
import React from "react";
export default function Fuvarok() {
  return <div>Fuvarok — placeholder (Task 9 fills this in)</div>;
}
EOF
cat > src/views/user/FuvarReszletek.js <<'EOF'
import React from "react";
export default function FuvarReszletek() {
  return <div>Fuvar Részletek — placeholder (Task 10 fills this in)</div>;
}
EOF
```

- [ ] **Step 5: Verify the app compiles and the bottom nav/routes render**

```bash
npm start
```
(reuse the already-running dev server if there is one — CRA prints "Something is already running on port 3000" in that case, which is fine).

Using a browser (Playwright or manual), navigate to `http://localhost:3000/user/dashboard` with a valid sofőr `localStorage` session set (`user` + `sessionToken` keys), confirm:
- The BottomNav's center FAB is now truck-icon-labeled "Fuvarok" and navigates to `/user/fuvarok` (shows the placeholder text).
- `/user/fuvarReszletek` also loads the placeholder without a routing error.
- The old `/user/dokumentum-feltoltes` URL no longer resolves to a real page (falls through to the `<Redirect from="/user" ...>` catch-all or 404s within the SPA, not a hard crash).

- [ ] **Step 6: Commit**

```bash
git add src/components/UI/BottomNav.js src/layouts/User.js
git add src/views/user/Fuvarok.js src/views/user/FuvarReszletek.js
git rm src/views/user/DokumentumFeltoltes.js
git commit -m "$(cat <<'EOF'
feat: swap sofőr BottomNav FAB from Bejelentés to Fuvarok, wire new routes

Adds /user/fuvarok and /user/fuvarReszletek routes (placeholder
content, filled in by the next two tasks) and removes the retired
/user/dokumentum-feltoltes route + its page.
EOF
)"
```

---

### Task 9: `src/views/user/Fuvarok.js` — sofőr fuvar list

**Files:**
- Modify: `src/views/user/Fuvarok.js` (replace the Task 8 placeholder)

**Interfaces:**
- Consumes: `getSajatFuvarok` action (Task 4).
- Produces: nothing new consumed by later tasks except that `Dashboard.js` (Task 11) links here.

- [ ] **Step 1: Write the full component**

```jsx
import React, { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { PiClipboardTextLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";

function FuvarSor({ fuvar, onOpen }) {
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam || "—";
  return (
    <button
      type="button"
      onClick={() => onOpen(fuvar)}
      className="flex w-full flex-col gap-1 rounded-2xl border border-ink-100 bg-white p-3.5 text-left shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">
          {fuvar.felrako || "—"} → {fuvar.lerako || "—"}
        </p>
        {fuvar.dokumentum_feltoltve ? (
          <StatusBadge tone="success">Dokumentum ✓</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Menetlevél hiányzik</StatusBadge>
        )}
      </div>
      <p className="text-xs text-ink-400">
        {fuvar.teljesites_datuma || "Nincs dátum"} · {jarmu}
        {fuvar.megbizo_nev ? ` · ${fuvar.megbizo_nev}` : ""}
      </p>
    </button>
  );
}

export default function Fuvarok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [ful, setFul] = useState("aktiv"); // "aktiv" | "lezart"
  const [fuvarok, setFuvarok] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAction("getSajatFuvarok", {
      sofor_id: user.id,
      aktivOnly: ful === "aktiv",
    });
    setFuvarok(result?.success ? result.fuvarok || [] : []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ful]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = (fuvar) => {
    history.push("/user/fuvarReszletek", { data: fuvar });
  };

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Fuvarjaim" back={false} />

      <div className="flex gap-2 rounded-full bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setFul("aktiv")}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            ful === "aktiv" ? "bg-white text-brand-700 shadow-soft" : "text-ink-500"
          }`}
        >
          Aktívak
        </button>
        <button
          type="button"
          onClick={() => setFul("lezart")}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            ful === "lezart" ? "bg-white text-brand-700 shadow-soft" : "text-ink-500"
          }`}
        >
          Lezártak
        </button>
      </div>

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : fuvarok.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiClipboardTextLight className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-400">
            {ful === "aktiv" ? "Nincs aktív fuvarod." : "Nincs lezárt fuvarod."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fuvarok.map((f) => (
            <FuvarSor key={f.id} fuvar={f} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in a browser**

With the CRA dev server running and a sofőr `localStorage` session set, navigate to `/user/fuvarok`. Confirm both tabs load without error, the empty state renders if the test sofőr has no fuvarok yet, and — using the same `INSERT INTO fuvarok (...)` pattern from Task 4/5's live verification — insert one active and one closed (`allapot='teljesitve'`) test fuvar for this sofőr directly in the DB, reload, and confirm each appears in the correct tab with the correct badge. Clean up the inserted rows afterward.

- [ ] **Step 3: Commit**

```bash
git add src/views/user/Fuvarok.js
git commit -m "feat: build sofőr Fuvarok list (aktívak/lezártak tabs)"
```

---

### Task 10: `src/views/user/FuvarReszletek.js` — fuvar detail + photo upload

**Files:**
- Modify: `src/views/user/FuvarReszletek.js` (replace the Task 8 placeholder)

**Interfaces:**
- Consumes: `getSajatFuvar` (Task 4), `feltoltFuvarDokumentumot`/`torolSajatFuvarDokumentumot`/`getSajatFuvarDokumentumai` (Task 5), `fileToBase64` (existing util), `confirmDialog` (existing util).

- [ ] **Step 1: Write the full component**

```jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { PiCameraLight, PiFilePdfLight, PiTrashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import MobileHeader from "components/UI/MobileHeader.js";
import Spinner from "components/UI/Spinner.js";

// A push-értesítésből érkező kattintás egy sima URL-t nyit meg (a service
// worker-nek nincs React Router state-je, amit átadhatna), ezért ez az
// oldal MINDKÉT belépési utat kezeli: `location.state?.data` a lista felől
// navigálva (gyors, nincs extra lekérdezés), `?id=` query paraméter a
// push-deep-linkből érkezve (ekkor frissen lekérdezzük getSajatFuvar()-ral).
function useQueryParam(name) {
  const location = useLocation();
  return new URLSearchParams(location.search).get(name);
}

function DokumentumFotoSor({ fajl, onDeleted }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const [torles, setTorles] = useState(false);
  const isKep = fajl.fajl_kategoria === "kep";
  const rowRef = useRef(null);

  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = rowRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        fetchAction("downloadFile", { id: fajl.sorszam })
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
  }, [isKep, fajl.sorszam]);

  const handleDelete = async () => {
    const ok = await confirmDialog(`Biztosan törlöd a(z) "${fajl.filename}" fotót?`, { confirmLabel: "Törlés" });
    if (!ok) return;
    setTorles(true);
    const result = await fetchAction("torolSajatFuvarDokumentumot", { fajlId: fajl.sorszam });
    if (result?.success) {
      onDeleted(fajl.sorszam);
    } else {
      toast.error(result?.message || "A törlés sikertelen.");
      setTorles(false);
    }
  };

  return (
    <div ref={rowRef} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-2.5">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={fajl.filename} className="h-full w-full object-cover" />
        ) : (
          <PiFilePdfLight className="h-6 w-6 text-ink-400" />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-xs text-ink-600">{fajl.filename}</p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={torles}
        aria-label="Fotó törlése"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <PiTrashLight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FeltoltoSzekcio({ cim, tipus, kotelezo, fajlok, onUploaded, onDeleted }) {
  const [uploading, setUploading] = useState(false);
  const sajatFajlok = fajlok.filter((f) => f.cimkek === tipus);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        // eslint-disable-next-line no-await-in-loop
        const result = await fetchAction("feltoltFuvarDokumentumot", {
          fuvarId: onUploaded.fuvarId,
          tipus,
          file: base64,
          name: file.name,
          size: file.size,
        });
        if (!result?.success) {
          toast.error(result?.message || `${file.name}: a feltöltés sikertelen.`);
        }
      }
      toast.success("Feltöltve.");
      onUploaded.reload();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{cim}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            kotelezo ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-ink-400"
          }`}
        >
          {kotelezo ? "Kötelező" : "Opcionális"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sajatFajlok.map((f) => (
          <DokumentumFotoSor key={f.sorszam} fajl={f} onDeleted={onDeleted} />
        ))}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white py-4 text-center">
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <PiCameraLight className="h-5 w-5 text-brand-600" />
          )}
          <span className="text-sm font-semibold text-ink-700">
            {uploading ? "Feltöltés…" : "Fotó hozzáadása"}
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  );
}

export default function FuvarReszletek() {
  const location = useLocation();
  const history = useHistory();
  const idParam = useQueryParam("id");

  const [fuvar, setFuvar] = useState(location.state?.data || null);
  const [fajlok, setFajlok] = useState([]);
  const [loading, setLoading] = useState(!location.state?.data);

  const user = JSON.parse(localStorage.getItem("user"));

  const loadFuvar = useCallback(async () => {
    if (location.state?.data) return;
    if (!idParam) {
      history.push("/user/fuvarok");
      return;
    }
    setLoading(true);
    const result = await fetchAction("getSajatFuvar", { sofor_id: user.id, id: idParam });
    if (result?.success) {
      setFuvar(result.fuvar);
    } else {
      toast.error(result?.message || "A fuvar nem található.");
      history.push("/user/fuvarok");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  useEffect(() => {
    loadFuvar();
  }, [loadFuvar]);

  const loadFajlok = useCallback(async () => {
    if (!fuvar?.id) return;
    const result = await fetchAction("getSajatFuvarDokumentumai", { fuvarId: fuvar.id });
    if (result?.success) setFajlok(result.files || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuvar?.id]);

  useEffect(() => {
    loadFajlok();
  }, [loadFajlok]);

  if (loading || !fuvar) {
    return <Spinner wrapperClassName="flex justify-center py-24" />;
  }

  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam || "—";

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Fuvar" />

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <p className="font-display text-base font-bold text-brand-900">
          {fuvar.felrako || "—"} → {fuvar.lerako || "—"}
        </p>
        <dl className="mt-2 space-y-1 text-sm text-ink-600">
          <div>
            <dt className="inline font-semibold text-ink-400">Dátum: </dt>
            <dd className="inline">{fuvar.teljesites_datuma || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-ink-400">Jármű: </dt>
            <dd className="inline">{jarmu}</dd>
          </div>
          {fuvar.megbizo_nev && (
            <div>
              <dt className="inline font-semibold text-ink-400">Megbízó: </dt>
              <dd className="inline">{fuvar.megbizo_nev}</dd>
            </div>
          )}
          {fuvar.aru_megnevezese && (
            <div>
              <dt className="inline font-semibold text-ink-400">Áru: </dt>
              <dd className="inline">{fuvar.aru_megnevezese}</dd>
            </div>
          )}
          {fuvar.megjegyzes && (
            <div>
              <dt className="inline font-semibold text-ink-400">Megjegyzés: </dt>
              <dd className="inline">{fuvar.megjegyzes}</dd>
            </div>
          )}
        </dl>
      </div>

      <FeltoltoSzekcio
        cim="Menetlevél"
        tipus="menetlevel"
        kotelezo
        fajlok={fajlok}
        onUploaded={{ fuvarId: fuvar.id, reload: loadFajlok }}
        onDeleted={loadFajlok}
      />
      <FeltoltoSzekcio
        cim="Szállítólevél"
        tipus="szallitolevel"
        kotelezo={false}
        fajlok={fajlok}
        onUploaded={{ fuvarId: fuvar.id, reload: loadFajlok }}
        onDeleted={loadFajlok}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify in a browser**

With a sofőr session in `localStorage` and a real fuvar assigned to that driver (insert one via the DB if none exists), navigate to `/user/fuvarok`, open it, and:
- Confirm the read-only summary shows the expected fields, and none of fuvardíj/egyéb költség/számlaszám/állapot appear anywhere in the rendered page (`grep`-check the page's rendered text, or just visually confirm).
- Upload a real image file to "Menetlevél" — confirm it appears in the thumbnail row, and re-querying `getSajatFuvar` (or reloading `/user/fuvarok`) shows the fuvar has moved to the "Lezártak" tab.
- Upload nothing to "Szállítólevél" — confirm no error, section still renders with just the upload control.
- Delete the uploaded menetlevél photo — confirm it disappears from the row, but the fuvar **stays** in "Lezártak" (per the spec's explicit "delete doesn't reopen" decision).
- Also open this same page via `/user/fuvarReszletek?id=<fuvarId>` directly (simulating a push-notification deep link, no `location.state`) and confirm it still loads correctly via the `getSajatFuvar` fallback path.

- [ ] **Step 3: Commit**

```bash
git add src/views/user/FuvarReszletek.js
git commit -m "feat: build sofőr Fuvar Részletek page with menetlevél/szállítólevél upload"
```

---

### Task 11: `Dashboard.js` — replace Dokumentum card with Aktív fuvarjaim

**Files:**
- Modify: `src/views/user/Dashboard.js`

**Interfaces:**
- Consumes: `getSajatFuvarok` (Task 4).

- [ ] **Step 1: Remove the OCR-document-related imports/state/fetch**

Find:
```jsx
import {
  PiBellLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiWarningCircleLight,
  PiGasPumpLight,
  PiPhoneLight,
  PiCaretRightLight,
  PiMapPinLight,
  PiCameraLight,
  PiFilePdfLight,
} from "react-icons/pi";
```
Replace with:
```jsx
import {
  PiBellLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiWarningCircleLight,
  PiGasPumpLight,
  PiPhoneLight,
  PiCaretRightLight,
  PiMapPinLight,
  PiClipboardTextLight,
} from "react-icons/pi";
```

Delete the entire `DokumentumMiniElonezet` function (no longer used) and its comment.

Find, inside `UserDashboard()`:
```jsx
  const [legutobbiDokumentumok, setLegutobbiDokumentumok] = useState([]);
```
Replace with:
```jsx
  const [aktivFuvarok, setAktivFuvarok] = useState([]);
```

Find, inside the `Promise.all([...])` call:
```jsx
      const [
        freshRes,
        kamionRes,
        potkocsiRes,
        furgonRes,
        bejelentesRes,
        adminRes,
        kerelemRes,
        elbiraltRes,
        dokumentumRes,
      ] = await Promise.all([
        fetchAction("getSajatSofor", { id: userData.id }),
        fetchAction("getKamionok", { id: userData.admin }),
        fetchAction("getPotkocsik", { id: userData.admin }),
        fetchAction("getFurgonok", { id: userData.admin }),
        fetchAction("getBejelentesekSofor", { sofor_id: userData.id }),
        fetchAction("getAdminElerhetoseg", { id: userData.admin }),
        fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
        fetchAction("getElbiraltJarmuValtasok", { sofor_id: userData.id }),
        fetchAction("getSajatBeerkezettDokumentumok", { sofor_id: userData.id, limit: 3 }),
      ]);
```
Replace with:
```jsx
      const [
        freshRes,
        kamionRes,
        potkocsiRes,
        furgonRes,
        bejelentesRes,
        adminRes,
        kerelemRes,
        elbiraltRes,
        fuvarRes,
      ] = await Promise.all([
        fetchAction("getSajatSofor", { id: userData.id }),
        fetchAction("getKamionok", { id: userData.admin }),
        fetchAction("getPotkocsik", { id: userData.admin }),
        fetchAction("getFurgonok", { id: userData.admin }),
        fetchAction("getBejelentesekSofor", { sofor_id: userData.id }),
        fetchAction("getAdminElerhetoseg", { id: userData.admin }),
        fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
        fetchAction("getElbiraltJarmuValtasok", { sofor_id: userData.id }),
        fetchAction("getSajatFuvarok", { sofor_id: userData.id, aktivOnly: true }),
      ]);
```

Find:
```jsx
      if (dokumentumRes?.success) setLegutobbiDokumentumok(dokumentumRes.dokumentumok || []);
```
Replace with:
```jsx
      if (fuvarRes?.success) setAktivFuvarok(fuvarRes.fuvarok || []);
```

- [ ] **Step 2: Replace the "Dokumentum feltöltése" card with "Aktív fuvarjaim"**

Find the whole block:
```jsx
      {/* Dokumentum feltöltése — kiemelt, mert ez a leggyakrabban használt
          napi művelet lesz (minden lezárt fuvarnál). Csak a fájl típusát/
          feldolgozási státuszát mutatja, az OCR-eredményt nem — ld.
          DokumentumFeltoltes.js fejléc-kommentje. */}
      <Link
        to="/user/dokumentum-feltoltes"
        className="rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-soft"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
              <PiCameraLight className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-brand-900">
                Dokumentum feltöltése
              </p>
              <p className="text-xs text-brand-700">
                Fuvarlevél vagy szállítólevél lefotózása
              </p>
            </div>
          </div>
          <PiCaretRightLight className="h-5 w-5 flex-shrink-0 text-brand-500" />
        </div>
        {legutobbiDokumentumok.length > 0 && (
          <div className="mt-3 flex gap-2 border-t border-brand-100 pt-3">
            {legutobbiDokumentumok.map((d) => (
              <span
                key={d.id}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
              >
                {d.fajl_kategoria === "kep" ? (
                  <DokumentumMiniElonezet fajlId={d.fajl_id} filename={d.filename} />
                ) : (
                  <PiFilePdfLight className="h-5 w-5 text-ink-400" />
                )}
              </span>
            ))}
          </div>
        )}
      </Link>
```
Replace with:
```jsx
      {/* Aktív fuvarjaim — a Fuvar-first munkafolyamat elsődleges napi
          művelete (ld. docs/superpowers/specs/2026-07-28-fuvar-first-
          workflow-design.md 6.2), a korábbi "Dokumentum feltöltése" kártya
          helyén és vizuális súlyával. */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-base font-bold text-brand-900">Aktív fuvarjaim</p>
          <PiClipboardTextLight className="h-5 w-5 text-brand-500" />
        </div>
        {aktivFuvarok.length === 0 ? (
          <p className="text-sm text-brand-700">Nincs aktív fuvarod.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {aktivFuvarok.slice(0, 3).map((f) => (
              <Link
                key={f.id}
                to="/user/fuvarReszletek"
                onClick={(e) => {
                  // history.push state-tel gyorsabb, mint egy plain <Link>
                  // (nincs extra getSajatFuvar lekérdezés) — ezért kézzel
                  // navigálunk ahelyett, hogy a Link natív navigációjára
                  // hagyatkoznánk.
                  e.preventDefault();
                  history.push("/user/fuvarReszletek", { data: f });
                }}
                className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-ink-800">
                  {f.felrako || "—"} → {f.lerako || "—"}
                </span>
                <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
              </Link>
            ))}
            {aktivFuvarok.length > 3 && (
              <Link
                to="/user/fuvarok"
                className="text-center text-xs font-semibold text-brand-700"
              >
                Összes fuvarod ({aktivFuvarok.length})
              </Link>
            )}
          </div>
        )}
      </div>
```

- [ ] **Step 2: Verify `history` is available in this component** — `Dashboard.js` already declares `const history = useHistory();` at the top (used for the redirect-to-login effect), so no new import is needed.

- [ ] **Step 3: Verify in a browser**

Navigate to `/user/dashboard` as a sofőr with at least one active fuvar assigned (insert a test row if needed): confirm "Aktív fuvarjaim" renders in the old Document-card's position/style, tapping a row opens `FuvarReszletek` with the right data pre-loaded (no extra network call — check the Network tab, no `getSajatFuvar` call should fire), and the empty state shows correctly when the sofőr has none. Confirm "Legutóbbi bejelentéseim" at the bottom is completely unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/views/user/Dashboard.js
git commit -m "feat: replace Dashboard's Dokumentum card with Aktív fuvarjaim"
```

---

### Task 12: `Profil.js` — mount push subscription UI

**Files:**
- Modify: `src/views/user/Profil.js`

**Interfaces:**
- Consumes: `PushFeliratkozas` component (already exists, unmodified — works via Task 3's backend generalization).

- [ ] **Step 1: Add the import and render call**

Find:
```jsx
import WebAuthnRegisztracio from "components/UI/WebAuthnRegisztracio.js";
```
Replace with:
```jsx
import WebAuthnRegisztracio from "components/UI/WebAuthnRegisztracio.js";
import PushFeliratkozas from "components/UI/PushFeliratkozas.js";
```

Find:
```jsx
      <WebAuthnRegisztracio />

      <button
```
Replace with:
```jsx
      <WebAuthnRegisztracio />

      <PushFeliratkozas />

      <button
```

- [ ] **Step 2: Verify in a browser**

Navigate to `/user/profil` as a sofőr. Confirm the "Push-értesítések" card renders (same component/copy already seen on the admin `Settings.js` page) and clicking "Bekapcsolás" (in a Chromium-based browser with notification permission grantable) actually completes a real subscription round-trip — check via the Network tab that `getPushStatusz`/`savePushFeliratkozas` calls succeed, and confirm a corresponding row appears in `push_feliratkozasok` with `felhasznalo_tipus='sofor'`:
```bash
php8.2 -r '
$db = new PDO("mysql:host=localhost;dbname=kamion;charset=utf8mb4", "kamion", "VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ");
print_r($db->query("SELECT felhasznalo_tipus, felhasznalo_id, endpoint FROM push_feliratkozasok WHERE felhasznalo_tipus=\"sofor\"")->fetchAll(PDO::FETCH_ASSOC));
'
```
Then click "Kikapcsolás" and confirm the row disappears.

- [ ] **Step 3: Commit**

```bash
git add src/views/user/Profil.js
git commit -m "feat: mount push subscription toggle on sofőr Profil page"
```

---

### Task 13: Retire the OCR-based frontend files and their nav entries

**Files:**
- Delete: `src/views/admin/BeerkezettDokumentumok.js`
- Delete: `src/components/Fuvarok/DokumentumReviewPanel.js`
- Delete: `src/components/Fuvarok/DokumentumKartya.js`
- Delete: `src/components/Fuvarok/FuvarDokumentumLink.js`
- Modify: `src/layouts/Admin.js`
- Modify: `src/components/Sidebar/Sidebar.js`
- Modify: `src/views/admin/FuvarForm.js`

**Interfaces:**
- Removes: `/admin/beerkezettDokumentumok` route, all its nav entries, `FuvarForm.js`'s document-first prefill logic.

- [ ] **Step 1: Delete the four files**

```bash
rm src/views/admin/BeerkezettDokumentumok.js
rm src/components/Fuvarok/DokumentumReviewPanel.js
rm src/components/Fuvarok/DokumentumKartya.js
rm src/components/Fuvarok/FuvarDokumentumLink.js
```

- [ ] **Step 2: `src/layouts/Admin.js` — remove the lazy import and route**

Find:
```jsx
const BeerkezettDokumentumok = lazy(() =>
  import("views/admin/BeerkezettDokumentumok.js"),
);
```
Delete it entirely.

Find:
```jsx
            <PrivateRoute
              path="/admin/beerkezettDokumentumok"
              exact
              component={BeerkezettDokumentumok}
            />
            <PrivateRoute path="/admin/fuvarok" exact component={Fuvarok} />
```
Replace with (keep the `fuvarok` route, delete only the `beerkezettDokumentumok` one):
```jsx
            <PrivateRoute path="/admin/fuvarok" exact component={Fuvarok} />
```

- [ ] **Step 3: `src/components/Sidebar/Sidebar.js` — remove all three nav sources**

First (mobile/desktop-shared groups config), find:
```jsx
    items: [
      {
        to: "/admin/beerkezettDokumentumok",
        icon: PiFileTextLight,
        text: "Beérkezett dokumentumok",
      },
      { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
      { to: "/admin/fuvarStatisztika", icon: PiChartBarLight, text: "Statisztikák" },
    ],
```
Replace with:
```jsx
    items: [
      { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
      { to: "/admin/fuvarStatisztika", icon: PiChartBarLight, text: "Statisztikák" },
    ],
```

Second, delete the badge-fetching effect block:
```jsx
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
```

Third, find:
```jsx
  const badgeByPath = {
    "/admin/bejelentesek": nyitottBejelentesek.length,
    "/admin/beerkezettDokumentumok": beerkezettDokSzam,
  };
```
Replace with:
```jsx
  const badgeByPath = {
    "/admin/bejelentesek": nyitottBejelentesek.length,
  };
```

Fourth (the hardcoded desktop `<NavItem>` JSX — a separately-maintained third nav source, per this codebase's own documented drift risk), find:
```jsx
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
```
Replace with:
```jsx
                <NavItem
                  to="/admin/fuvarok"
                  icon={PiClipboardTextLight}
                  text="Fuvarok"
                />
```

- [ ] **Step 4: Check whether `PiFileTextLight` is still used elsewhere in `Sidebar.js`**

```bash
grep -n "PiFileTextLight" src/components/Sidebar/Sidebar.js
```
If the only remaining hit is in the `import {...} from "react-icons/pi"` line itself, remove `PiFileTextLight` from that import list too (unused-import cleanliness). If it's still used elsewhere (e.g. by the "Fájlok" nav entry), leave the import alone.

- [ ] **Step 5: `src/views/admin/FuvarForm.js` — remove document-first prefill logic**

Find:
```jsx
import FuvarDokumentumLink from "components/Fuvarok/FuvarDokumentumLink.js";
```
Delete this import line entirely.

Find the whole `ocrAdatokToForm` function and its preceding comment:
```jsx
// Az OCR-mezőnevek (ld. GeminiOcrClient.php) és a fuvarok tábla mezőnevei
// nagyrészt egyeznek (felrako/lerako/aru_megnevezese/fuvarlevel_szam/
// tavolsag_km) — csak a "datum" -> "teljesites_datuma", "egyeb_megjegyzes"
// -> "megjegyzes" és "tomeg_kg" -> "tomeg_kg" (azonos név) nevek térnek el/
// egyeznek. A sofor_id/kamion_id/furgon_id/megbizo_id ID-egyeztetést
// a szerver (letrehozFuvarDokumentumbol -> FuvarInterface::letrehozDokumentumbol)
// már elvégezte a dokumentum mentésekor — ez a segédfüggvény csak a
// BeerkezettDokumentumok.js oldalról átadott nyers, szöveges ocrAdatok
// mezőket teszi be induló (előnézeti) értéknek, ID-egyeztetés nélkül.
function ocrAdatokToForm(ocrAdatok) {
  if (!ocrAdatok) return {};
  return {
    teljesites_datuma: ocrAdatok.datum || "",
    felrako: ocrAdatok.felrako || "",
    lerako: ocrAdatok.lerako || "",
    tavolsag_km: ocrAdatok.tavolsag_km || "",
    tomeg_kg: ocrAdatok.tomeg_kg || "",
    aru_megnevezese: ocrAdatok.aru_megnevezese || "",
    megjegyzes: ocrAdatok.egyeb_megjegyzes || "",
    fuvarlevel_szam: ocrAdatok.fuvarlevel_szam || "",
  };
}
```
Delete this entire block.

Find:
```jsx
  const dokumentumId = location.state?.dokumentumId || null;
  const initialData = location.state?.data || ocrAdatokToForm(location.state?.ocrAdatok);
  const isNew = !initialData?.id;
```
Replace with:
```jsx
  const initialData = location.state?.data || {};
  const isNew = !initialData?.id;
```

Delete the entire OCR-prefill `useEffect` (the one that calls `getFuvarEgyeztetesJavaslat`), i.e. this whole block including its leading comment:
```jsx
  // Ha dokumentumból nyílt a form, az OCR által felismert rendszám/sofőr-
  // név/megbízó-név alapján a szerver (ugyanazzal az egyeztetéssel, amit
  // `letrehozFuvarDokumentumbol` eddig is csak MENTÉSKOR futtatott le, ld.
  // `FuvarInterface::egyeztetOcrAlapjan()`) megpróbálja beazonosítani a
  // Sofőr/Jármű/Pótkocsi/Megbízó mezőket is — ezek eddig üresen jelentek
  // meg a form megnyitásakor, holott mentéskor úgyis kitöltődtek volna.
  // Csak azokat a mezőket töltjük ki, amik még üresek (`prev.x ||`), hogy
  // ne írjunk felül egy már betöltött/szerkesztett értéket.
  useEffect(() => {
    if (!dokumentumId) return;
    let elvetve = false;
    fetchAction("getFuvarEgyeztetesJavaslat", { ceg_id: user.ceg_id, dokumentumId }).then((result) => {
      if (elvetve || !result?.success) return;
      const javaslat = result.javaslat || {};
      setFormData((prev) => ({
        ...prev,
        sofor_id: prev.sofor_id || javaslat.sofor_id || "",
        kamion_id: prev.kamion_id || javaslat.kamion_id || "",
        furgon_id: prev.furgon_id || javaslat.furgon_id || "",
        potkocsi_id: prev.potkocsi_id || javaslat.potkocsi_id || "",
        megbizo_id: prev.megbizo_id || javaslat.megbizo_id || "",
      }));
      if (javaslat.megbizo_id) {
        fetchAction("getUgyfelFuvarElozmeny", { ceg_id: user.ceg_id, ugyfelId: javaslat.megbizo_id }).then((r) => {
          if (!elvetve && r?.success) setUgyfelElozmeny(r.fuvarok || []);
        });
      }
    });
    return () => {
      elvetve = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Find, in `handleSave`:
```jsx
      let result;
      if (dokumentumId) {
        result = await fetchAction("letrehozFuvarDokumentumbol", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          dokumentumId,
          felulirasok: nelkulUresFkMezok(formData),
        });
      } else {
        const action = formData.id ? "updateFuvar" : "newFuvar";
        result = await fetchAction(action, {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          ...nelkulUresFkMezok(formData),
        });
      }
```
Replace with:
```jsx
      const action = formData.id ? "updateFuvar" : "newFuvar";
      const result = await fetchAction(action, {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        ...nelkulUresFkMezok(formData),
      });
```

Find:
```jsx
      <FuvarDokumentumLink beerkezettDokumentumId={formData.beerkezett_dokumentum_id} />

```
Delete this line (and the blank line after it, if present).

- [ ] **Step 6: Grep-verify no dangling references remain**

```bash
grep -rln "BeerkezettDokumentumok\|DokumentumReviewPanel\|DokumentumKartya\|FuvarDokumentumLink\|getFuvarEgyeztetesJavaslat\|letrehozFuvarDokumentumbol\|elemezBeerkezettDokumentum\|getBeerkezettDokumentumokSzama\|getSajatBeerkezettDokumentumok\|torolSajatBeerkezettDokumentum" src/
```
Expected: no output.

- [ ] **Step 7: Verify in a browser**

Start CRA (`npm start`), confirm it compiles with no import errors. As admin, load `/admin/dashboard` (Sidebar renders without the removed nav item), `/admin/fuvarok` (no "N dokumentum feldolgozásra vár" button/badge — see Task 14, which removes that from `Fuvarok.js` itself), open `/admin/fuvarForm` for a new fuvar and confirm the form still saves correctly via `newFuvar`.

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "$(cat <<'EOF'
refactor: retire OCR-based frontend module and FuvarForm's doc-first prefill

Deletes BeerkezettDokumentumok.js, DokumentumReviewPanel.js,
DokumentumKartya.js, FuvarDokumentumLink.js and every nav entry
pointing at the retired /admin/beerkezettDokumentumok route
(desktop Sidebar JSX, mobile groups config, and the badge-fetch
effect — three separately-maintained nav sources). FuvarForm.js goes
back to a plain manual "Új fuvar" form.
EOF
)"
```

---

### Task 14: Admin-side cleanup — remove stale OCR references, add "Dokumentum ✓" badge

**Files:**
- Modify: `src/views/admin/Fuvarok.js`
- Modify: `src/components/Table/CardTableForFuvarok.js`

**Interfaces:**
- Consumes: `fuvarok.dokumentum_feltoltve` (already present in `getFuvarok()`'s `SELECT *`, Task 1).

- [ ] **Step 1: `Fuvarok.js` — remove the dead "N dokumentum feldolgozásra vár" button**

Find:
```jsx
  const [dokSzam, setDokSzam] = useState(0);
```
Delete this line.

Find:
```jsx
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getBeerkezettDokumentumokSzama", { ceg_id: user.ceg_id }).then((result) => {
      if (result?.success) setDokSzam(result.szam);
    });
  }, []);

```
Delete this entire effect.

Find:
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
Replace with:
```jsx
      <PageHeader eyebrow="Fuvarok" title="Fuvarok" />
```

If `history` is now unused elsewhere in this file, check before removing the `useHistory()` call:
```bash
grep -n "history\." src/views/admin/Fuvarok.js
```
(It is still used by `onFuvarClick={(fuvar) => history.push("/admin/fuvarForm", { data: fuvar })}` in the Kanban branch — keep the `useHistory()` import/call.)

- [ ] **Step 2: `CardTableForFuvarok.js` — add a "Dokumentum" column**

Find:
```jsx
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusChangePopover from "components/UI/StatusChangePopover.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
```
Replace with:
```jsx
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusChangePopover from "components/UI/StatusChangePopover.js";
import StatusBadge from "components/UI/StatusBadge.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
```

Find:
```jsx
    {
      key: "szamlaszam",
      label: "Számlaszám",
      render: (row) => row.szamlaszam || "—",
      mobileHidden: true,
    },
    {
      key: "actions",
```
Replace with:
```jsx
    {
      key: "szamlaszam",
      label: "Számlaszám",
      render: (row) => row.szamlaszam || "—",
      mobileHidden: true,
    },
    {
      key: "dokumentum_feltoltve",
      label: "Dokumentum",
      render: (row) =>
        row.dokumentum_feltoltve ? (
          <StatusBadge tone="success">Feltöltve</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Hiányzik</StatusBadge>
        ),
      mobileHidden: true,
    },
    {
      key: "actions",
```

- [ ] **Step 3: Grep-verify `dokSzam`/`getBeerkezettDokumentumokSzama` are fully gone from `Fuvarok.js`**

```bash
grep -n "dokSzam\|getBeerkezettDokumentumokSzama" src/views/admin/Fuvarok.js
```
Expected: no output.

- [ ] **Step 4: Verify in a browser**

As admin, load `/admin/fuvarok`. Confirm the removed button is gone, and a new "Dokumentum" column shows "Feltöltve"/"Hiányzik" per row, matching whatever `dokumentum_feltoltve` state you left test fuvarok in from earlier tasks' live verifications (or insert one fresh test fuvar with `dokumentum_feltoltve` set via direct SQL to confirm the "Feltöltve" badge specifically renders).

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/Fuvarok.js src/components/Table/CardTableForFuvarok.js
git commit -m "$(cat <<'EOF'
feat: add Dokumentum badge to admin Fuvarok list, drop dead OCR-inbox button

The "N dokumentum feldolgozásra vár" button pointed at the now-deleted
/admin/beerkezettDokumentumok route. The new "Dokumentum" column
surfaces dokumentum_feltoltve so admins can see at a glance which
fuvarok are still missing a menetlevél photo.
EOF
)"
```

---

### Task 15: Full end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Static sanity pass**

```bash
php8.2 -l backend/ApiHandler.php
php8.2 -l backend/interface/fuvarInterface.php
php8.2 -l backend/interface/pushInterface.php
grep -rn "beerkezett_dokumentumok\|BeerkezettDokumentum\|GeminiOcrClient" backend/ --include="*.php" | grep -v "^backend/sql/"
```
The last grep should show **zero** PHP hits outside `backend/sql/` (the DB table itself is intentionally untouched and its name may still appear in old numbered migration files — that's expected and fine).

- [ ] **Step 2: Full-flow Playwright walkthrough**

With both dev servers running (`npm start`, `php8.2 -S localhost:8001`), drive this sequence (via Playwright, using `localStorage` session injection for both roles as documented in CLAUDE.md's "Local dev environment" section):

1. As admin: create a new fuvar via `/admin/fuvarForm`, assigning a real sofőr and jármű.
2. Insert a fake `push_feliratkozasok` row for that sofőr directly via SQL (real push delivery to a browser isn't practical in this harness) and confirm — by tailing the PHP error log around the `newFuvar` call — that `sendPushSofornak()` attempted a send.
3. As that sofőr: load `/user/dashboard`, confirm the new fuvar appears under "Aktív fuvarjaim".
4. Open it, confirm `/user/fuvarok` also lists it under "Aktívak".
5. Upload a real image as "Menetlevél".
6. Reload `/user/dashboard` and `/user/fuvarok` — confirm the fuvar is now GONE from "Aktívak"/"Aktív fuvarjaim" and appears under "Lezártak".
7. As admin: reload `/admin/fuvarok`, confirm the "Dokumentum" column shows "Feltöltve" for this fuvar.
8. As admin: change the fuvar's `allapot` to `teljesitve` via the Kanban or status popover on a DIFFERENT test fuvar (one with no uploaded document) — confirm that one also disappears from the sofőr's "Aktívak" tab, proving the two independent closing paths both work.
9. Clean up all test rows created during this walkthrough (fuvarok, fajlok, push_feliratkozasok, sessions).

- [ ] **Step 3: Update CLAUDE.md**

Per this project's own convention ("CLAUDE.md karbantartása minden nagyobb módosítás után"), add a new dated section summarizing: the fuvar-first reversal, the `dokumentum_feltoltve` column and its independence from `allapot`, the push generalization, the sofőr-side new pages, and the full retirement of the OCR module (superseding the "Fuvar-dokumentum OCR + Fuvar modul" and "Fuvar létrehozása — Sofőr/Jármű/Pótkocsi/Megbízó előzetes kitöltése" sections — mark them as historical/superseded rather than deleting them outright, matching this file's existing pattern of layering dated summaries).

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for the fuvar-first workflow reversal"
```

## Self-Review Notes

- **Spec coverage:** §3 (scope) → Tasks 1-14 cover every "elkészül" bullet; the "NEM készül el" bullets (no allapot automation, no reminder/admin-push extras, no multi-driver, no duplication) are correctly absent from every task. §4 (data model) → Task 1 (columns), Task 4 (no new file table, reuses `fajlok`+`cimkek`). §5 (backend API) → Tasks 2-7. §6 (sofőr frontend) → Tasks 8-12. §7 (admin frontend) → Tasks 13-14. §8 (extra ideas) → explicitly NOT built (correctly out of scope, only mentioned as future ideas in the spec itself). §9 (test plan) → every task has a live-verification step; Task 15 is the full walkthrough. §10 (risks) → both documented inline (Task 8's BottomNav comment, Task 15 doesn't need to re-litigate them).
- **Placeholder scan:** no TBD/TODO markers; every code block is complete, copy-pasteable content, not a description of what to write.
- **Type consistency:** `getSajatFuvarok`/`getSajatFuvar` signatures match between Task 4 (PHP definition) and Tasks 9/10/11 (JS call sites — `sofor_id`, `id`, `aktivOnly` param names match exactly). `feltoltFuvarDokumentumot`/`torolSajatFuvarDokumentumot`/`getSajatFuvarDokumentumai` param names (`fuvarId`, `tipus`, `file`, `name`, `size`, `fajlId`) match between Task 5 (PHP `getActions()`+case) and Task 10 (JS call sites). `sendPushSofornak($sofor_id, $cim, $szoveg, $url=null)` signature matches between Task 2 (definition) and Task 6 (call sites).
