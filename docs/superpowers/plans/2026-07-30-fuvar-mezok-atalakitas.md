# Fuvar mezőátalakítás Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Átalakítani a Fuvar modul mezőit a design specnek megfelelően: felrakás/lerakás dátum a teljesítés dátuma helyett, raklapszám a fuvarlevél szám helyett, tömeg tonnában, egyetlen összesített díj mező, strukturált (cég+cím) felrakó/lerakó a fuvaron ÉS a megbízónál, automatikus ajánlással és visszamentéssel, plusz a sofőr-oldali fuvar-kártya bővítése (távolság/raklapszám/megbízó cím/tömeg/felrakó-lerakó cég+cím/dátumok) egy Google Maps útvonaltervező gombbal.

**Architecture:** Egy sorozatos DB-migráció (`backend/sql/44.sql`, root MySQL felhasználóval) mögé backend (`FuvarInterface`/`UgyfelInterface`/`ApiHandler`/`KeresesInterface`) és frontend (admin `FuvarForm`/`CardTableForFuvarok`/`CardUgyfel`/Kanban/Sofőr-nézet, sofőr `Fuvarok`/`FuvarReszletek`) módosítások mennek, a meglévő no-JOIN/no-UNION, cross-tenant `ervenyesEntitasE` és sofőr-ownership mintákat megtartva.

**Tech Stack:** PHP 8.2 (PDO/MySQL, nincs framework, nincs composer), React (CRA, Tailwind, react-router-dom v5), MariaDB/MySQL (MyISAM→InnoDB, soft delete `torolt`).

## Global Constraints

- Nincs automatizált teszt-keret (sem PHPUnit, sem Jest teszt a repóban) — minden backend-változtatást a helyi PHP built-in szerveren keresztül, valódi `curl` API-hívással és `mysql` CLI-vel kell élőben ellenőrizni (nem elég a kódot átolvasni), a CLAUDE.md "Szerver oldali módosítások kritikus tesztelése" szabálya szerint.
- `backend/sql/44.sql`-t a helyi dev MySQL-en **root felhasználóval** kell futtatni (`mysql -u root kamion < backend/sql/44.sql`) — az app saját DB-usere nem jogosult `ALTER TABLE`-re (ld. CLAUDE.md "Fejlesztési audit" `29.sql` óta érvényes korlátozás).
- Minden hand-written SQL-lekérdezésnek tartalmaznia kell `torolt <> 'I'`-t (soft delete), és tilos `JOIN`/`UNION` (a projekt saját SQL-lintere elutasítja).
- Minden cross-tenant írásnak/olvasásnak a hívó `ceg_id`-jére kell szűkülnie (`ervenyesEntitasE`/`WHERE admin = :ceg_id` minta).
- A helyi dev PHP szerver portja **8001** (nem 8000 — ld. CLAUDE.md dev port mismatch), a frontend `npm start` (port 3000, valószínűleg már fut, Fast Refresh-sel felveszi a változásokat).
- A helyi dev auth hash (`backend/config.php`): `nIrINP&o!PU|+pM*Q8'j1R07U57W,qD` — minden curl-teszt POST body-jában `authHash` mezőként kell szerepeltetni.
- Helyi dev DB-ben létező tesztadat a curl-teszthez: `admin.id = 1` (root, `tulajdonos_admin_id IS NULL`, tehát `ceg_id = 1`), `ugyfelek.id = 1` ("Teszt Ugyfel Kft. 2") és `ugyfelek.id = 8` ("Teszt").
- Tailwind: ha bármelyik lépés ÚJ utility-osztályt vezet be (jelen tervben nem valószínű, csak meglévő mintákat ismétlünk), `npm run build:tailwind`-et kell futtatni ellenőrzés előtt.

---

## Task 1: `fuvarok`/`ugyfelek` séma-migráció (backend/sql/44.sql)

**Files:**
- Create: `backend/sql/44.sql`

**Interfaces:**
- Produces: a `fuvarok` tábla új oszlopai (`felrakas_datuma`, `lerakas_datuma`, `felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`, `tomeg_tonna`, `raklapszam`, `dij`) és az `ugyfelek` tábla új oszlopai (`felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`) — minden további task ezekre az oszlopnevekre épít.

- [ ] **Step 1: Írd meg a migrációs fájlt**

```sql
-- Fuvar mezők átalakítása (docs/superpowers/specs/2026-07-30-fuvar-
-- mezok-atalakitas-design.md): teljesítés dátuma helyett felrakás+
-- lerakás dátum, fuvarlevél szám helyett raklapszám, tömeg tonnában,
-- egyetlen összesített díj, strukturált (cég+cím) felrakó/lerakó a
-- fuvaron ÉS a megbízónál. Root MySQL felhasználóval futtatandó (ld.
-- 29.sql óta az app saját usere nem jogosult ALTER TABLE-re).

-- 1. Teljesítés dátuma -> Lerakás dátuma (adat megmarad), + új Felrakás
--    dátuma oszlop, közvetlenül a Lerakás dátuma elé pozicionálva.
ALTER TABLE fuvarok CHANGE COLUMN teljesites_datuma lerakas_datuma DATE NULL;
ALTER TABLE fuvarok ADD COLUMN felrakas_datuma DATE NULL AFTER potkocsi_id;

-- 2. Felrakó/lerakó: szabad szöveg -> cég + cím. A régi szöveg a "cég"
--    mezőbe kerül át (ez volt az egyetlen adat, ami korábban is ott
--    állt), majd a régi oszlopok törlődnek.
ALTER TABLE fuvarok ADD COLUMN felrako_ceg VARCHAR(250) NULL AFTER felrako;
ALTER TABLE fuvarok ADD COLUMN felrako_cim VARCHAR(250) NULL AFTER felrako_ceg;
ALTER TABLE fuvarok ADD COLUMN lerako_ceg VARCHAR(250) NULL AFTER lerako;
ALTER TABLE fuvarok ADD COLUMN lerako_cim VARCHAR(250) NULL AFTER lerako_ceg;
UPDATE fuvarok SET felrako_ceg = felrako WHERE felrako IS NOT NULL;
UPDATE fuvarok SET lerako_ceg = lerako WHERE lerako IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN felrako;
ALTER TABLE fuvarok DROP COLUMN lerako;

-- 3. Tömeg kg -> tonna (érték átszámolva, nem csak átnevezve).
ALTER TABLE fuvarok ADD COLUMN tomeg_tonna DECIMAL(6,2) NULL AFTER tavolsag_km;
UPDATE fuvarok SET tomeg_tonna = tomeg_kg / 1000 WHERE tomeg_kg IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN tomeg_kg;

-- 4. Fuvarlevél szám (szöveg) -> Raklapszám (egész szám). Fogalmilag
--    más adat, nincs érdemi konverzió — a régi oszlop törlődik.
ALTER TABLE fuvarok ADD COLUMN raklapszam INT NULL AFTER fuvarlevel_szam;
ALTER TABLE fuvarok DROP COLUMN fuvarlevel_szam;

-- 5. Fuvardíj + Egyéb költség -> egyetlen összesített Díj.
ALTER TABLE fuvarok ADD COLUMN dij DECIMAL(10,2) NULL AFTER egyeb_koltseg;
UPDATE fuvarok SET dij = COALESCE(fuvardij, 0) + COALESCE(egyeb_koltseg, 0)
    WHERE fuvardij IS NOT NULL OR egyeb_koltseg IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN fuvardij;
ALTER TABLE fuvarok DROP COLUMN egyeb_koltseg;

-- 6. Megbízó (ugyfelek) alapértelmezett felrakó/lerakó helyszíne —
--    egy-egy érték megbízónként, nem lista. Az automatikus ajánlás/
--    visszamentés logikája (FuvarInterface) ezekre épül.
ALTER TABLE ugyfelek ADD COLUMN felrako_ceg VARCHAR(250) NULL;
ALTER TABLE ugyfelek ADD COLUMN felrako_cim VARCHAR(250) NULL;
ALTER TABLE ugyfelek ADD COLUMN lerako_ceg VARCHAR(250) NULL;
ALTER TABLE ugyfelek ADD COLUMN lerako_cim VARCHAR(250) NULL;
```

- [ ] **Step 2: Futtasd le root MySQL felhasználóval**

Run: `cd /home/psadmin/szikoratransz/szikoratransz && mysql -u root kamion < backend/sql/44.sql`
Expected: nincs hibaüzenet (ha "Unknown column 'teljesites_datuma'" vagy hasonló jönne, az azt jelentené, hogy a fájl kétszer lett lefuttatva — ellenőrizd `SHOW COLUMNS`-szal, mielőtt újra futtatnád).

- [ ] **Step 3: Ellenőrizd a séma tényleges állapotát**

Run: `mysql -u root kamion -e "SHOW COLUMNS FROM fuvarok;" && mysql -u root kamion -e "SHOW COLUMNS FROM ugyfelek;"`
Expected: a `fuvarok` oszlopok között szerepel `felrakas_datuma`, `lerakas_datuma`, `felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`, `tomeg_tonna`, `raklapszam`, `dij`; NEM szerepel `teljesites_datuma`, `felrako`, `lerako`, `tomeg_kg`, `fuvarlevel_szam`, `fuvardij`, `egyeb_koltseg`. Az `ugyfelek` oszlopok között szerepel a 4 új mező.

- [ ] **Step 4: Ellenőrizd az adat-migrációt (ha volt korábbi teszt-sor)**

Run: `mysql -u root kamion -e "SELECT id, lerakas_datuma, felrako_ceg, lerako_ceg, tomeg_tonna, dij FROM fuvarok WHERE torolt <> 'I' LIMIT 5;"`
Expected: ha voltak korábbi sorok, `lerakas_datuma` a régi `teljesites_datuma` értékét mutatja, `felrako_ceg`/`lerako_ceg` a régi szöveges `felrako`/`lerako` értékét, `dij` a régi `fuvardij+egyeb_koltseg` összegét. Ha nem volt korábbi sor (üres tábla), ez a lépés triviálisan átmegy (0 sor).

- [ ] **Step 5: Commit**

```bash
git add backend/sql/44.sql
git commit -m "$(cat <<'EOF'
feat(db): restructure fuvarok/ugyfelek schema for pickup/dropoff fields

Splits teljesítés dátuma into felrakás+lerakás dátum, replaces
fuvarlevél szám with raklapszám, converts tömeg to tonna, merges
fuvardíj+egyéb költség into a single díj column, and structures
felrakó/lerakó as cég+cím on both fuvarok and ugyfelek.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `FuvarInterface.php` — mezőnevek, megbízó-enrichment, auto-ajánlás/visszamentés

**Files:**
- Modify: `backend/interface/fuvarInterface.php` (teljes fájl, minden metódus érintett)

**Interfaces:**
- Consumes: Task 1 új oszlopnevei.
- Produces: `FuvarInterface::newFuvar($data, $ceg_id)`, `updateFuvar($data, $ceg_id)`, `getFuvar($id, $ceg_id)`, `getFuvarok(...)`, `getUgyfelElozmeny($ugyfelId, $ceg_id, $limit)`, `getSajatFuvarok($sofor_id, $ceg_id, $aktivOnly)`, `getSajatFuvar($id, $sofor_id, $ceg_id)` — mind az új mezőneveket (`felrakas_datuma`, `lerakas_datuma`, `felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`, `tomeg_tonna`, `raklapszam`, `dij`) fogadják/adják vissza, plusz minden fuvar-sor bővül `megbizo_cim`/`megbizo_irsz`/`megbizo_varos` mezőkkel. Új privát metódus: `frissitsMegbizoFelrakoLerako($megbizoId, $data, $ceg_id)`.

- [ ] **Step 1: Cseréld le a `RENDEZHETO_OSZLOPOK` konstanst (12-21. sor)**

```php
    const RENDEZHETO_OSZLOPOK = [
        'lerakas_datuma' => 'lerakas_datuma',
        'felrakas_datuma' => 'felrakas_datuma',
        'felrako' => 'felrako_ceg',
        'lerako' => 'lerako_ceg',
        'dij' => 'dij',
        'allapot' => 'allapot',
    ];
```

- [ ] **Step 2: Cseréld le `newFuvar()`-t (62-79. sor)**

```php
    public function newFuvar($data, $ceg_id) {
        $hiba = $this->idegenKulcsokErvenyesitese($data, $ceg_id);
        if ($hiba !== null) {
            return ['success' => false, 'message' => $hiba];
        }
        try {
            $query = "INSERT INTO fuvarok (admin, sofor_id, kamion_id, furgon_id, potkocsi_id, felrakas_datuma, lerakas_datuma, felrako_ceg, felrako_cim, lerako_ceg, lerako_cim, tavolsag_km, tomeg_tonna, megbizo_id, aru_megnevezese, megjegyzes, dij, raklapszam, beerkezett_dokumentum_id, allapot)
                      VALUES (:admin, :sofor_id, :kamion_id, :furgon_id, :potkocsi_id, :felrakas_datuma, :lerakas_datuma, :felrako_ceg, :felrako_cim, :lerako_ceg, :lerako_cim, :tavolsag_km, :tomeg_tonna, :megbizo_id, :aru_megnevezese, :megjegyzes, :dij, :raklapszam, :beerkezett_dokumentum_id, :allapot)";
            $stmt = $this->db->prepare($query);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            $ujId = $this->db->lastInsertId();
            if (!empty($data['megbizo_id'])) {
                $this->frissitsMegbizoFelrakoLerako($data['megbizo_id'], $data, $ceg_id);
            }
            return ['success' => true, 'message' => 'Fuvar rögzítve.', 'fuvar' => $this->getFuvar($ujId, $ceg_id)['fuvar']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
```

- [ ] **Step 3: Cseréld le `updateFuvar()`-t (81-104. sor)**

```php
    public function updateFuvar($data, $ceg_id) {
        $hiba = $this->idegenKulcsokErvenyesitese($data, $ceg_id);
        if ($hiba !== null) {
            return ['success' => false, 'message' => $hiba];
        }
        try {
            $query = "UPDATE fuvarok SET
                        sofor_id = :sofor_id, kamion_id = :kamion_id, furgon_id = :furgon_id, potkocsi_id = :potkocsi_id,
                        felrakas_datuma = :felrakas_datuma, lerakas_datuma = :lerakas_datuma,
                        felrako_ceg = :felrako_ceg, felrako_cim = :felrako_cim, lerako_ceg = :lerako_ceg, lerako_cim = :lerako_cim,
                        tavolsag_km = :tavolsag_km, tomeg_tonna = :tomeg_tonna,
                        megbizo_id = :megbizo_id, aru_megnevezese = :aru_megnevezese, megjegyzes = :megjegyzes,
                        dij = :dij, raklapszam = :raklapszam,
                        beerkezett_dokumentum_id = :beerkezett_dokumentum_id, allapot = :allapot
                      WHERE id = :id AND admin = :admin";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            if (!empty($data['megbizo_id'])) {
                $this->frissitsMegbizoFelrakoLerako($data['megbizo_id'], $data, $ceg_id);
            }
            return ['success' => true, 'message' => 'Fuvar frissítve.', 'fuvar' => $this->getFuvar($data['id'], $ceg_id)['fuvar']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
```

- [ ] **Step 4: Cseréld le `bindFuvarMezok()`-ot (106-125. sor)**

```php
    private function bindFuvarMezok($stmt, $data, $ceg_id) {
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $data['sofor_id'] ?? null);
        $stmt->bindValue(':kamion_id', $data['kamion_id'] ?? null);
        $stmt->bindValue(':furgon_id', $data['furgon_id'] ?? null);
        $stmt->bindValue(':potkocsi_id', $data['potkocsi_id'] ?? null);
        $stmt->bindValue(':felrakas_datuma', $data['felrakas_datuma'] ?? null);
        $stmt->bindValue(':lerakas_datuma', $data['lerakas_datuma'] ?? null);
        $stmt->bindValue(':felrako_ceg', $data['felrako_ceg'] ?? null);
        $stmt->bindValue(':felrako_cim', $data['felrako_cim'] ?? null);
        $stmt->bindValue(':lerako_ceg', $data['lerako_ceg'] ?? null);
        $stmt->bindValue(':lerako_cim', $data['lerako_cim'] ?? null);
        $stmt->bindValue(':tavolsag_km', empty($data['tavolsag_km']) ? null : (int) $data['tavolsag_km'], empty($data['tavolsag_km']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':tomeg_tonna', empty($data['tomeg_tonna']) ? null : (float) $data['tomeg_tonna']);
        $stmt->bindValue(':megbizo_id', $data['megbizo_id'] ?? null);
        $stmt->bindValue(':aru_megnevezese', $data['aru_megnevezese'] ?? null);
        $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
        $stmt->bindValue(':dij', $data['dij'] === '' || $data['dij'] === null ? null : (float) $data['dij']);
        $stmt->bindValue(':raklapszam', empty($data['raklapszam']) ? null : (int) $data['raklapszam'], empty($data['raklapszam']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':beerkezett_dokumentum_id', empty($data['beerkezett_dokumentum_id']) ? null : (int) $data['beerkezett_dokumentum_id'], empty($data['beerkezett_dokumentum_id']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':allapot', $data['allapot'] ?? 'rogzitett');
    }

    // Ha a fuvaron megadott felrakó/lerakó adat van, de a kiválasztott
    // megbízónál még NINCS elmentve (mezőnként külön nézve), automatikusan
    // visszaírjuk az ugyfelek táblába — csak akkor, ha ott jelenleg NULL/
    // üres. Sosem írja felül a megbízónál már meglévő értéket (ld. design
    // spec "Automatikus ajánlás + visszamentés"). newFuvar()/updateFuvar()
    // saját sikeres ágán hívva, csendben (nincs UI-visszajelzés hozzá).
    private function frissitsMegbizoFelrakoLerako($megbizoId, $data, $ceg_id) {
        $mezok = ['felrako_ceg', 'felrako_cim', 'lerako_ceg', 'lerako_cim'];
        $ujErtekek = [];
        foreach ($mezok as $mezo) {
            if (!empty($data[$mezo])) {
                $ujErtekek[$mezo] = $data[$mezo];
            }
        }
        if (empty($ujErtekek)) {
            return;
        }

        $stmt = $this->db->prepare(
            "SELECT felrako_ceg, felrako_cim, lerako_ceg, lerako_cim FROM ugyfelek WHERE id = :id AND admin = :ceg_id"
        );
        $stmt->bindValue(':id', $megbizoId, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $megbizo = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($megbizo === false) {
            return;
        }

        $frissitendo = [];
        foreach ($ujErtekek as $mezo => $ertek) {
            if (empty($megbizo[$mezo])) {
                $frissitendo[$mezo] = $ertek;
            }
        }
        if (empty($frissitendo)) {
            return;
        }

        $setResz = implode(', ', array_map(fn($mezo) => "$mezo = :$mezo", array_keys($frissitendo)));
        $update = $this->db->prepare("UPDATE ugyfelek SET $setResz WHERE id = :id AND admin = :ceg_id");
        foreach ($frissitendo as $mezo => $ertek) {
            $update->bindValue(":$mezo", $ertek);
        }
        $update->bindValue(':id', $megbizoId, PDO::PARAM_INT);
        $update->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $update->execute();
    }
```

- [ ] **Step 5: Cseréld le `getFuvar()`-t (204-218. sor) — a számolt `osszesen` megszűnik, mert `dij` már maga az összeg**

```php
    public function getFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT * FROM fuvarok WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvar = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($fuvar === false) {
            return ['success' => false, 'fuvar' => null];
        }
        return ['success' => true, 'fuvar' => $this->dusitEgySort($fuvar, $ceg_id)];
    }
```

- [ ] **Step 6: Cseréld le `getFuvarok()`-ot (220-283. sor)**

```php
    public function getFuvarok($ceg_id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc', $allapot = null, $datumTol = null, $datumIg = null) {
        $params = [':admin' => $ceg_id];
        $query = "SELECT * FROM fuvarok WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($allapot)) {
            $query .= " AND allapot = :allapot";
            $params[':allapot'] = $allapot;
        }
        // `$datumTol`/`$datumIg` — a Sofőr szerinti nézet heti navigációjához
        // (ld. Fuvarok.js/SoforCsoportositottLista.js): az a nézet a
        // lapozás megkerülésével (page=null) kéri le EGY adott hét összes
        // fuvarját, nem a táblázat-nézet oldalankénti szeletét. A lerakás
        // dátuma az elsődleges dátum (ld. design spec).
        if (!empty($datumTol)) {
            $query .= " AND lerakas_datuma >= :datumTol";
            $params[':datumTol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $query .= " AND lerakas_datuma <= :datumIg";
            $params[':datumIg'] = $datumIg;
        }
        if (!empty($search)) {
            // A saját mezők (felrakó/lerakó cég+cím/áru/raklapszám) LIKE-
            // egyezése mellett a kapcsolódó entitások (sofőr/kamion/
            // furgon/megbízó) nevét/rendszámát KÜLÖN lekérdezéssel
            // egyeztetjük a keresőszóval, és a talált id-ket egy IN(...)
            // feltételként fűzzük a fuvarok WHERE-jéhez — így nem kell
            // JOIN a keresés kiterjesztéséhez sem.
            $entitasFeltetelek = [];
            foreach ([
                ['sofor_id', 'user', 'name'],
                ['kamion_id', 'kamion', 'rendszam'],
                ['furgon_id', 'furgon', 'rendszam'],
                ['megbizo_id', 'ugyfelek', 'nev'],
            ] as [$oszlop, $tabla, $mezo]) {
                $talalt = $this->keresIdkNevAlapjan($tabla, $mezo, $ceg_id, $search);
                if (!empty($talalt)) {
                    $entitasFeltetelek[] = "$oszlop IN (" . implode(',', $talalt) . ')';
                }
            }

            $sajatMezoFeltetel = "(felrako_ceg LIKE :search OR felrako_cim LIKE :search OR lerako_ceg LIKE :search OR lerako_cim LIKE :search OR aru_megnevezese LIKE :search OR raklapszam LIKE :search)";
            $params[':search'] = '%' . $search . '%';

            $query .= " AND (" . implode(' OR ', array_merge([$sajatMezoFeltetel], $entitasFeltetelek)) . ")";
        }

        $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'lerakas_datuma';
        $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
        $query .= " ORDER BY $rendezoOszlop $irany";

        if ($page !== null) {
            [$fuvarok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            return ['success' => true, 'fuvarok' => $this->dusitSorokat($fuvarok, $ceg_id), 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
        }

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $this->dusitSorokat($stmt->fetchAll(PDO::FETCH_ASSOC), $ceg_id)];
    }
```

- [ ] **Step 7: Cseréld le `dusitEgySort()`-ot (301-308. sor) — bővül megbízó cím-mezőkkel**

```php
    private function dusitEgySort($fuvar, $ceg_id) {
        $fuvar['sofor_nev'] = $this->egyMezoLekerdezese('user', 'name', $fuvar['sofor_id'], $ceg_id);
        $fuvar['kamion_rendszam'] = $this->egyMezoLekerdezese('kamion', 'rendszam', $fuvar['kamion_id'], $ceg_id);
        $fuvar['furgon_rendszam'] = $this->egyMezoLekerdezese('furgon', 'rendszam', $fuvar['furgon_id'], $ceg_id);
        $fuvar['potkocsi_rendszam'] = $this->egyMezoLekerdezese('potkocsi', 'rendszam', $fuvar['potkocsi_id'], $ceg_id);
        $fuvar['megbizo_nev'] = $this->egyMezoLekerdezese('ugyfelek', 'nev', $fuvar['megbizo_id'], $ceg_id);
        $fuvar['megbizo_cim'] = $this->egyMezoLekerdezese('ugyfelek', 'cim', $fuvar['megbizo_id'], $ceg_id);
        $fuvar['megbizo_irsz'] = $this->egyMezoLekerdezese('ugyfelek', 'irsz', $fuvar['megbizo_id'], $ceg_id);
        $fuvar['megbizo_varos'] = $this->egyMezoLekerdezese('ugyfelek', 'varos', $fuvar['megbizo_id'], $ceg_id);
        return $fuvar;
    }
```

- [ ] **Step 8: Cseréld le `dusitSorokat()`-ot (326-345. sor) — ugyanaz a bővítés, batch-elve**

```php
    private function dusitSorokat($fuvarok, $ceg_id) {
        if (empty($fuvarok)) {
            return $fuvarok;
        }
        $soforNevek = $this->batchLekerdezes('user', 'name', array_column($fuvarok, 'sofor_id'), $ceg_id);
        $kamionRendszamok = $this->batchLekerdezes('kamion', 'rendszam', array_column($fuvarok, 'kamion_id'), $ceg_id);
        $furgonRendszamok = $this->batchLekerdezes('furgon', 'rendszam', array_column($fuvarok, 'furgon_id'), $ceg_id);
        $potkocsiRendszamok = $this->batchLekerdezes('potkocsi', 'rendszam', array_column($fuvarok, 'potkocsi_id'), $ceg_id);
        $megbizoNevek = $this->batchLekerdezes('ugyfelek', 'nev', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoCimek = $this->batchLekerdezes('ugyfelek', 'cim', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoIrszek = $this->batchLekerdezes('ugyfelek', 'irsz', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoVarosok = $this->batchLekerdezes('ugyfelek', 'varos', array_column($fuvarok, 'megbizo_id'), $ceg_id);

        foreach ($fuvarok as &$fuvar) {
            $fuvar['sofor_nev'] = $soforNevek[$fuvar['sofor_id']] ?? null;
            $fuvar['kamion_rendszam'] = $kamionRendszamok[$fuvar['kamion_id']] ?? null;
            $fuvar['furgon_rendszam'] = $furgonRendszamok[$fuvar['furgon_id']] ?? null;
            $fuvar['potkocsi_rendszam'] = $potkocsiRendszamok[$fuvar['potkocsi_id']] ?? null;
            $fuvar['megbizo_nev'] = $megbizoNevek[$fuvar['megbizo_id']] ?? null;
            $fuvar['megbizo_cim'] = $megbizoCimek[$fuvar['megbizo_id']] ?? null;
            $fuvar['megbizo_irsz'] = $megbizoIrszek[$fuvar['megbizo_id']] ?? null;
            $fuvar['megbizo_varos'] = $megbizoVarosok[$fuvar['megbizo_id']] ?? null;
        }
        unset($fuvar);
        return $fuvarok;
    }
```

- [ ] **Step 9: Cseréld le `getUgyfelElozmeny()`-t (391-403. sor)**

```php
    public function getUgyfelElozmeny($ugyfelId, $ceg_id, $limit = 5) {
        $stmt = $this->db->prepare(
            "SELECT lerakas_datuma, felrako_ceg, lerako_ceg, dij
             FROM fuvarok
             WHERE megbizo_id = :megbizo_id AND admin = :admin AND torolt <> 'I'
             ORDER BY lerakas_datuma DESC, letrehozva DESC
             LIMIT " . (int) $limit
        );
        $stmt->bindValue(':megbizo_id', $ugyfelId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }
```

- [ ] **Step 10: Cseréld le `getSajatFuvarok()`-ot (411-427. sor)**

```php
    public function getSajatFuvarok($sofor_id, $ceg_id, $aktivOnly = true) {
        $lezarasFeltetel = $aktivOnly
            ? "AND dokumentum_feltoltve IS NULL AND allapot <> 'teljesitve'"
            : "AND (dokumentum_feltoltve IS NOT NULL OR allapot = 'teljesitve')";
        $stmt = $this->db->prepare(
            "SELECT id, kamion_id, furgon_id, potkocsi_id, felrakas_datuma, lerakas_datuma,
                    felrako_ceg, felrako_cim, lerako_ceg, lerako_cim,
                    tavolsag_km, tomeg_tonna, raklapszam, megbizo_id, aru_megnevezese, megjegyzes, allapot,
                    dokumentum_feltoltve
             FROM fuvarok
             WHERE sofor_id = :sofor_id AND admin = :ceg_id AND torolt <> 'I' $lezarasFeltetel
             ORDER BY lerakas_datuma DESC, letrehozva DESC"
        );
        $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $this->dusitSorokat($stmt->fetchAll(PDO::FETCH_ASSOC), $ceg_id)];
    }
```

- [ ] **Step 11: Cseréld le `getSajatFuvar()`-t (433-450. sor)**

```php
    public function getSajatFuvar($id, $sofor_id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, kamion_id, furgon_id, potkocsi_id, felrakas_datuma, lerakas_datuma,
                    felrako_ceg, felrako_cim, lerako_ceg, lerako_cim,
                    tavolsag_km, tomeg_tonna, raklapszam, megbizo_id, aru_megnevezese, megjegyzes, allapot,
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
```

- [ ] **Step 12: `getStatisztikak()` (476. sortól) — cseréld le a kezdő SELECT-et és az `osszesen` számítást**

Az eredeti (477-487. sor):
```php
        $stmt = $this->db->prepare(
            "SELECT id, sofor_id, kamion_id, furgon_id, teljesites_datuma, tavolsag_km,
                    megbizo_id, fuvardij, egyeb_koltseg, allapot
             FROM fuvarok WHERE admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fuvarok as &$f) {
            $f['osszesen'] = (float) $f['fuvardij'] + (float) ($f['egyeb_koltseg'] ?? 0);
        }
        unset($f);
```
cserélendő erre:
```php
        $stmt = $this->db->prepare(
            "SELECT id, sofor_id, kamion_id, furgon_id, lerakas_datuma, tavolsag_km,
                    megbizo_id, dij, allapot
             FROM fuvarok WHERE admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fuvarok as &$f) {
            $f['osszesen'] = (float) ($f['dij'] ?? 0);
        }
        unset($f);
```
Ezután a metódus TÖBBI részében (a "lejartE" closure-től a hónap-bontásig, kb. 497-649. sor) minden `$f['teljesites_datuma']`-hivatkozást cserélj `$f['lerakas_datuma']`-ra — az output mezőnevek (`honap`, `bevetelOsszesen`, stb.) NEM változnak, csak a forrás-oszlop. Konkrétan az alábbi 6 sorban:
- `if (empty($f['teljesites_datuma']) || empty($f['megbizo_id'])) {` → `if (empty($f['lerakas_datuma']) || empty($f['megbizo_id'])) {`
- `$hatarido = date('Y-m-d', strtotime($f['teljesites_datuma'] . " +{$napok} days"));` → `$f['lerakas_datuma']`
- `if (empty($f['teljesites_datuma'])) {` (a havi bontásnál) → `if (empty($f['lerakas_datuma'])) {`
- `$ho = substr($f['teljesites_datuma'], 0, 7);` → `$ho = substr($f['lerakas_datuma'], 0, 7);`

- [ ] **Step 13: `getFigyelmeztetesek()` (694-753. sor) — cseréld le a teljes metódust**

```php
    public function getFigyelmeztetesek($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, felrako_ceg, lerako_ceg, lerakas_datuma, megbizo_id, dij, allapot, szamlaszam
             FROM fuvarok
             WHERE admin = :admin AND torolt <> 'I' AND allapot IN ('rogzitett', 'szamlazva', 'fizetesre_var')"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $megbizoNevek = $this->batchLekerdezes('ugyfelek', 'nev', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoHataridok = $this->batchLekerdezes('ugyfelek', 'fizetesi_hatarido_nap', array_column($fuvarok, 'megbizo_id'), $ceg_id);

        $ma = date('Y-m-d');
        $lejartFizetes = [];
        $szamlazasraVar = [];
        foreach ($fuvarok as $f) {
            $osszesen = round((float) ($f['dij'] ?? 0), 2);
            $utvonal = trim(($f['felrako_ceg'] ?: '') . ($f['felrako_ceg'] && $f['lerako_ceg'] ? ' → ' : '') . ($f['lerako_ceg'] ?: ''));
            $utvonal = $utvonal !== '' ? $utvonal : 'Fuvar';
            $megbizoNev = !empty($f['megbizo_id']) ? ($megbizoNevek[$f['megbizo_id']] ?? 'Ismeretlen') : null;

            if (in_array($f['allapot'], ['szamlazva', 'fizetesre_var'], true) && !empty($f['lerakas_datuma']) && !empty($f['megbizo_id'])) {
                $napok = $megbizoHataridok[$f['megbizo_id']] ?? null;
                if ($napok !== null && $napok !== '') {
                    $hatarido = date('Y-m-d', strtotime($f['lerakas_datuma'] . " +{$napok} days"));
                    if ($hatarido < $ma) {
                        $lejartFizetes[] = [
                            'id' => (int) $f['id'],
                            'utvonal' => $utvonal,
                            'felrako' => $f['felrako_ceg'],
                            'megbizoNev' => $megbizoNev,
                            'osszesen' => $osszesen,
                            'hatarido' => $hatarido,
                            'szamlaszam' => $f['szamlaszam'],
                        ];
                    }
                }
            }

            if ($f['allapot'] === 'rogzitett' && !empty($f['lerakas_datuma']) && $f['lerakas_datuma'] < $ma) {
                $szamlazasraVar[] = [
                    'id' => (int) $f['id'],
                    'utvonal' => $utvonal,
                    'felrako' => $f['felrako_ceg'],
                    'megbizoNev' => $megbizoNev,
                    'osszesen' => $osszesen,
                    'teljesitesDatuma' => $f['lerakas_datuma'],
                ];
            }
        }
        usort($lejartFizetes, fn($a, $b) => $a['hatarido'] <=> $b['hatarido']);
        usort($szamlazasraVar, fn($a, $b) => $a['teljesitesDatuma'] <=> $b['teljesitesDatuma']);

        return [
            'success' => true,
            'lejartFizetes' => $lejartFizetes,
            'szamlazasraVar' => $szamlazasraVar,
        ];
    }
```

Megjegyzés: az output kulcsnevek (`felrako`, `teljesitesDatuma`, `osszesen`) SZÁNDÉKOSAN nem változnak — csak a forrás-oszlopok (`felrako_ceg`, `lerakas_datuma`, `dij`) —, így a frontend `FigyelmeztetesSav.js` változtatás nélkül működik tovább.

- [ ] **Step 14: `getSoforDashboard()` (763. sortól) — cseréld le a kezdő SELECT-et, a szűrőket és az `osszesen` számítást**

Az eredeti (772-808. sor eleje):
```php
        $params = [':admin' => $ceg_id];
        $query = "SELECT id, sofor_id, teljesites_datuma, allapot, beerkezett_dokumentum_id,
                         fuvardij, egyeb_koltseg
                  FROM fuvarok WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($datumTol)) {
            $query .= " AND teljesites_datuma >= :datum_tol";
            $params[':datum_tol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $query .= " AND teljesites_datuma <= :datum_ig";
            $params[':datum_ig'] = $datumIg;
        }
```
cserélendő erre:
```php
        $params = [':admin' => $ceg_id];
        $query = "SELECT id, sofor_id, lerakas_datuma, allapot, beerkezett_dokumentum_id,
                         dij
                  FROM fuvarok WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($datumTol)) {
            $query .= " AND lerakas_datuma >= :datum_tol";
            $params[':datum_tol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $query .= " AND lerakas_datuma <= :datum_ig";
            $params[':datum_ig'] = $datumIg;
        }
```
Az `$f['osszesen'] = (float) $f['fuvardij'] + (float) ($f['egyeb_koltseg'] ?? 0);` sor (806. sor) cserélendő: `$f['osszesen'] = (float) ($f['dij'] ?? 0);`
Ezután minden további `$f['teljesites_datuma']`-hivatkozást (az "utolsó fuvar dátuma" és a trend-bucket számításban, kb. 836-897. sor) cserélj `$f['lerakas_datuma']`-ra — az output mezőnevek (`utolsoFuvarDatuma`, `trend`, `periodus`) NEM változnak.

- [ ] **Step 15: Ellenőrizd, hogy egyetlen régi mezőnév sem maradt a fájlban**

Run: `grep -n "teljesites_datuma\|fuvarlevel_szam\|tomeg_kg\|fuvardij\|egyeb_koltseg\b" backend/interface/fuvarInterface.php`
Expected: nincs találat (üres kimenet).

- [ ] **Step 16: Élő ellenőrzés — indítsd el a PHP szervert, és hozz létre/módosíts egy fuvart curl-lel**

Run (külön terminálban/háttérben, ha még nem fut): `cd backend && php8.2 -S localhost:8001 &`

Hozz létre egy ideiglenes admin-sessiont a helyi DB-ben (a curl-teszthez):
```bash
mysql -u root kamion -e "INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES ('teszt_fuvar_terv_token', 'admin', 1, DATE_ADD(NOW(), INTERVAL 1 DAY)) ON DUPLICATE KEY UPDATE lejarat = DATE_ADD(NOW(), INTERVAL 1 DAY);"
```

Ellenőrizd, hogy `ugyfelek.id=8` ("Teszt") jelenleg NEM rendelkezik felrakó/lerakó adattal:
```bash
mysql -u root kamion -e "SELECT felrako_ceg, felrako_cim, lerako_ceg, lerako_cim FROM ugyfelek WHERE id=8;"
```
Expected: mind a 4 mező NULL.

Hozz létre egy fuvart erre a megbízóra, felrakó/lerakó adattal:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "action": "newFuvar",
  "sessionToken": "teszt_fuvar_terv_token",
  "ceg_id": 1,
  "kerelmezo_id": 1,
  "megbizo_id": 8,
  "felrakas_datuma": "2026-08-01",
  "lerakas_datuma": "2026-08-02",
  "felrako_ceg": "Teszt Felrakó Kft.",
  "felrako_cim": "1111 Budapest, Teszt utca 1.",
  "lerako_ceg": "Teszt Lerakó Kft.",
  "lerako_cim": "2222 Debrecen, Példa utca 2.",
  "tavolsag_km": 230,
  "tomeg_tonna": 12.5,
  "raklapszam": 14,
  "dij": 150000,
  "allapot": "rogzitett"
}' | python3 -m json.tool
```
Expected: `"success": true`, a visszaadott `fuvar` objektum tartalmazza a fenti mezőket pontosan úgy, ahogy megadtad (`dij: 150000`, `tomeg_tonna: "12.50"` stb.), NEM tartalmaz `teljesites_datuma`/`felrako`/`lerako`/`fuvardij`/`egyeb_koltseg`/`tomeg_kg`/`fuvarlevel_szam` kulcsot.

Ellenőrizd, hogy a megbízó automatikusan frissült:
```bash
mysql -u root kamion -e "SELECT felrako_ceg, felrako_cim, lerako_ceg, lerako_cim FROM ugyfelek WHERE id=8;"
```
Expected: mind a 4 mező most már ki van töltve a fenti fuvaron megadott értékekkel.

Hozz létre egy MÁSODIK fuvart ugyanerre a megbízóra, ELTÉRŐ felrakó/lerakó adattal:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "action": "newFuvar",
  "sessionToken": "teszt_fuvar_terv_token",
  "ceg_id": 1,
  "kerelmezo_id": 1,
  "megbizo_id": 8,
  "lerakas_datuma": "2026-08-05",
  "felrako_ceg": "MASIK Felrakó Kft.",
  "lerako_ceg": "MASIK Lerakó Kft.",
  "dij": 90000
}' | python3 -m json.tool
mysql -u root kamion -e "SELECT felrako_ceg, lerako_ceg FROM ugyfelek WHERE id=8;"
```
Expected: a megbízó `felrako_ceg`/`lerako_ceg` értéke VÁLTOZATLANUL az ELSŐ fuvaron megadott ("Teszt Felrakó Kft."/"Teszt Lerakó Kft.") marad — a második fuvar eltérő adata NEM írta felül (mert a megbízónál már volt érték).

Ellenőrizd a listát és a szűrést:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "action": "getFuvarok",
  "sessionToken": "teszt_fuvar_terv_token",
  "ceg_id": 1,
  "sortKey": "lerako",
  "sortDir": "asc"
}' | python3 -m json.tool
```
Expected: `"success": true`, a sorok tartalmazzák `megbizo_cim`/`megbizo_irsz`/`megbizo_varos` mezőket (a `ugyfelek.id=8` sor esetén NULL, mert annak a tesztügyfélnek nincs `cim`/`irsz`/`varos` kitöltve — ez elfogadható, csak a mező JELENLÉTét ellenőrizd a válaszban).

Töröld a teszt-sessiont és a teszt-fuvarokat, hogy ne szennyezzék a dev DB-t:
```bash
mysql -u root kamion -e "DELETE FROM sessions WHERE token='teszt_fuvar_terv_token';"
mysql -u root kamion -e "UPDATE fuvarok SET torolt='I' WHERE dij IN (150000, 90000) AND megbizo_id=8;"
mysql -u root kamion -e "UPDATE ugyfelek SET felrako_ceg=NULL, felrako_cim=NULL, lerako_ceg=NULL, lerako_cim=NULL WHERE id=8;"
```

- [ ] **Step 17: Commit**

```bash
git add backend/interface/fuvarInterface.php
git commit -m "$(cat <<'EOF'
feat(fuvar): rename fields and add megbízó pickup/dropoff auto-suggest

FuvarInterface now reads/writes felrakas_datuma/lerakas_datuma,
felrako_ceg/felrako_cim/lerako_ceg/lerako_cim, tomeg_tonna, raklapszam
and dij. New frissitsMegbizoFelrakoLerako() backfills the megbízó's
default pickup/dropoff location the first time it's provided on a
fuvar, without ever overwriting an existing value. Fuvar rows are also
enriched with the megbízó's own address for the driver-facing card.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ApiHandler.php` — push-értesítés/audit-log szöveg mezőnév-javítás

**Files:**
- Modify: `backend/ApiHandler.php:1683-1727`

**Interfaces:**
- Consumes: Task 2 `FuvarInterface::newFuvar()`/`updateFuvar()` visszaadott `fuvar` objektum új mezőnevei.

- [ ] **Step 1: Cseréld le a `newFuvar` case-ágat (1683-1699. sor)**

```php
                case 'newFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->newFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', $request['felrako_ceg'] ?? null);
                        if (!empty($result['fuvar']['sofor_id'])) {
                            $pushInterface->sendPushSofornak(
                                $result['fuvar']['sofor_id'],
                                'Új fuvar érkezett',
                                trim(($result['fuvar']['felrako_ceg'] ?? '') . ' → ' . ($result['fuvar']['lerako_ceg'] ?? '')) . ($result['fuvar']['lerakas_datuma'] ? ' · ' . date('Y.m.d.', strtotime($result['fuvar']['lerakas_datuma'])) : ''),
                                '/user/fuvarReszletek?id=' . $result['fuvar']['id'],
                                'fuvar-' . $result['fuvar']['id']
                            );
                        }
                    }
                    echo json_encode($result);
                    return;
```

- [ ] **Step 2: Cseréld le az `updateFuvar` case-ágat (1700-1727. sor)**

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
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'modositas', $request['felrako_ceg'] ?? null);
                        $ujSoforId = $result['fuvar']['sofor_id'] ?? null;
                        if (!empty($ujSoforId) && (string) $ujSoforId !== (string) $regiSoforIdErtek) {
                            $pushInterface->sendPushSofornak(
                                $ujSoforId,
                                'Új fuvar érkezett',
                                trim(($result['fuvar']['felrako_ceg'] ?? '') . ' → ' . ($result['fuvar']['lerako_ceg'] ?? '')) . ($result['fuvar']['lerakas_datuma'] ? ' · ' . date('Y.m.d.', strtotime($result['fuvar']['lerakas_datuma'])) : ''),
                                '/user/fuvarReszletek?id=' . $result['fuvar']['id'],
                                'fuvar-' . $result['fuvar']['id']
                            );
                        }
                    }
                    echo json_encode($result);
                    return;
```

- [ ] **Step 3: Ellenőrizd, hogy nem maradt régi mezőnév-hivatkozás**

Run: `grep -n "\['felrako'\]\|\['lerako'\]\|\['teljesites_datuma'\]" backend/ApiHandler.php`
Expected: nincs találat.

- [ ] **Step 4: Élő ellenőrzés — push/audit szöveg helyesen épül-e fel**

Ismételd meg Task 2 Step 16 `newFuvar` curl-hívását egy sofőrrel rendelkező fuvarra (ha van sofőr-teszt-user a DB-ben; ha nincs, hagyd ki a push-részt és csak a `logAudit`-ot ellenőrizd):
```bash
mysql -u root kamion -e "SELECT megjegyzes FROM audit_log ORDER BY id DESC LIMIT 1\G" 2>&1 || true
```
Expected: a legutóbbi audit-log sor `megjegyzes`-mezője (vagy az arra épülő oszlop, ellenőrizd `SHOW COLUMNS FROM audit_log` alapján a pontos nevet) a `felrako_ceg` értékét tartalmazza, nem NULL/üres, ha a teszt-fuvaron meg volt adva.

- [ ] **Step 5: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
fix(fuvar): update push/audit text to new felrakó/lerakó field names

newFuvar/updateFuvar's audit-log message and driver push notification
text were still reading the removed felrako/lerako/teljesites_datuma
keys, which would have silently gone null after the rename.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `UgyfelInterface.php` — felrakó/lerakó mezők a megbízón

**Files:**
- Modify: `backend/interface/ugyfelInterface.php:41-98`

**Interfaces:**
- Produces: `newUgyfel($data)`/`saveUgyfelData($data)` mostantól elfogadják és mentik a `felrako_ceg`/`felrako_cim`/`lerako_ceg`/`lerako_cim` mezőket.

- [ ] **Step 1: Cseréld le `newUgyfel()`-t (41-64. sor)**

```php
    public function newUgyfel($data) {
        try {
            $query = "INSERT INTO ugyfelek (admin, nev, adoszam, cim, irsz, varos, kapcsolattarto_nev, kapcsolattarto_email, kapcsolattarto_telefon, fizetesi_hatarido_nap, megjegyzes, felrako_ceg, felrako_cim, lerako_ceg, lerako_cim)
                      VALUES (:admin, :nev, :adoszam, :cim, :irsz, :varos, :kapcsolattarto_nev, :kapcsolattarto_email, :kapcsolattarto_telefon, :fizetesi_hatarido_nap, :megjegyzes, :felrako_ceg, :felrako_cim, :lerako_ceg, :lerako_cim)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['admin']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->bindValue(':adoszam', $data['adoszam'] ?? null);
            $stmt->bindValue(':cim', $data['cim'] ?? null);
            $stmt->bindValue(':irsz', $data['irsz'] ?? null);
            $stmt->bindValue(':varos', $data['varos'] ?? null);
            $stmt->bindValue(':kapcsolattarto_nev', $data['kapcsolattarto_nev'] ?? null);
            $stmt->bindValue(':kapcsolattarto_email', $data['kapcsolattarto_email'] ?? null);
            $stmt->bindValue(':kapcsolattarto_telefon', $data['kapcsolattarto_telefon'] ?? null);
            $stmt->bindValue(':fizetesi_hatarido_nap', empty($data['fizetesi_hatarido_nap']) ? null : (int) $data['fizetesi_hatarido_nap'], empty($data['fizetesi_hatarido_nap']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->bindValue(':felrako_ceg', $data['felrako_ceg'] ?? null);
            $stmt->bindValue(':felrako_cim', $data['felrako_cim'] ?? null);
            $stmt->bindValue(':lerako_ceg', $data['lerako_ceg'] ?? null);
            $stmt->bindValue(':lerako_cim', $data['lerako_cim'] ?? null);
            $stmt->execute();

            $newId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Ügyfél rögzítve.', 'ugyfel' => ['id' => $newId] + $data];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
```

- [ ] **Step 2: Cseréld le `saveUgyfelData()`-t (70-98. sor)**

```php
    public function saveUgyfelData($data) {
        try {
            $query = "UPDATE ugyfelek SET
                      nev = :nev, adoszam = :adoszam,
                      cim = :cim, irsz = :irsz, varos = :varos,
                      kapcsolattarto_nev = :kapcsolattarto_nev, kapcsolattarto_email = :kapcsolattarto_email,
                      kapcsolattarto_telefon = :kapcsolattarto_telefon, fizetesi_hatarido_nap = :fizetesi_hatarido_nap,
                      megjegyzes = :megjegyzes,
                      felrako_ceg = :felrako_ceg, felrako_cim = :felrako_cim, lerako_ceg = :lerako_ceg, lerako_cim = :lerako_cim
                      WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
            $stmt->bindValue(':ceg_id', $data['ceg_id']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->bindValue(':adoszam', $data['adoszam'] ?? null);
            $stmt->bindValue(':cim', $data['cim'] ?? null);
            $stmt->bindValue(':irsz', $data['irsz'] ?? null);
            $stmt->bindValue(':varos', $data['varos'] ?? null);
            $stmt->bindValue(':kapcsolattarto_nev', $data['kapcsolattarto_nev'] ?? null);
            $stmt->bindValue(':kapcsolattarto_email', $data['kapcsolattarto_email'] ?? null);
            $stmt->bindValue(':kapcsolattarto_telefon', $data['kapcsolattarto_telefon'] ?? null);
            $stmt->bindValue(':fizetesi_hatarido_nap', empty($data['fizetesi_hatarido_nap']) ? null : (int) $data['fizetesi_hatarido_nap'], empty($data['fizetesi_hatarido_nap']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->bindValue(':felrako_ceg', $data['felrako_ceg'] ?? null);
            $stmt->bindValue(':felrako_cim', $data['felrako_cim'] ?? null);
            $stmt->bindValue(':lerako_ceg', $data['lerako_ceg'] ?? null);
            $stmt->bindValue(':lerako_cim', $data['lerako_cim'] ?? null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Mentés sikeres.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
```

- [ ] **Step 3: Élő ellenőrzés**

(Feltételezve, hogy a Task 2 Step 16-ban létrehozott ideiglenes session már törölve lett — hozz létre újat, vagy ismételd meg az insert parancsot.)

```bash
mysql -u root kamion -e "INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES ('teszt_fuvar_terv_token', 'admin', 1, DATE_ADD(NOW(), INTERVAL 1 DAY)) ON DUPLICATE KEY UPDATE lejarat = DATE_ADD(NOW(), INTERVAL 1 DAY);"

curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "action": "saveUgyfelData",
  "sessionToken": "teszt_fuvar_terv_token",
  "id": 1,
  "ceg_id": 1,
  "kerelmezo_id": 1,
  "nev": "Teszt Ugyfel Kft. 2",
  "felrako_ceg": "Központi Raktár",
  "felrako_cim": "1000 Budapest, Raktár utca 1.",
  "lerako_ceg": "Fiók Telephely",
  "lerako_cim": "6000 Kecskemét, Fiók utca 2."
}' | python3 -m json.tool

mysql -u root kamion -e "SELECT felrako_ceg, felrako_cim, lerako_ceg, lerako_cim FROM ugyfelek WHERE id=1;"
```
Expected: `"success": true`, a mysql lekérdezés visszaadja a fenti 4 új értéket.

Állítsd vissza a teszt-ügyfél eredeti (üres) állapotát, és töröld a session-t:
```bash
mysql -u root kamion -e "UPDATE ugyfelek SET felrako_ceg=NULL, felrako_cim=NULL, lerako_ceg=NULL, lerako_cim=NULL WHERE id=1;"
mysql -u root kamion -e "DELETE FROM sessions WHERE token='teszt_fuvar_terv_token';"
```

- [ ] **Step 4: Commit**

```bash
git add backend/interface/ugyfelInterface.php
git commit -m "$(cat <<'EOF'
feat(ugyfel): add felrakó/lerakó cég+cím fields to megbízó CRUD

Lets admin directly manage a megbízó's default pickup/dropoff location
via newUgyfel/saveUgyfelData, in addition to the automatic backfill
from FuvarInterface.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `KeresesInterface.php` — globális kereső mezőnév-javítás

**Files:**
- Modify: `backend/interface/keresesInterface.php:116-134`

- [ ] **Step 1: Cseréld le a fuvar-keresési blokkot**

```php
            $stmt = $this->db->prepare(
                "SELECT id, felrako_ceg, lerako_ceg, aru_megnevezese, raklapszam, szamlaszam FROM fuvarok
                 WHERE admin = :ceg_id AND torolt <> 'I'
                   AND (felrako_ceg LIKE :q OR lerako_ceg LIKE :q OR aru_megnevezese LIKE :q OR raklapszam LIKE :q OR szamlaszam LIKE :q)
                 LIMIT 8"
            );
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $utvonal = trim(($row['felrako_ceg'] ?: '') . ($row['felrako_ceg'] && $row['lerako_ceg'] ? ' → ' : '') . ($row['lerako_ceg'] ?: ''));
                $talalatok[] = [
                    'tipus' => 'fuvar',
                    'id' => $row['id'],
                    'cim' => $utvonal !== '' ? $utvonal : ($row['aru_megnevezese'] ?: 'Fuvar'),
                    'alcim' => $row['raklapszam'] ? "Raklapszám: {$row['raklapszam']}" : ($row['szamlaszam'] ?: 'Fuvar'),
                    'url' => '/admin/fuvarok',
                ];
            }
```

- [ ] **Step 2: Élő ellenőrzés — globális kereső**

```bash
mysql -u root kamion -e "INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES ('teszt_fuvar_terv_token', 'admin', 1, DATE_ADD(NOW(), INTERVAL 1 DAY)) ON DUPLICATE KEY UPDATE lejarat = DATE_ADD(NOW(), INTERVAL 1 DAY);"
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "action": "globalSearch",
  "sessionToken": "teszt_fuvar_terv_token",
  "ceg_id": 1,
  "q": "Kecskemét"
}' | python3 -m json.tool
mysql -u root kamion -e "DELETE FROM sessions WHERE token='teszt_fuvar_terv_token';"
```
Expected: `"success": true`, nincs PHP-hiba (`Column not found` esetén a régi mezőnevek maradtak valahol).

- [ ] **Step 3: Commit**

```bash
git add backend/interface/keresesInterface.php
git commit -m "$(cat <<'EOF'
fix(kereses): update global search to new fuvar field names

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `CardUgyfel.js` — Felrakó/Lerakó szekció a megbízó formon

**Files:**
- Modify: `src/components/Cards/CardUgyfel.js`

**Interfaces:**
- Consumes: Task 4 `newUgyfel`/`saveUgyfelData` új mezői.

- [ ] **Step 1: Bővítsd az `emptyUgyfel` objektumot (19-30. sor)**

```js
const emptyUgyfel = {
  nev: "",
  adoszam: "",
  cim: "",
  irsz: "",
  varos: "",
  kapcsolattarto_nev: "",
  kapcsolattarto_email: "",
  kapcsolattarto_telefon: "",
  fizetesi_hatarido_nap: "",
  felrako_ceg: "",
  felrako_cim: "",
  lerako_ceg: "",
  lerako_cim: "",
  megjegyzes: "",
};
```

- [ ] **Step 2: Adj hozzá egy "Felrakó / Lerakó" `FormSection`-t a "Kapcsolattartó" szekció UTÁN, a "Megjegyzés" szekció ELÉ (a 167. sor `</FormSection>` és a 168. sor `<FormSection title="Megjegyzés"` közé)**

Először importáld a `PiTruckLight` ikont (add hozzá a fájl tetején lévő `react-icons/pi` import listához, `PiPhoneLight` mellé):

```js
import {
  PiBuildingsLight,
  PiArrowLeftLight,
  PiHashLight,
  PiMapPinLight,
  PiUserLight,
  PiEnvelopeSimpleLight,
  PiPhoneLight,
  PiTruckLight,
  PiNoteLight,
} from "react-icons/pi";
```

Majd a JSX-be (a "Kapcsolattartó" `FormSection` lezárása után):

```jsx
            <FormSection title="Felrakó / Lerakó (alapértelmezett)" icon={PiTruckLight} columns={4}>
              <FormField
                label="Felrakó cég"
                name="felrako_ceg"
                value={formData.felrako_ceg || ""}
                onChange={handleChange}
              />
              <FormField
                label="Felrakó cím"
                name="felrako_cim"
                value={formData.felrako_cim || ""}
                onChange={handleChange}
              />
              <FormField
                label="Lerakó cég"
                name="lerako_ceg"
                value={formData.lerako_ceg || ""}
                onChange={handleChange}
              />
              <FormField
                label="Lerakó cím"
                name="lerako_cim"
                value={formData.lerako_cim || ""}
                onChange={handleChange}
              />
            </FormSection>
```

- [ ] **Step 3: Élő ellenőrzés böngészőben**

Nyisd meg `/admin/ugyfelek/ugyfelForm` (vagy a meglévő szerkesztés-útvonalat egy meglévő megbízóval), ellenőrizd hogy az új "Felrakó / Lerakó" szekció megjelenik a Kapcsolattartó és a Megjegyzés között, kitöltés + Mentés után az adat elmentődik (ellenőrizd `mysql -u root kamion -e "SELECT felrako_ceg FROM ugyfelek WHERE id=<id>;"`).

- [ ] **Step 4: Commit**

```bash
git add src/components/Cards/CardUgyfel.js
git commit -m "$(cat <<'EOF'
feat(ugyfel): add Felrakó/Lerakó section to megbízó form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `FuvarForm.js` — mezők átalakítása + automatikus ajánlás-kitöltés

**Files:**
- Modify: `src/views/admin/FuvarForm.js`

**Interfaces:**
- Consumes: Task 2 backend mezőnevek, `ugyfelek` állapot (már betöltve `getUgyfelek`-kel, most tartalmazza a `felrako_ceg`/`felrako_cim`/`lerako_ceg`/`lerako_cim` mezőket is Task 4 óta).

- [ ] **Step 1: Cseréld le az `emptyFuvar` objektumot (65-82. sor)**

```js
const emptyFuvar = {
  sofor_id: "",
  kamion_id: "",
  furgon_id: "",
  potkocsi_id: "",
  felrakas_datuma: "",
  lerakas_datuma: "",
  felrako_ceg: "",
  felrako_cim: "",
  lerako_ceg: "",
  lerako_cim: "",
  tavolsag_km: "",
  tomeg_tonna: "",
  megbizo_id: "",
  aru_megnevezese: "",
  megjegyzes: "",
  dij: "",
  raklapszam: "",
  allapot: "rogzitett",
};
```

- [ ] **Step 2: Cseréld le `handleMegbizoChange`-et (179-194. sor) — automatikus ajánlás-kitöltés**

```js
  const handleMegbizoChange = useCallback(
    async (megbizoId) => {
      setElozmenyNyitva(false);
      const kivalasztott = ugyfelek.find((u) => String(u.id) === String(megbizoId));
      setFormData((prev) => {
        const uj = { ...prev, megbizo_id: megbizoId };
        if (kivalasztott) {
          ["felrako_ceg", "felrako_cim", "lerako_ceg", "lerako_cim"].forEach((mezo) => {
            if (!uj[mezo] && kivalasztott[mezo]) {
              uj[mezo] = kivalasztott[mezo];
            }
          });
        }
        return uj;
      });
      if (!megbizoId) {
        setUgyfelElozmeny([]);
        return;
      }
      const result = await fetchAction("getUgyfelFuvarElozmeny", {
        ceg_id: user.ceg_id,
        ugyfelId: megbizoId,
      });
      setUgyfelElozmeny(result?.success ? result.fuvarok || [] : []);
    },
    [user.ceg_id, ugyfelek],
  );
```

- [ ] **Step 3: Cseréld le az `AdminBreadcrumb` `current` propját (299. sor)**

```jsx
          current={
            isNew
              ? "Új fuvar"
              : initialData.felrako_ceg && initialData.lerako_ceg
                ? `${initialData.felrako_ceg} → ${initialData.lerako_ceg}`
                : "Fuvar szerkesztése"
          }
```

- [ ] **Step 4: Cseréld le a "Korábbi fuvarok" lista elemet (409-415. sor)**

```jsx
                      {ugyfelElozmeny.map((f, i) => (
                        <li key={i}>
                          {f.lerakas_datuma || "—"} · {f.felrako_ceg} → {f.lerako_ceg} ·{" "}
                          {f.dij != null ? `${Number(f.dij).toLocaleString("hu-HU")} Ft` : "—"}
                        </li>
                      ))}
```

- [ ] **Step 5: Cseréld le az "Útvonal" `FormSection`-t (421-458. sor)**

```jsx
              <FormSection title="Útvonal" icon={PiMapPinLight} columns={4}>
                <FormField
                  type="date"
                  label="Felrakás dátuma"
                  name="felrakas_datuma"
                  value={formData.felrakas_datuma || ""}
                  onChange={handleChange}
                />
                <FormField
                  type="date"
                  label="Lerakás dátuma"
                  name="lerakas_datuma"
                  value={formData.lerakas_datuma || ""}
                  onChange={handleChange}
                />
                <FormField
                  label="Felrakó cég"
                  name="felrako_ceg"
                  value={formData.felrako_ceg || ""}
                  onChange={handleChange}
                />
                <FormField
                  label="Felrakó cím"
                  name="felrako_cim"
                  value={formData.felrako_cim || ""}
                  onChange={handleChange}
                />
                <FormField
                  label="Lerakó cég"
                  name="lerako_ceg"
                  value={formData.lerako_ceg || ""}
                  onChange={handleChange}
                />
                <FormField
                  label="Lerakó cím"
                  name="lerako_cim"
                  value={formData.lerako_cim || ""}
                  onChange={handleChange}
                />
                <FormField
                  type="number"
                  label="Távolság (km)"
                  name="tavolsag_km"
                  value={formData.tavolsag_km || ""}
                  onChange={handleChange}
                />
                <FormField
                  type="number"
                  step="0.1"
                  label="Tömeg (tonna)"
                  name="tomeg_tonna"
                  value={formData.tomeg_tonna || ""}
                  onChange={handleChange}
                />
                <FormField
                  label="Áru megnevezése"
                  name="aru_megnevezese"
                  value={formData.aru_megnevezese || ""}
                  onChange={handleChange}
                  className="md:col-span-2"
                />
                <FormField
                  type="number"
                  label="Raklapszám"
                  name="raklapszam"
                  value={formData.raklapszam || ""}
                  onChange={handleChange}
                />
              </FormSection>
```

- [ ] **Step 6: Cseréld le a "Díjak" `FormSection`-t (460-488. sor)**

```jsx
              <FormSection title="Díjak" icon={PiCoinsLight} columns={4}>
                <FormField
                  type="number"
                  label="Díj (Ft)"
                  name="dij"
                  value={formData.dij || ""}
                  onChange={handleChange}
                />
                <FormField
                  as="select"
                  label="Állapot"
                  name="allapot"
                  value={formData.allapot || "rogzitett"}
                  onChange={handleChange}
                >
                  {ALLAPOT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FormField>
              </FormSection>
```

- [ ] **Step 7: Élő ellenőrzés böngészőben**

`npm start` (ha még nem fut) + `php8.2 -S localhost:8001` a `backend/` alól. Nyisd meg `/admin/fuvarForm`-ot új fuvarként:
1. Válaszd ki a `ugyfelek.id=8` ("Teszt") megbízót (miután Task 2 Step 16 óta annak nincs felrakó/lerakó adata — ha mégis van a Task 2 takarítás miatt üres, ez helyes állapot).
2. Töltsd ki a Felrakó cég/cím és Lerakó cég/cím mezőket, mentsd el a fuvart.
3. Nyiss egy ÚJ fuvart, válaszd ki UGYANAZT a megbízót — ellenőrizd, hogy a Felrakó/Lerakó mezők AUTOMATIKUSAN kitöltődnek az előző fuvaron megadott értékekkel.
4. Ellenőrizd, hogy a "Díjak" szekció egyetlen "Díj (Ft)" mezőt mutat, a Tömeg mező "tonna" címkével jelenik meg.

- [ ] **Step 8: Commit**

```bash
git add src/views/admin/FuvarForm.js
git commit -m "$(cat <<'EOF'
feat(fuvar-form): felrakás/lerakás dátum, raklapszám, tonna, egy díj mező

Also auto-fills the pickup/dropoff fields from the selected megbízó's
stored defaults when they're empty on the form.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `CardTableForFuvarok.js` — admin lista oszlopok

**Files:**
- Modify: `src/components/Table/CardTableForFuvarok.js`

- [ ] **Step 1: Cseréld le a `columns` tömböt (117-165. sor)**

```jsx
  const columns = [
    { key: "lerakas_datuma", label: "Lerakás", sortable: true, render: (row) => row.lerakas_datuma || "—" },
    {
      key: "felrakas_datuma",
      label: "Felrakás",
      sortable: true,
      render: (row) => row.felrakas_datuma || "—",
      mobileHidden: true,
    },
    {
      key: "felrako",
      label: "Felrakó",
      sortable: true,
      render: (row) => <span title={row.felrako_cim || ""}>{row.felrako_ceg || "—"}</span>,
    },
    {
      key: "lerako",
      label: "Lerakó",
      sortable: true,
      render: (row) => <span title={row.lerako_cim || ""}>{row.lerako_ceg || "—"}</span>,
    },
    { key: "megbizo_nev", label: "Megbízó", render: (row) => row.megbizo_nev || "—" },
    { key: "sofor_nev", label: "Sofőr", render: (row) => row.sofor_nev || "—", mobileHidden: true },
    { key: "jarmu", label: "Jármű", render: jarmuLabel, mobileHidden: true },
    { key: "raklapszam", label: "Raklapszám", render: (row) => row.raklapszam ?? "—", mobileHidden: true },
    {
      key: "tomeg_tonna",
      label: "Tömeg",
      render: (row) => (row.tomeg_tonna != null ? `${Number(row.tomeg_tonna).toLocaleString("hu-HU")} t` : "—"),
      mobileHidden: true,
    },
    {
      key: "dij",
      label: "Díj",
      render: (row) => (row.dij != null ? `${Number(row.dij).toLocaleString("hu-HU")} Ft` : "—"),
    },
    {
      key: "allapot",
      label: "Állapot",
      sortable: true,
      render: (row) => (
        <StatusChangePopover value={row.allapot} onChange={(ujAllapot) => valtAllapotot(row.id, ujAllapot)} />
      ),
    },
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
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiPencilSimpleLight />} onClick={() => handleEditClick(row)} title="Szerkesztés" />
          <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDelete(row.id)} title="Törlés" />
        </div>
      ),
    },
  ];
```

- [ ] **Step 2: Cseréld le az `exportColumns` tömböt (167-178. sor)**

```jsx
  const exportColumns = [
    { key: "lerakas_datuma", label: "Lerakás" },
    { key: "felrakas_datuma", label: "Felrakás" },
    { key: "felrako_ceg", label: "Felrakó cég" },
    { key: "felrako_cim", label: "Felrakó cím" },
    { key: "lerako_ceg", label: "Lerakó cég" },
    { key: "lerako_cim", label: "Lerakó cím" },
    { key: "megbizo_nev", label: "Megbízó" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "raklapszam", label: "Raklapszám" },
    { key: "tomeg_tonna", label: "Tömeg (t)" },
    { key: "dij", label: "Díj" },
    { key: "allapot", label: "Állapot" },
    { key: "szamlaszam", label: "Számlaszám" },
  ];
```

- [ ] **Step 3: Élő ellenőrzés böngészőben**

Nyisd meg `/admin/fuvarok`-ot (Táblázat nézet), ellenőrizd hogy az összes új oszlop megjelenik, a rendezés (kattintás a "Lerakás"/"Felrakó"/"Lerakó"/"Állapot" fejlécre) hibátlanul működik, és a CSV export (ha van legalább 1 fuvar) tartalmazza az új mezőket.

- [ ] **Step 4: Commit**

```bash
git add src/components/Table/CardTableForFuvarok.js
git commit -m "$(cat <<'EOF'
feat(fuvar-lista): update admin table columns for renamed fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Admin Kanban / Sofőr-szerinti nézet — mezőnév-renamek

**Files:**
- Modify: `src/views/admin/Fuvarok.js:28`
- Modify: `src/components/Fuvarok/FuvarKanbanCard.js`
- Modify: `src/components/Fuvarok/SoforCsoportositottLista.js`

- [ ] **Step 1: `src/views/admin/Fuvarok.js` — cseréld le a `sortKey` alapértékét (28. sor)**

```js
  const [sortKey, setSortKey] = useState("lerakas_datuma");
```

- [ ] **Step 2: `src/components/Fuvarok/FuvarKanbanCard.js` — cseréld le a teljes komponenstestet (5-34. sor)**

```jsx
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(fuvar.id));
        onDragStart(fuvar.id);
      }}
      onDoubleClick={onClick}
      className="cursor-grab rounded-xl border border-ink-100 bg-white p-3 text-xs shadow-soft hover:border-brand-300 hover:shadow-md active:cursor-grabbing dark:border-ink-800 dark:bg-ink-900"
    >
      <p className="mb-1 font-semibold text-ink-700 dark:text-ink-200">
        {fuvar.felrako_ceg || "—"} → {fuvar.lerako_ceg || "—"}
      </p>
      <p className="text-ink-500 dark:text-ink-400">
        {fuvar.megbizo_nev || "—"}
      </p>
      <p className="mt-0.5 text-ink-400 dark:text-ink-500">
        {fuvar.sofor_nev || "Nincs sofőrhöz rendelve"}
      </p>
      <div className="mt-2 flex items-center justify-between text-ink-400 dark:text-ink-500">
        <span>{fuvar.lerakas_datuma || "—"}</span>
        <span>{jarmu}</span>
      </div>
      {fuvar.dij != null && (
        <p className="mt-1 font-semibold text-ink-600 dark:text-ink-300">
          {Number(fuvar.dij).toLocaleString("hu-HU")} Ft
        </p>
      )}
    </div>
```

- [ ] **Step 3: `src/components/Fuvarok/SoforCsoportositottLista.js` — 3 helyen cserélj**

A `csoportok` építésénél (91. sor):
```js
    csoportok[kulcs].bevetel += Number(f.dij) || 0;
```

A rendezésnél (98. sor):
```js
    csoport.fuvarok.sort((a, b) => (b.lerakas_datuma || "").localeCompare(a.lerakas_datuma || ""));
```

A sor-render-nél (163-171. sor):
```jsx
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleEditClick(f)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-ink-800"
                >
                  <span className="text-ink-600 dark:text-ink-300">
                    {f.lerakas_datuma || "—"} · {f.felrako_ceg || "—"} → {f.lerako_ceg || "—"}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-ink-500 dark:text-ink-400">
                      {f.dij != null ? `${Number(f.dij).toLocaleString("hu-HU")} Ft` : "—"}
                    </span>
                    <StatusBadge tone={ALLAPOT_TONE[f.allapot] || "neutral"}>{ALLAPOT_LABEL[f.allapot] || f.allapot}</StatusBadge>
                  </span>
                </button>
```

- [ ] **Step 4: Élő ellenőrzés böngészőben**

Nyisd meg `/admin/fuvarok`-ot, válts "Kanban" nézetre (ellenőrizd a kártyák helyes megjelenését), majd "Sofőr szerint" nézetre (ellenőrizd a heti csoportosítást és a bevétel-összeget).

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/Fuvarok.js src/components/Fuvarok/FuvarKanbanCard.js src/components/Fuvarok/SoforCsoportositottLista.js
git commit -m "$(cat <<'EOF'
feat(fuvar): update Kanban/Sofőr views to renamed fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `src/views/user/Fuvarok.js` — sofőr lista mezőnév-renamek

**Files:**
- Modify: `src/views/user/Fuvarok.js:17-33`

- [ ] **Step 1: Cseréld le a `FuvarSor` komponenst**

```jsx
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
          {fuvar.felrako_ceg || "—"} → {fuvar.lerako_ceg || "—"}
        </p>
        {fuvar.dokumentum_feltoltve ? (
          <StatusBadge tone="success">Dokumentum ✓</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Menetlevél hiányzik</StatusBadge>
        )}
      </div>
      <p className="text-xs text-ink-400">
        {fuvar.lerakas_datuma || "Nincs dátum"} · {jarmu}
        {fuvar.megbizo_nev ? ` · ${fuvar.megbizo_nev}` : ""}
      </p>
    </button>
  );
}
```

- [ ] **Step 2: Élő ellenőrzés böngészőben**

Sofőr-oldali sessionnel (ld. CLAUDE.md "Sofőr mobil UX-audit pass" a driver-session beállításról) nyisd meg `/user/fuvarok`-ot, ellenőrizd hogy a kártyák helyesen jelenítik meg a felrakó/lerakó céget és a lerakás dátumát.

- [ ] **Step 3: Commit**

```bash
git add src/views/user/Fuvarok.js
git commit -m "$(cat <<'EOF'
feat(sofor-fuvarok): update list card to renamed fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `FuvarReszletek.js` — sofőr kártya bővítése + Google Maps gomb

**Files:**
- Modify: `src/views/user/FuvarReszletek.js`

**Interfaces:**
- Consumes: Task 2 `getSajatFuvar`/`getSajatFuvarok` bővített mezői (`raklapszam`, `felrakas_datuma`, `lerakas_datuma`, `felrako_ceg`, `felrako_cim`, `lerako_ceg`, `lerako_cim`, `tomeg_tonna`, `megbizo_cim`, `megbizo_irsz`, `megbizo_varos`).

- [ ] **Step 1: Bővítsd az import listát egy térkép-ikonnal (3. sor)**

```js
import { PiCameraLight, PiFilePdfLight, PiTrashLight, PiMapTrifoldLight } from "react-icons/pi";
```

- [ ] **Step 2: Cseréld le a fő kártya JSX-blokkot (210-246. sor) — a `jarmu` változó definíciója felett add hozzá az útvonaltervező logikát, majd cseréld le a kártya tartalmát**

A `const jarmu = ...` sor (208. sor) UTÁN, a `return` ELŐTT:

```js
  const felrakoTeljesCim = [fuvar.felrako_ceg, fuvar.felrako_cim].filter(Boolean).join(", ");
  const lerakoTeljesCim = [fuvar.lerako_ceg, fuvar.lerako_cim].filter(Boolean).join(", ");
  const megbizoTeljesCim = [fuvar.megbizo_irsz, fuvar.megbizo_varos, fuvar.megbizo_cim].filter(Boolean).join(", ");
  const utvonaltervEleheto = Boolean(felrakoTeljesCim && lerakoTeljesCim);

  const handleUtvonalterv = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(felrakoTeljesCim)}&destination=${encodeURIComponent(lerakoTeljesCim)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
```

A kártya JSX-blokk (a `<div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">`-tól a záró `</div>`-ig, 214-246. sor) cserélendő erre:

```jsx
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <p className="font-display text-base font-bold text-brand-900">
          {fuvar.felrako_ceg || "—"} → {fuvar.lerako_ceg || "—"}
        </p>
        <dl className="mt-2 space-y-1 text-sm text-ink-600">
          <div>
            <dt className="inline font-semibold text-ink-400">Felrakás: </dt>
            <dd className="inline">{fuvar.felrakas_datuma || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-ink-400">Lerakás: </dt>
            <dd className="inline">{fuvar.lerakas_datuma || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-ink-400">Jármű: </dt>
            <dd className="inline">{jarmu}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-ink-400">Távolság: </dt>
            <dd className="inline">{fuvar.tavolsag_km ? `${fuvar.tavolsag_km} km` : "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-ink-400">Tömeg: </dt>
            <dd className="inline">{fuvar.tomeg_tonna != null ? `${fuvar.tomeg_tonna} t` : "—"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-ink-400">Raklapszám: </dt>
            <dd className="inline">{fuvar.raklapszam ?? "—"}</dd>
          </div>
          {fuvar.megbizo_nev && (
            <div>
              <dt className="inline font-semibold text-ink-400">Megbízó: </dt>
              <dd className="inline">
                {fuvar.megbizo_nev}
                {megbizoTeljesCim ? ` (${megbizoTeljesCim})` : ""}
              </dd>
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

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Felrakó</p>
            <p className="text-sm font-semibold text-ink-800">{fuvar.felrako_ceg || "—"}</p>
            {fuvar.felrako_cim && <p className="text-xs text-ink-400">{fuvar.felrako_cim}</p>}
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Lerakó</p>
            <p className="text-sm font-semibold text-ink-800">{fuvar.lerako_ceg || "—"}</p>
            {fuvar.lerako_cim && <p className="text-xs text-ink-400">{fuvar.lerako_cim}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={handleUtvonalterv}
          disabled={!utvonaltervEleheto}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-ink-400"
        >
          <PiMapTrifoldLight className="h-4 w-4" />
          Útvonaltervezés
        </button>
      </div>
```

- [ ] **Step 3: Élő ellenőrzés böngészőben**

Sofőr-oldali sessionnel nyisd meg egy olyan fuvar `/user/fuvarReszletek`-jét, amelyiken a Task 2 Step 16-ban rögzített teszt-adatok (vagy egy Task 7-ben a böngészőben létrehozott új fuvar) szerepelnek felrakó/lerakó cég+cím adattal:
1. Ellenőrizd, hogy Felrakás/Lerakás dátum, Távolság, Tömeg, Raklapszám, Megbízó (névvel+címmel) mind megjelenik.
2. Ellenőrizd, hogy a Felrakó/Lerakó blokkban a cég neve normál méretű, a cím alatta kisebb/halványabb.
3. Kattints az "Útvonaltervezés" gombra — ellenőrizd, hogy egy új lap nyílik `https://www.google.com/maps/dir/?api=1&origin=...&destination=...` URL-lel, a helyes felrakó/lerakó címekkel.
4. Nyiss meg egy olyan fuvart, ahol NINCS felrakó VAGY lerakó cím megadva — ellenőrizd, hogy a gomb inaktív (szürke, nem kattintható).

- [ ] **Step 4: Commit**

```bash
git add src/views/user/FuvarReszletek.js
git commit -m "$(cat <<'EOF'
feat(sofor-fuvar): richer detail card + Google Maps route button

Shows distance, raklapszám, megbízó name+address, tömeg, felrakó/lerakó
company+address (address shown smaller below the company name), and
pickup/dropoff dates. Adds a route-planning button that opens Google
Maps directions between the felrakó and lerakó addresses.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Záró ellenőrzés (mind a 11 task után)

- [ ] Futtasd újra a Task 2 Step 15 grep-jét a TELJES fájlkészletre, hogy egyetlen régi mezőnév se maradt sehol:

Run: `grep -rn "teljesites_datuma\|fuvarlevel_szam\|\btomeg_kg\b" backend/ src/ --include="*.php" --include="*.js" | grep -v "backend/sql/"`
Expected: nincs találat.

- [ ] Frissítsd a projekt gyökerében lévő `CLAUDE.md`-t egy rövid bekezdéssel erről a mezőátalakításról (a CLAUDE.md karbantartási szabály szerint — nagyobb módosítás volt), a meglévő "Fuvar-first munkafolyamat" szekció alá, dátumozva.
