# Fuvar profit-riport, útdíj-nyilvántartás, jármű teherbírás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user's manually-maintained weekly Excel P&L (fuvar bevétel mínusz üzemanyag+útdíj+bér) with in-app features: a jármű teherbírás mező, egy "Útdíj" Pénzforgalom-kategória, és egy flotta-szintű havi profit-riport a Fuvarok "Statisztikák" fülén.

**Architecture:** Additive, mechanikusan a meglévő mintákra épülő változtatások — nincs új alrendszer. A teherbírás egy sima mező-bővítés a 3 jármű-táblán. Az útdíj egy 5. kategória a már létező `egyeb_koltsegek`/`KATEGORIAK` rendszerben (pontosan az `uzemanyag` kategória mintáját követve). A profit-riport a `koltsegInterface.php`-ban már élő, tesztelt bér/üzemanyag-számítási logikát 3 új publikus wrapper-metóduson keresztül fűzi össze a `fuvarInterface.php` meglévő havi bevétel-bontásával.

**Tech Stack:** PHP 8.2 (backend, nincs framework, nincs composer), MySQL/MariaDB (PDO), React (frontend, CRA), Tailwind CSS. Nincs automatizált teszt-keretrendszer egyik oldalon sem — a projekt konvenciója a **live verifikáció**: `php8.2 -l` lint + közvetlen PHP CLI szkript a helyi DB ellen (ideiglenes teszt-cégen) a backendhez, Playwright a frontendhez.

## Global Constraints

- Minden szerver oldali módosítást ténylegesen le kell futtatni a helyi DB-n, nem elég statikus átolvasás (CLAUDE.md).
- SQL migrációk: `backend/sql/N.sql`, szekvenciális, egy commit = egy migráció. A legutóbbi (`38.sql`) már commitolva van → az új fájl `39.sql`.
- Nincs `JOIN`, nincs `UNION` a projekt saját SQL-lintere miatt — minden táblaösszefésülés külön lekérdezés + PHP-oldali merge.
- Minden `ceg_id`-t a szerver oldalon, session-ből feloldva kell átadni az interfészeknek, sosem a kliens nyers mezőjéből (biztonsági audit konvenció) — ez a spec egyik interfészét sem érinti újonnan (nincs új dispatcher-action), de a tesztekben mindig egy explicit `$cegId` változót kell átadni.
- Tailwind: ha új `className` kerül be, `npm run build:tailwind` szükséges a böngészős ellenőrzés előtt.
- Ideiglenes teszt-adatok kizárólag egy erre a célra létrehozott, ideiglenes teszt-cégen (nem az éles `admin=1` fiókon) — a teszt végén törölve.
- `git commit` minden egyes feladat (task) végén, önállóan (nem batch-elve a végén).

---

## Előkészítés — közös teszt-segédfüggvények

A backend-tesztekhez (2., 4., 6., 7. feladat) ugyanaz az indítási minta kell: a projekt saját `Database`/interfész-osztályai `require`-elve, PONTOSAN abban a sorrendben, ahogy `backend/ApiHandler.php` teszi (ez a sorrend számít, mert minden interfész-fájl a saját végén file-scope-ban példányosítja is önmagát, pl. `$koltsegInterface = new KoltsegInterface();` a `koltsegInterface.php` végén — ezért elég csak `require_once`-olni a fájlt, NEM kell kézzel `new`-olni, a globális változó automatikusan létrejön, pont úgy, ahogy `ApiHandler.php` `global $koltsegInterface, ...;` sora is támaszkodik erre).

Minden teszt-szkript ugyanazzal a fejléccel indul:

```php
<?php
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/db.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/PaginationHelper.php';
// + a konkrét feladathoz kellő interface fájl(ok) require_once-a
```

A teszt-cég létrehozása/törlése minden szkriptben ugyanaz (az `admin` tábla oszlopnevei: `email`, `name`, `password`, `torolt` — NEM `nev`/`jelszo`):

```php
$db = (new Database())->connect();
$db->exec("INSERT INTO admin (email, name, password, torolt) VALUES ('teszt-fuvarprofit@example.invalid', 'Teszt Ceg Fuvarprofit', 'x', 'N')");
$cegId = (int) $db->lastInsertId();
// ... a feladat saját tesztje ...
$db->exec("DELETE FROM admin WHERE id = $cegId");
```

---

### Task 1: SQL migráció — teherbírás + nettó összeg oszlopok

**Files:**
- Create: `backend/sql/39.sql`

**Interfaces:**
- Produces: `kamion.teherbiras`, `furgon.teherbiras`, `potkocsi.teherbiras` (DECIMAL(6,2) NULL); `egyeb_koltsegek.netto_osszeg` (DECIMAL(10,2) NULL) — a 2., 3., 4., 5. feladat épít ezekre az oszlopnevekre.

- [ ] **Step 1: Migrációs fájl megírása**

```sql
-- backend/sql/39.sql
-- Jármű teherbírás (tonna) + Pénzforgalom útdíj-tétel nettó összege
-- (informális, sosem összesített mező — ld. eredeti_osszeg/arfolyam minta).

ALTER TABLE kamion ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE furgon ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE potkocsi ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE egyeb_koltsegek ADD COLUMN netto_osszeg DECIMAL(10,2) NULL AFTER eredeti_osszeg;
```

- [ ] **Step 2: Lefuttatás a helyi DB-n**

Run: `mysql -uroot kamion < backend/sql/39.sql`
Expected: nincs hibaüzenet (a `root` felhasználó jogosult ALTER TABLE-re ezen a gépen, ld. CLAUDE.md "Local dev environment" — az app saját `kamion` DB-felhasználója NEM jogosult rá).

- [ ] **Step 3: Ellenőrzés**

Run:
```bash
mysql -uroot kamion -e "SHOW COLUMNS FROM kamion;" | grep teherbiras
mysql -uroot kamion -e "SHOW COLUMNS FROM furgon;" | grep teherbiras
mysql -uroot kamion -e "SHOW COLUMNS FROM potkocsi;" | grep teherbiras
mysql -uroot kamion -e "SHOW COLUMNS FROM egyeb_koltsegek;" | grep netto_osszeg
```
Expected: mind a 4 grep talál egy sort, `decimal(6,2)`/`decimal(10,2)` típussal, `YES` (nullable).

- [ ] **Step 4: Commit**

```bash
git add backend/sql/39.sql
git commit -m "feat(fuvar): add vehicle teherbírás and egyeb_koltsegek.netto_osszeg columns"
```

---

### Task 2: Backend — jármű teherbírás mentése (kamion/furgon/pótkocsi)

**Files:**
- Modify: `backend/interface/kamionInterface.php` (`saveKamionData()`, `newKamion()`)
- Modify: `backend/interface/furgonInterface.php` (`saveFurgonData()`, `newFurgon()`)
- Modify: `backend/interface/potkocsiInterface.php` (`savePotkocsiData()`, `newPotkocsi()`)

**Interfaces:**
- Consumes: `39.sql`-ben létrehozott `teherbiras` oszlopok (Task 1).
- Produces: mindhárom `newX($data, $ceg_id)`/`saveXData($data, $ceg_id)` mostantól elfogadja és perzisztálja a `$data['teherbiras']` mezőt (üres esetén NULL, egyébként float).

- [ ] **Step 1: `kamionInterface.php` — `saveKamionData()` bővítése**

A `SET` lista és a bind-ok közé (a `meret` mellé) kerül a `teherbiras`:

```php
// SET rész: "meret = :meret," sor UTÁN
                          teherbiras = :teherbiras,
```

```php
// bind-ok: "$stmt->bindParam(':meret', $data['meret'], PDO::PARAM_STR);" UTÁN
            $stmt->bindValue(':teherbiras', empty($data['teherbiras']) ? null : (float) $data['teherbiras']);
```

- [ ] **Step 2: `kamionInterface.php` — `newKamion()` bővítése**

Az oszloplista és a VALUES-lista is bővül `teherbiras`-szal (ugyanabban a pozícióban, a `meret` után — a lista-sorrendnek egyeznie kell a VALUES-listával, ld. a fájl saját, korábbi komment-figyelmeztetése erről):

```php
$query = "INSERT INTO kamion
          (admin, rendszam, potkocsi, meret, teherbiras, tipus, allapot, aktualis_km, muszaki_lejarat, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, porolto_lejarat, porolto_lejarat_2, kot_biztositas, kot_biz_nev, kot_biz_dij, kot_biz_utem, kaszko_biztositas, kaszko_nev, kaszko_dij, kaszko_fizetesi_utem)
          VALUES (:admin, :rendszam, :potkocsi, :meret, :teherbiras, :tipus, :allapot, :aktualis_km, :muszaki_lejarat, :adr_lejarat, :taograf_illesztes, :emelohatfal_vizsga, :porolto_lejarat, :porolto_lejarat_2, :kot_biztositas, :kot_biz_nev, :kot_biz_dij, :kot_biz_utem, :kaszko_biztositas, :kaszko_nev, :kaszko_dij, :kaszko_fizetesi_utem)";
```

```php
// bind-ok: "$stmt->bindParam(':meret', $data['meret'], PDO::PARAM_STR);" UTÁN
            $stmt->bindValue(':teherbiras', empty($data['teherbiras']) ? null : (float) $data['teherbiras']);
```

- [ ] **Step 3: `furgonInterface.php` — ugyanaz a 2 hely**

`saveFurgonData()` SET-listája + bind, `newFurgon()` oszlop/VALUES-lista + bind — szó szerint ugyanaz a mintázat, mint a fenti 2 lépés, csak a `potkocsi` oszlop nélkül (a furgon táblának nincs ilyen oszlopa).

- [ ] **Step 4: `potkocsiInterface.php` — ugyanaz a 2 hely**

`savePotkocsiData()` SET-listája + bind (itt `bindValue(':meret', empty(...) ? null : ...)` a minta, NEM `bindParam` — a `teherbiras`-t is ugyanígy, `bindValue`-val kösd), `newPotkocsi()` oszlop/VALUES-lista + bind.

- [ ] **Step 5: `php8.2 -l` lint mindhárom fájlon**

Run:
```bash
php8.2 -l backend/interface/kamionInterface.php
php8.2 -l backend/interface/furgonInterface.php
php8.2 -l backend/interface/potkocsiInterface.php
```
Expected: mindhárom `No syntax errors detected`.

- [ ] **Step 6: Élő teszt — ideiglenes teszt-cégen, PHP CLI-vel**

Írd meg és futtasd le a `/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_teherbiras.php` fájlt:

```php
<?php
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/db.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/PaginationHelper.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/kamionInterface.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/furgonInterface.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/potkocsiInterface.php';

$db = (new Database())->connect();
$db->exec("INSERT INTO admin (email, name, password, torolt) VALUES ('teszt-teherbiras@example.invalid', 'Teszt Ceg Teherbiras', 'x', 'N')");
$cegId = (int) $db->lastInsertId();
echo "Teszt ceg id: $cegId\n";

global $kamionInterface, $furgonInterface, $potkocsiInterface;

$r1 = $kamionInterface->newKamion(['rendszam' => 'TESZT-K01', 'teherbiras' => '18.5'], $cegId);
echo "newKamion: " . json_encode($r1) . "\n";
$r2 = $furgonInterface->newFurgon(['rendszam' => 'TESZT-F01', 'teherbiras' => '2.4'], $cegId);
echo "newFurgon: " . json_encode($r2) . "\n";
$r3 = $potkocsiInterface->newPotkocsi(['rendszam' => 'TESZT-P01', 'teherbiras' => '24'], $cegId);
echo "newPotkocsi: " . json_encode($r3) . "\n";

$sorok = $db->query("SELECT 'kamion' t, teherbiras FROM kamion WHERE admin=$cegId
  UNION ALL SELECT 'furgon', teherbiras FROM furgon WHERE admin=$cegId
  UNION ALL SELECT 'potkocsi', teherbiras FROM potkocsi WHERE admin=$cegId")->fetchAll(PDO::FETCH_ASSOC);
print_r($sorok);

// takarítás
$db->exec("DELETE FROM kamion WHERE admin=$cegId");
$db->exec("DELETE FROM furgon WHERE admin=$cegId");
$db->exec("DELETE FROM potkocsi WHERE admin=$cegId");
$db->exec("DELETE FROM admin WHERE id=$cegId");
echo "Takaritva.\n";
```

Run: `php8.2 /tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_teherbiras.php`

Expected: mindhárom `newX` hívás `"success":true`-t ad, a `print_r` 3 sort mutat `teherbiras` értékekkel `18.50`/`2.40`/`24.00`, a végén "Takaritva." (Megjegyzés: az `UNION ALL` itt a TESZT-szkriptben megengedett — a projekt saját SQL-lintere csak az `interface/*.php` fájlokban futó, alkalmazás-logikai lekérdezéseket tiltja, nem az ad hoc ellenőrző szkripteket.)

- [ ] **Step 7: Commit**

```bash
git add backend/interface/kamionInterface.php backend/interface/furgonInterface.php backend/interface/potkocsiInterface.php
git commit -m "feat(fuvar): persist vehicle teherbírás (load capacity) field"
```

---

### Task 3: Frontend — jármű teherbírás mező a 3 adatlap-formon

**Files:**
- Modify: `src/components/Cards/CardJarmuAdatokForm.js` (kamion)
- Modify: `src/components/Cards/CardFurgonAdatokForm.js`
- Modify: `src/components/Cards/CardPotkocsiAdatokForm.js`
- Modify: `src/components/Table/CardTableForKamionok.js` (export oszlop)
- Modify: `src/components/Table/CardTableForFurgonok.js` (export oszlop)
- Modify: `src/components/Table/CardTableForPotkocsi.js` (export oszlop)

**Interfaces:**
- Consumes: `backend/interface/{kamion,furgon,potkocsi}Interface.php` `teherbiras` mező (Task 2).
- Produces: nincs — ez a lánc utolsó, UI-szintű láncszeme.

**Döntés**: a teherbírás **csak export-oszlop** lesz a 3 lista-táblázaton (`exportColumns`), NEM kerül önálló, mindig látható képernyő-oszlopként a `columns` tömbbe — a Kamionok/Furgonok/Pótkocsi táblázatok már 5 látható oszloppal (Rendszám/Típus/Méret/Pótkocsi vagy Állapot/Műveletek) dolgoznak, és a projekt bevett mintája szerint a ritkábban nézett műszaki adatok (lejárati dátumok, biztosítási mezők) is csak az Excel-exportban jelennek meg, nem a képernyőn (ld. `CardTableForKamionok.js` saját kommentje erről).

- [ ] **Step 1: `CardJarmuAdatokForm.js` — új mező a "Fő adatok" szekcióban**

Az importok közé (react-icons/pi lista) kerül `PiScalesLight`. A "Méret" `FormField` UTÁN (ugyanabban a `columns={4}` `FormSection`-ben, ami automatikusan új sorba tördel 4 mező felett):

```jsx
<FormField
  type="number"
  step="0.1"
  icon={PiScalesLight}
  label="Teherbírás (t)"
  id="teherbiras"
  value={kamion.teherbiras || ""}
  onChange={handleFormChange}
/>
```

- [ ] **Step 2: `CardFurgonAdatokForm.js` — ugyanaz a mező**

Ugyanaz a `FormField`, csak `furgon.teherbiras` értékkel (`PiScalesLight` importálva).

- [ ] **Step 3: `CardPotkocsiAdatokForm.js` — ugyanaz a mező**

Ugyanaz a `FormField`, `potkocsi.teherbiras` értékkel.

- [ ] **Step 4: A 3 lista-táblázat `exportColumns` bővítése**

Mindhárom fájlban (`CardTableForKamionok.js`, `CardTableForFurgonok.js`, `CardTableForPotkocsi.js`) a `meret`/`potkocsi_rendszam` export-sor után:

```js
{ key: "teherbiras", label: "Teherbírás (t)" },
```

- [ ] **Step 5: Élő ellenőrzés (Playwright, helyi admin-munkamenettel)**

Indítsd el a dev szervereket, ha nem futnak (`cd backend && php8.2 -S localhost:8001`, `npm start`), majd Playwright-tal (a projekt saját, `sessionStorage`/`localStorage`-beli `user` kulccsal bypassolt admin-bejelentkezés mintáját követve, ld. CLAUDE.md "Local dev environment"):

1. Nyisd meg `/admin/kamionForm`-ot egy meglévő kamion szerkesztésével, tölts ki egy "Teherbírás (t)" mezőt (pl. `18.5`), mentés.
2. Töltsd újra az oldalt, nyisd meg ugyanazt a kamiont — a mező értéke megmaradt.
3. Ugyanez `/admin/furgonForm` és `/admin/potkocsiForm` oldalon.
4. Világos és sötét módban is nézd meg a mezőt (nincs vizuális törés).

Expected: mindhárom formon a mező megjelenik, ment, és visszatöltődik; nincs konzolhiba.

- [ ] **Step 6: Commit**

```bash
git add src/components/Cards/CardJarmuAdatokForm.js src/components/Cards/CardFurgonAdatokForm.js src/components/Cards/CardPotkocsiAdatokForm.js src/components/Table/CardTableForKamionok.js src/components/Table/CardTableForFurgonok.js src/components/Table/CardTableForPotkocsi.js
git commit -m "feat(fuvar): add teherbírás field to vehicle forms and exports"
```

---

### Task 4: Backend — Útdíj kategória (`koltsegInterface.php`)

**Files:**
- Modify: `backend/interface/koltsegInterface.php`

**Interfaces:**
- Consumes: `egyeb_koltsegek.netto_osszeg` oszlop (Task 1).
- Produces: `KATEGORIAK` tartalmazza `'utdij'`-t; `getKoltsegOsszesito()` visszatérési `havi[]`/`jarmuvenkent[]`/`osszesen` tömbjei mind kapnak egy `utdij` kulcsot; `newEgyebKoltseg`/`updateEgyebKoltseg` elfogadja a `netto_osszeg` mezőt.

- [ ] **Step 1: `KATEGORIAK` bővítése**

```php
// Előtte:
const KATEGORIAK = ['uzemanyag', 'karbantartas', 'biztositas', 'ber'];
// Utána:
const KATEGORIAK = ['uzemanyag', 'karbantartas', 'biztositas', 'ber', 'utdij'];
```

(A `normalizKategoria()`-ban NINCS teendő — az `'utdij'` semmilyen admin-only korlátozást nem kap, csak az `in_array(..., self::KATEGORIAK, true)` ellenőrzésen kell átmennie, ami automatikusan igaz lesz.)

- [ ] **Step 2: `newEgyebKoltseg()` — `netto_osszeg` bind**

```php
// Előtte:
            $query = "INSERT INTO egyeb_koltsegek (admin, irany, kategoria, kamion_id, potkocsi_id, furgon_id, datum, megnevezes, szamlaszam, osszeg, deviza, eredeti_osszeg, arfolyam, megjegyzes)
                      VALUES (:admin, :irany, :kategoria, :kamion_id, :potkocsi_id, :furgon_id, :datum, :megnevezes, :szamlaszam, :osszeg, :deviza, :eredeti_osszeg, :arfolyam, :megjegyzes)";
// Utána:
            $query = "INSERT INTO egyeb_koltsegek (admin, irany, kategoria, kamion_id, potkocsi_id, furgon_id, datum, megnevezes, szamlaszam, osszeg, deviza, eredeti_osszeg, netto_osszeg, arfolyam, megjegyzes)
                      VALUES (:admin, :irany, :kategoria, :kamion_id, :potkocsi_id, :furgon_id, :datum, :megnevezes, :szamlaszam, :osszeg, :deviza, :eredeti_osszeg, :netto_osszeg, :arfolyam, :megjegyzes)";
```

A bind-ok közé, az `:eredeti_osszeg` bind UTÁN:

```php
            $stmt->bindValue(':netto_osszeg', empty($data['netto_osszeg']) ? null : (float) $data['netto_osszeg']);
```

- [ ] **Step 3: `updateEgyebKoltseg()` — ugyanaz**

```php
// Előtte:
            $query = "UPDATE egyeb_koltsegek SET
                        irany = :irany, kategoria = :kategoria, kamion_id = :kamion_id, potkocsi_id = :potkocsi_id, furgon_id = :furgon_id,
                        datum = :datum, megnevezes = :megnevezes, szamlaszam = :szamlaszam,
                        osszeg = :osszeg, deviza = :deviza, eredeti_osszeg = :eredeti_osszeg, arfolyam = :arfolyam, megjegyzes = :megjegyzes
                      WHERE id = :id AND admin = :admin";
// Utána:
            $query = "UPDATE egyeb_koltsegek SET
                        irany = :irany, kategoria = :kategoria, kamion_id = :kamion_id, potkocsi_id = :potkocsi_id, furgon_id = :furgon_id,
                        datum = :datum, megnevezes = :megnevezes, szamlaszam = :szamlaszam,
                        osszeg = :osszeg, deviza = :deviza, eredeti_osszeg = :eredeti_osszeg, netto_osszeg = :netto_osszeg, arfolyam = :arfolyam, megjegyzes = :megjegyzes
                      WHERE id = :id AND admin = :admin";
```

Ugyanaz a `$stmt->bindValue(':netto_osszeg', ...)` sor az `:eredeti_osszeg` bind után.

(A `getEgyebKoltsegek()`-ben NINCS teendő — `SELECT *`-ot használ, a `netto_osszeg` automatikusan bekerül a visszaadott sorokba, mihelyt az oszlop létezik.)

- [ ] **Step 4: `getKoltsegOsszesito()` — havi bontás bővítése `utdij`-jal**

A `$biztositasHavonta` blokk UTÁN, a `$berTetelek`/`$berHavonta` blokk ELŐTT, új blokk:

```php
            // Útdíj — tisztán kézi/manuálisan rögzített egyeb_koltsegek
            // tétel, nincs másik (on-the-fly) forrása, mint uzemanyag-nak.
            $utdijHavonta = $this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'utdij');
```

A `$honapok = array_unique(array_merge(...))` hívásba bekerül `array_keys($utdijHavonta)`:

```php
            $honapok = array_unique(array_merge(
                array_keys($karbHavonta),
                array_keys($uzemanyagHavonta),
                array_keys($biztositasHavonta),
                array_keys($berHavonta),
                array_keys($utdijHavonta),
                array_keys($egyebKiadasHavonta),
                array_keys($bevetelHavonta)
            ));
```

A `$havi[]` építő ciklusban:

```php
            foreach ($honapok as $honap) {
                $karbantartas = $karbHavonta[$honap] ?? 0;
                $uzemanyag = $uzemanyagHavonta[$honap] ?? 0;
                $biztositas = $biztositasHavonta[$honap] ?? 0;
                $ber = $berHavonta[$honap] ?? 0;
                $utdij = $utdijHavonta[$honap] ?? 0;
                $egyeb = $egyebKiadasHavonta[$honap] ?? 0;
                $bevetel = $bevetelHavonta[$honap] ?? 0;
                $kiadasOsszesen = $karbantartas + $uzemanyag + $biztositas + $ber + $utdij + $egyeb;
                $havi[] = [
                    'honap' => $honap,
                    'bevetel' => $bevetel,
                    'karbantartas' => $karbantartas,
                    'uzemanyag' => $uzemanyag,
                    'biztositas' => $biztositas,
                    'ber' => $ber,
                    'utdij' => $utdij,
                    'egyeb' => $egyeb,
                    'kiadasOsszesen' => $kiadasOsszesen,
                    'netto' => $bevetel - $kiadasOsszesen,
                ];
            }
```

- [ ] **Step 5: `getKoltsegOsszesito()` — jármű szerinti bontás bővítése**

A `foreach ($this->egyebJarmuvenkent('kiado', 'furgon_id', $datumTol, $datumIg, $ceg_id, 'biztositas') as $id => $osszeg) { ... }` blokk UTÁN, a `$bevetelKamiononkent = $egyebBevetelKamiononkent;` sor ELŐTT, új blokk:

```php
            $utdijKamiononkent = $this->egyebJarmuvenkent('kiado', 'kamion_id', $datumTol, $datumIg, $ceg_id, 'utdij');
            $utdijPotkocsinkent = $this->egyebJarmuvenkent('kiado', 'potkocsi_id', $datumTol, $datumIg, $ceg_id, 'utdij');
            $utdijFurgononkent = $this->egyebJarmuvenkent('kiado', 'furgon_id', $datumTol, $datumIg, $ceg_id, 'utdij');
```

A 3 jármű-tipus (`kamion`/`potkocsi`/`furgon`) `foreach ($xIdk as $id) { ... }` ciklusaiban (mindhárom `$jarmuvenkent[] = [...]` blokk előtt) a `$kiadasOsszesen` számítás és a visszaadott tömb bővül `utdij`-jal — pl. a kamion-ágban:

```php
                $karbantartas = $karbKamiononkent[$id] ?? 0;
                $uzemanyag = $uzemanyagKamiononkent[$id] ?? 0;
                $biztositas = $biztositasKamiononkent[$id] ?? 0;
                $utdij = $utdijKamiononkent[$id] ?? 0;
                $egyeb = $egyebKiadasKamiononkent[$id] ?? 0;
                $bevetel = $bevetelKamiononkent[$id] ?? 0;
                $kiadasOsszesen = $karbantartas + $uzemanyag + $biztositas + $utdij + $egyeb;
                $km = $this->kmOsszesito($id, $datumTol, $datumIg);
                $jarmuvenkent[] = [
                    'tipus' => 'kamion',
                    'id' => $id,
                    'rendszam' => $kamionRendszamok[$id],
                    'bevetel' => $bevetel,
                    'karbantartas' => $karbantartas,
                    'uzemanyag' => $uzemanyag,
                    'biztositas' => $biztositas,
                    'utdij' => $utdij,
                    'egyeb' => $egyeb,
                    'kiadasOsszesen' => $kiadasOsszesen,
                    'netto' => $bevetel - $kiadasOsszesen,
                    'bevetelPerKm' => $km['km'] > 0 ? round($bevetel / $km['km'], 1) : null,
                    'kiadasPerKm' => $km['km'] > 0 ? round($kiadasOsszesen / $km['km'], 1) : null,
                    'kmLefedettseg' => $km['osszesNap'] > 0 ? round($km['lefedettNapok'] / $km['osszesNap'] * 100) : null,
                ];
```

Ugyanez a minta (`$utdij = $utdijPotkocsinkent[$id] ?? 0;` / `$utdijFurgononkent[$id] ?? 0;`, `$kiadasOsszesen`-be és a visszaadott tömbbe belefűzve `'utdij' => $utdij,`) a pótkocsi- és furgon-ágban is. A `$xIdk = array_unique(array_merge(...))` 3 hívásába is bekerül a megfelelő `array_keys($utdijXnkent)`.

- [ ] **Step 6: `getKoltsegOsszesito()` — top-level összesítő bővítése**

```php
            $osszesenUzemanyag = array_sum($uzemanyagHavonta);
            $osszesenBiztositas = array_sum($biztositasHavonta);
            $osszesenBer = array_sum($berHavonta);
            $osszesenUtdij = array_sum($utdijHavonta);
            $osszesenEgyeb = array_sum($egyebKiadasHavonta);
            $osszesenKiadas = $osszesenKarbantartas + $osszesenUzemanyag + $osszesenBiztositas + $osszesenBer + $osszesenUtdij + $osszesenEgyeb;
```

A visszaadott `'osszesen' => [...]` tömbben:

```php
                'osszesen' => [
                    'bevetel' => $osszesenBevetel,
                    'karbantartas' => $osszesenKarbantartas,
                    'uzemanyag' => $osszesenUzemanyag,
                    'biztositas' => $osszesenBiztositas,
                    'ber' => $osszesenBer,
                    'utdij' => $osszesenUtdij,
                    'egyeb' => $osszesenEgyeb,
                    'kiadas' => $osszesenKiadas,
                    'netto' => $osszesenBevetel - $osszesenKiadas,
                ],
```

- [ ] **Step 7: `getOsszesenGyors()` — bővítés útdíjjal (a %-delta összevetéshez)**

```php
        $egyebKiadasOsszeg = array_sum($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'egyeb'));
        $utdijOsszeg = array_sum($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'utdij'));
        $bevetelOsszeg = array_sum($this->egyebHavonta('bevetel', $datumTol, $datumIg, $ceg_id));

        $kiadas = $karbOsszeg + $uzemanyagOsszeg + $biztositasOsszeg + $berOsszeg + $utdijOsszeg + $egyebKiadasOsszeg;
```

- [ ] **Step 8: `php8.2 -l` lint**

Run: `php8.2 -l backend/interface/koltsegInterface.php`
Expected: `No syntax errors detected`.

- [ ] **Step 9: Élő teszt — ideiglenes teszt-cégen**

Írd meg és futtasd le `/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_utdij.php`:

```php
<?php
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/db.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/PaginationHelper.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/koltsegInterface.php';

$db = (new Database())->connect();
$db->exec("INSERT INTO admin (email, name, password, torolt) VALUES ('teszt-utdij@example.invalid', 'Teszt Ceg Utdij', 'x', 'N')");
$cegId = (int) $db->lastInsertId();
echo "Teszt ceg id: $cegId\n";

global $koltsegInterface;

$datum = date('Y-m-d');
$r1 = $koltsegInterface->newEgyebKoltseg([
    'ceg_id' => $cegId,
    'irany' => 'kiado',
    'kategoria' => 'utdij',
    'datum' => $datum,
    'megnevezes' => 'Teszt magyar útdíj',
    'osszeg' => 30000,
    'netto_osszeg' => 23622.05,
    'deviza' => 'HUF',
], true);
echo "newEgyebKoltseg (utdij): " . json_encode($r1) . "\n";

$sor = $db->query("SELECT kategoria, osszeg, netto_osszeg FROM egyeb_koltsegek WHERE admin=$cegId")->fetch(PDO::FETCH_ASSOC);
print_r($sor);

$honap = date('Y-m');
$osszesito = $koltsegInterface->getKoltsegOsszesito($cegId, "$honap-01", date('Y-m-t'), true);
echo "getKoltsegOsszesito osszesen.utdij: " . $osszesito['osszesen']['utdij'] . "\n";
echo "getKoltsegOsszesito osszesen.kiadas tartalmazza-e: " . $osszesito['osszesen']['kiadas'] . "\n";

// takarítás
$db->exec("DELETE FROM egyeb_koltsegek WHERE admin=$cegId");
$db->exec("DELETE FROM admin WHERE id=$cegId");
echo "Takaritva.\n";
```

Run: `php8.2 /tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_utdij.php`

Expected: `newEgyebKoltseg` `"success":true`; a `print_r` `kategoria: utdij, osszeg: 30000.00, netto_osszeg: 23622.05`; `osszesen.utdij` = `30000`; `osszesen.kiadas` ≥ `30000` (pontosan `30000`, ha ez az egyetlen tétel a teszt-cégen). Végén "Takaritva."

- [ ] **Step 10: Commit**

```bash
git add backend/interface/koltsegInterface.php
git commit -m "feat(fuvar): add útdíj (toll) expense category to Pénzforgalom"
```

---

### Task 5: Frontend — Útdíj kategória (`Koltsegek.js`)

**Files:**
- Modify: `src/views/admin/Koltsegek.js`

**Interfaces:**
- Consumes: `koltsegInterface.php` `'utdij'` kategória + `netto_osszeg` mező (Task 4).
- Produces: nincs — UI-szintű láncszem.

- [ ] **Step 1: Ikon import**

A `react-icons/pi` import-listába (a fájl tetején) bekerül `PiRoadHorizonLight`.

- [ ] **Step 2: `KATEGORIA_BADGE` bővítése**

```js
const KATEGORIA_BADGE = {
  uzemanyag: { label: "Üzemanyag", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  karbantartas: { label: "Karbantartás", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  biztositas: { label: "Biztosítás", className: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" },
  ber: { label: "Fizetés", className: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
  utdij: { label: "Útdíj", className: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
};
```

- [ ] **Step 3: `emptyEgyebTetel()` bővítése**

```js
const emptyEgyebTetel = (irany = "kiado") => ({
  irany,
  kategoria: "",
  datum: new Date().toISOString().slice(0, 10),
  megnevezes: "",
  szamlaszam: "",
  osszeg: "",
  deviza: "HUF",
  eredeti_osszeg: "",
  netto_osszeg: "",
  kamion_id: "",
  potkocsi_id: "",
  furgon_id: "",
  megjegyzes: "",
});
```

- [ ] **Step 4: `handleAddSubmit()` — `netto_osszeg` a payloadba**

A `fetchAction(action, {...})` hívás objektumában, az `eredeti_osszeg` sor UTÁN:

```js
        eredeti_osszeg: devizas ? ujTetel.eredeti_osszeg : null,
        netto_osszeg: ujTetel.netto_osszeg || null,
```

- [ ] **Step 5: `openEditing()` — `netto_osszeg` betöltése szerkesztéskor**

```js
    setUjTetel({
      irany: row.irany,
      kategoria: row.kategoria || "",
      datum: row.datum,
      megnevezes: row.megnevezes,
      szamlaszam: row.szamlaszam || "",
      osszeg: row.osszeg,
      deviza: row.deviza || "HUF",
      eredeti_osszeg: row.eredeti_osszeg || "",
      netto_osszeg: row.netto_osszeg || "",
      kamion_id: row.kamion_id || "",
      potkocsi_id: row.potkocsi_id || "",
      furgon_id: row.furgon_id || "",
      megjegyzes: row.megjegyzes || "",
```

(A többi mező változatlan marad a blokkban.)

- [ ] **Step 6: Kategória-szűrő `<select>` — új, NEM letiltott opció**

A `<option value="uzemanyag">Üzemanyag</option>` UTÁN:

```jsx
                  <option value="utdij">Útdíj</option>
```

(A `disabled` opciók — karbantartás/biztosítás/fizetés — változatlanok; az útdíj az uzemanyag mintáját követi, mert ennek sincs másik forrása.)

- [ ] **Step 7: "+ Új tétel" modal kategória-select — új opció + nettó mező**

```jsx
              <option value="">Kiadás</option>
              <option value="uzemanyag">Üzemanyag</option>
              <option value="utdij">Útdíj</option>
              <option value="karbantartas">Karbantartás</option>
              <option value="biztositas">Biztosítás</option>
              {isOwnerAdmin && <option value="ber">Fizetés</option>}
```

Közvetlenül e `FormField` (kategória-select) UTÁN, csak akkor renderelve, ha `ujTetel.kategoria === "utdij"`:

```jsx
          {ujTetel.kategoria === "utdij" && (
            <FormField
              type="number"
              label="Nettó összeg (opcionális)"
              name="netto_osszeg"
              value={ujTetel.netto_osszeg}
              onChange={handleUjTetelChange}
              placeholder="Ha az összeg bruttó, itt add meg a nettó (ÁFA nélküli) értéket"
            />
          )}
```

- [ ] **Step 8: `kategoriaChipek` — új chip**

Az `"egyeb"` chip ELŐTT (vagy a `"biztositas"` chip UTÁN, `"egyeb"` előtt):

```js
    {
      key: "utdij",
      label: "Útdíj",
      icon: PiRoadHorizonLight,
      dotClass: "bg-sky-500",
      barClass: "bg-sky-500",
      value: adat.osszesen.utdij,
    },
```

- [ ] **Step 9: `exportColumns` (Jármű szerinti bontás export) — új oszlop**

A `{ key: "biztositas", label: "Biztosítás (Ft)" }` sor UTÁN:

```js
    { key: "utdij", label: "Útdíj (Ft)" },
```

- [ ] **Step 10: Tételek lista Összeg-cellája — nettó összeg másodlagos sor**

A meglévő deviza-blokk (`{row.deviza && row.deviza !== "HUF" && row.eredeti_osszeg && (...)}`) UTÁN, ugyanabban a `<span>`-ben:

```jsx
          {row.netto_osszeg && (
            <span className="block text-xs font-normal text-ink-400 dark:text-ink-500">
              nettó: {formatHuf(row.netto_osszeg)}
            </span>
          )}
```

- [ ] **Step 11: Tailwind rebuild (ha szükséges)**

A fenti osztályok (`bg-sky-50`, `text-sky-700`, `bg-sky-950/50`, `text-sky-300`, `bg-sky-500`) közül ellenőrizd, léteznek-e már a lefordított `tailwind.css`-ben:

Run: `grep -c "bg-sky-500\|bg-sky-50\b" src/assets/styles/tailwind.css`

Ha `0`-t ad vissza bármelyikre, futtasd: `npm run build:tailwind`.

- [ ] **Step 12: Élő ellenőrzés (Playwright)**

1. Nyisd meg `/admin/koltsegek`-et, kattints "+ Új tétel"-re, válaszd az "Útdíj" kategóriát — megjelenik a "Nettó összeg" mező.
2. Vegyél fel egy útdíj-tételt (bruttó összeg + nettó összeg kitöltve), mentsd el.
3. A Tételek listán jelenjen meg a tétel az "Útdíj" jelvénnyel és a nettó összeg másodlagos sorral.
4. A kategória-összetétel rácson jelenjen meg egy "Útdíj" chip a felvett összeggel.
5. A kategória-szűrő legördülőn válaszd ki "Útdíj"-at — csak az útdíj-tételek látszanak.
6. Világos és sötét módban is nézd meg (jelvény szín, chip szín).

Expected: mind a 6 lépés hibaüzenet/vizuális törés nélkül lefut.

- [ ] **Step 13: Commit**

```bash
git add src/views/admin/Koltsegek.js src/assets/styles/tailwind.css
git commit -m "feat(fuvar): add útdíj category UI to Pénzforgalom"
```

---

### Task 6: Backend — profit-riport wrapper metódusok (`koltsegInterface.php`)

**Files:**
- Modify: `backend/interface/koltsegInterface.php`

**Interfaces:**
- Consumes: `getBerKiadasok()`, `egyebHavonta()` (meglévő privát segédfüggvények).
- Produces: 3 új publikus metódus, amiket a 7. feladat (`FuvarInterface`) fog hívni `global $koltsegInterface;`-en keresztül:
  - `getUzemanyagKiadasHavonta($ceg_id, $datumTol, $datumIg): array` — `{honap(YYYY-MM) => osszeg}`
  - `getBerKiadasHavonta($ceg_id, $datumTol, $datumIg): array` — `{honap(YYYY-MM) => osszeg}`
  - `getUtdijKiadasHavonta($ceg_id, $datumTol, $datumIg): array` — `{honap(YYYY-MM) => osszeg}`

- [ ] **Step 1: A 3 metódus megírása**

Az `egyebNemKotott()` metódus UTÁN (a `getKoltsegOsszesito()` ELŐTT), 3 új publikus metódus:

```php
    // A 3 alábbi metódus a `getKoltsegOsszesito()`-ban MÁR meglévő, havi
    // bontású kiadás-számítási logikát teszi kívülről (más interfészből)
    // hívhatóvá — a `FuvarInterface::getStatisztikak()` ezeket használja a
    // fuvarozási profit-riporthoz, a meglévő logika duplikálása nélkül.

    public function getUzemanyagKiadasHavonta($ceg_id, $datumTol, $datumIg) {
        [$tankSzuresSql, $tankSzuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
        $tankStmt = $this->db->prepare(
            "SELECT DATE_FORMAT(datum, '%Y-%m') AS honap, SUM(osszeg) AS osszeg
             FROM tankolasok WHERE admin = :ceg_id AND torolt <> 'I' AND osszeg IS NOT NULL$tankSzuresSql
             GROUP BY honap"
        );
        $tankStmt->bindValue(':ceg_id', $ceg_id);
        foreach ($tankSzuresParams as $k => $v) {
            $tankStmt->bindValue($k, $v);
        }
        $tankStmt->execute();
        $uzemanyagHavonta = [];
        foreach ($tankStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $uzemanyagHavonta[$row['honap']] = (float) $row['osszeg'];
        }
        foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'uzemanyag') as $honap => $osszeg) {
            $uzemanyagHavonta[$honap] = ($uzemanyagHavonta[$honap] ?? 0) + $osszeg;
        }
        return $uzemanyagHavonta;
    }

    public function getBerKiadasHavonta($ceg_id, $datumTol, $datumIg) {
        $berTetelek = $this->getBerKiadasok($ceg_id, $datumTol, $datumIg);
        $berHavonta = [];
        foreach ($berTetelek as $t) {
            $berHavonta[$t['honap']] = ($berHavonta[$t['honap']] ?? 0) + $t['osszeg'];
        }
        foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'ber') as $honap => $osszeg) {
            $berHavonta[$honap] = ($berHavonta[$honap] ?? 0) + $osszeg;
        }
        return $berHavonta;
    }

    public function getUtdijKiadasHavonta($ceg_id, $datumTol, $datumIg) {
        return $this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'utdij');
    }
```

- [ ] **Step 2: `php8.2 -l` lint**

Run: `php8.2 -l backend/interface/koltsegInterface.php`
Expected: `No syntax errors detected`.

- [ ] **Step 3: Élő teszt — konzisztencia-ellenőrzés a `getKoltsegOsszesito()` ellen**

Írd meg és futtasd le `/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_wrapperek.php` — ugyanazon a teszt-cégen és tesztadaton fut le mindkét (a fő `getKoltsegOsszesito()` és az új wrapperek) lekérdezés, és a 2 eredmény ugyanazt kell adja:

```php
<?php
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/db.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/PaginationHelper.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/koltsegInterface.php';

$db = (new Database())->connect();
$db->exec("INSERT INTO admin (email, name, password, ber, torolt) VALUES ('teszt-wrapperek@example.invalid', 'Teszt Ceg Wrapperek', 'x', 400000, 'N')");
$cegId = (int) $db->lastInsertId();
echo "Teszt ceg id: $cegId\n";

global $koltsegInterface;

$honap = date('Y-m');
$datumTol = "$honap-01";
$datumIg = date('Y-m-t');

$koltsegInterface->newEgyebKoltseg([
    'ceg_id' => $cegId, 'irany' => 'kiado', 'kategoria' => 'utdij',
    'datum' => date('Y-m-d'), 'megnevezes' => 'Teszt útdíj', 'osszeg' => 15000, 'deviza' => 'HUF',
], true);

$fo = $koltsegInterface->getKoltsegOsszesito($cegId, $datumTol, $datumIg, true);
$foHaviSor = null;
foreach ($fo['havi'] as $h) {
    if ($h['honap'] === $honap) { $foHaviSor = $h; }
}
echo "getKoltsegOsszesito uzemanyag/ber/utdij: " . json_encode([$foHaviSor['uzemanyag'] ?? 0, $foHaviSor['ber'] ?? 0, $foHaviSor['utdij'] ?? 0]) . "\n";

$uzemanyagW = $koltsegInterface->getUzemanyagKiadasHavonta($cegId, $datumTol, $datumIg);
$berW = $koltsegInterface->getBerKiadasHavonta($cegId, $datumTol, $datumIg);
$utdijW = $koltsegInterface->getUtdijKiadasHavonta($cegId, $datumTol, $datumIg);
echo "wrapperek uzemanyag/ber/utdij: " . json_encode([$uzemanyagW[$honap] ?? 0, $berW[$honap] ?? 0, $utdijW[$honap] ?? 0]) . "\n";

// takarítás
$db->exec("DELETE FROM egyeb_koltsegek WHERE admin=$cegId");
$db->exec("DELETE FROM admin WHERE id=$cegId");
echo "Takaritva.\n";
```

Run: `php8.2 /tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_wrapperek.php`

Expected: a két kiírt JSON-tömb **pontosan egyezik** (`[0, 400000, 15000]` — a `ber` a teszt-cég `admin.ber`-jéből, mert nincs sofőr, csak a csapattag/tulajdonos bér-mezője; `utdij` a felvett 15000-es tételből). Végén "Takaritva."

- [ ] **Step 4: Commit**

```bash
git add backend/interface/koltsegInterface.php
git commit -m "feat(fuvar): expose monthly cost wrappers for cross-interface reuse"
```

---

### Task 7: Backend — Fuvarozási profit-riport (`fuvarInterface.php`)

**Files:**
- Modify: `backend/interface/fuvarInterface.php` (`getStatisztikak()`)

**Interfaces:**
- Consumes: `koltsegInterface::getUzemanyagKiadasHavonta()` / `getBerKiadasHavonta()` / `getUtdijKiadasHavonta()` (Task 6, `global $koltsegInterface;`-en keresztül).
- Produces: `getStatisztikak($ceg_id)` visszaadott `havi[]` elemei kapnak `kiadasOsszesen`/`profit`/`atlagNapiProfit` mezőt; a válasz kap egy új `fuvarozasiProfit` kulcsot (`{honap, bevetel, kiadas, profit}`, az utolsó hónap adataival, vagy `null`-okkal, ha nincs fuvar).

- [ ] **Step 1: `munkanapokHonapban()` privát helper hozzáadása**

A `getStatisztikak()` metódus ELÉ (vagy bármelyik privát helper mellé, pl. a `batchLekerdezes()` után):

```php
    // Egy adott naptári hónap munkanapjainak száma (hétvégék levonva,
    // ünnepnap-lista nélkül — ugyanaz az egyszerűsítés, mint a bér-
    // arányosítási döntésnél). Kizárólag az `atlagNapiProfit` osztójaként
    // használt — a kiadás-számítás maga nem prorat, ld. getStatisztikak()
    // komment.
    private function munkanapokHonapban($honapKulcs) {
        $napokSzama = (int) (new DateTime("$honapKulcs-01"))->format('t');
        $munkanapok = 0;
        for ($nap = 1; $nap <= $napokSzama; $nap++) {
            $datum = new DateTime($honapKulcs . '-' . str_pad($nap, 2, '0', STR_PAD_LEFT));
            if ((int) $datum->format('N') < 6) {
                $munkanapok++;
            }
        }
        return $munkanapok;
    }
```

- [ ] **Step 2: `getStatisztikak()` — a "4. Havi statisztika" blokk bővítése**

A meglévő kód (ami a `$havi` tömböt `atlagFuvardij`/`atlagKmPerFuvar` mezőkkel zárja, majd `ksort`/`array_slice`-szal az utolsó 12 hónapra vágja) UTÁN, MÉG a "5. Pénzügyi dashboard" blokk ELŐTT, új blokk:

```php
        // Fuvarozási profit — a Fuvarok saját bevétele (fuvardij+egyeb_
        // koltseg) mínusz a flotta-szintű üzemanyag+útdíj+bér kiadás,
        // havi bontásban. Ez EGY ÖNÁLLÓ, csak-a-fuvarozásból nézet — a
        // Fuvar-bevétel sosem folyik be a Pénzforgalom fő `egyeb_koltsegek`
        // bevétel-táblájába, tehát ez a szám NEM egyezik a Pénzforgalom
        // fő "Nettó eredmény"-ével (ld. design spec "Nem célok").
        global $koltsegInterface;
        $elsoHonap = $havi[0]['honap'] ?? null;
        $utolsoHonapKulcs = $havi[count($havi) - 1]['honap'] ?? null;
        if ($elsoHonap && $utolsoHonapKulcs) {
            $koltsegDatumTol = $elsoHonap . '-01';
            $koltsegDatumIg = date('Y-m-t', strtotime($utolsoHonapKulcs . '-01'));
            $uzemanyagKiadasHavonta = $koltsegInterface->getUzemanyagKiadasHavonta($ceg_id, $koltsegDatumTol, $koltsegDatumIg);
            $utdijKiadasHavonta = $koltsegInterface->getUtdijKiadasHavonta($ceg_id, $koltsegDatumTol, $koltsegDatumIg);
            $berKiadasHavonta = $koltsegInterface->getBerKiadasHavonta($ceg_id, $koltsegDatumTol, $koltsegDatumIg);
        } else {
            $uzemanyagKiadasHavonta = [];
            $utdijKiadasHavonta = [];
            $berKiadasHavonta = [];
        }
        foreach ($havi as &$h) {
            $uzemanyagKiadas = $uzemanyagKiadasHavonta[$h['honap']] ?? 0;
            $utdijKiadas = $utdijKiadasHavonta[$h['honap']] ?? 0;
            $berKiadas = $berKiadasHavonta[$h['honap']] ?? 0;
            $h['kiadasOsszesen'] = round($uzemanyagKiadas + $utdijKiadas + $berKiadas, 2);
            $h['profit'] = round($h['bevetelOsszesen'] - $h['kiadasOsszesen'], 2);
            $munkanapok = $this->munkanapokHonapban($h['honap']);
            $h['atlagNapiProfit'] = $munkanapok > 0 ? round($h['profit'] / $munkanapok, 2) : 0;
        }
        unset($h);

        $utolsoHonapSor = end($havi);
        reset($havi);
        $fuvarozasiProfit = [
            'honap' => $utolsoHonapSor['honap'] ?? null,
            'bevetel' => $utolsoHonapSor['bevetelOsszesen'] ?? 0,
            'kiadas' => $utolsoHonapSor['kiadasOsszesen'] ?? 0,
            'profit' => $utolsoHonapSor['profit'] ?? 0,
        ];
```

- [ ] **Step 3: A visszatérési tömb bővítése `fuvarozasiProfit`-tal**

A `return [...]` blokkban, a `'penzugyiDashboard' => [...]` UTÁN:

```php
            'penzugyiDashboard' => [
                'kintlevoseg' => round($kintlevoseg, 2),
                'lejartSzamlakSzama' => $lejartSzamlak,
                'fizetesreVarokSzama' => $fizetesreVarokSzama,
                'varhatoBevetel' => round($varhatoBevetel, 2),
            ],
            'fuvarozasiProfit' => $fuvarozasiProfit,
        ];
```

- [ ] **Step 4: `php8.2 -l` lint**

Run: `php8.2 -l backend/interface/fuvarInterface.php`
Expected: `No syntax errors detected`.

- [ ] **Step 5: Élő teszt — teljes P&L-számítás ellenőrzése**

Írd meg és futtasd le `/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_profit.php`:

```php
<?php
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/db.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/PaginationHelper.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/koltsegInterface.php';
require_once '/home/psadmin/szikoratransz/szikoratransz/backend/interface/fuvarInterface.php';

$db = (new Database())->connect();
$db->exec("INSERT INTO admin (email, name, password, ber, torolt) VALUES ('teszt-profit@example.invalid', 'Teszt Ceg Profit', 'x', 500000, 'N')");
$cegId = (int) $db->lastInsertId();
echo "Teszt ceg id: $cegId\n";

global $koltsegInterface, $fuvarInterface;

$honap = date('Y-m');
$ma = date('Y-m-d');

// 2 fuvar (bevétel) ebben a hónapban
$db->exec("INSERT INTO fuvarok (admin, teljesites_datuma, felrako, lerako, fuvardij, egyeb_koltseg, allapot, torolt)
  VALUES ($cegId, '$ma', 'Teszt A', 'Teszt B', 150000, 0, 'rogzitett', 'N'),
         ($cegId, '$ma', 'Teszt C', 'Teszt D', 100000, 5000, 'rogzitett', 'N')");

// üzemanyag + útdíj kiadás ebben a hónapban
$koltsegInterface->newEgyebKoltseg(['ceg_id' => $cegId, 'irany' => 'kiado', 'kategoria' => 'uzemanyag', 'datum' => $ma, 'megnevezes' => 'Teszt uzemanyag', 'osszeg' => 40000, 'deviza' => 'HUF'], true);
$koltsegInterface->newEgyebKoltseg(['ceg_id' => $cegId, 'irany' => 'kiado', 'kategoria' => 'utdij', 'datum' => $ma, 'megnevezes' => 'Teszt utdij', 'osszeg' => 10000, 'deviza' => 'HUF'], true);

$statisztika = $fuvarInterface->getStatisztikak($cegId);
$honapSor = null;
foreach ($statisztika['haviStatisztika'] as $h) {
    if ($h['honap'] === $honap) { $honapSor = $h; }
}
echo "Havi sor: " . json_encode($honapSor) . "\n";
echo "fuvarozasiProfit: " . json_encode($statisztika['fuvarozasiProfit']) . "\n";

$varhatoBevetel = 250000; // 150000 + 100000 + 5000 egyéb költség is bevétel-oldali a fuvarok.osszesen definíció szerint
$varhatoKiadas = 40000 + 10000 + 500000; // uzemanyag + utdij + a teszt-ceg admin.ber-je
$varhatoProfit = $varhatoBevetel - $varhatoKiadas;
echo "Varhato bevetel/kiadas/profit: $varhatoBevetel / $varhatoKiadas / $varhatoProfit\n";
echo (abs($honapSor['profit'] - $varhatoProfit) < 0.01 ? "OK: egyezik\n" : "HIBA: nem egyezik\n");

// takarítás
$db->exec("DELETE FROM fuvarok WHERE admin=$cegId");
$db->exec("DELETE FROM egyeb_koltsegek WHERE admin=$cegId");
$db->exec("DELETE FROM admin WHERE id=$cegId");
echo "Takaritva.\n";
```

Run: `php8.2 /tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/5d392481-c281-44f3-b1ce-c71c77b8a13c/scratchpad/teszt_profit.php`

Expected: a `Havi sor` JSON tartalmazza `bevetelOsszesen: 255000` (150000+100000+5000), `kiadasOsszesen: 550000`, `profit: -295000`; a script végén "OK: egyezik"; `fuvarozasiProfit` ugyanezt az adatot ismétli meg (mivel ez az egyetlen, azaz egyben az "utolsó" hónap). Végén "Takaritva."

(A várt profit negatív ebben a mesterséges tesztben, mert a teszt-cég `admin.ber`-je — 500 000 Ft — jóval nagyobb, mint a 2 teszt-fuvar bevétele; ez nem hiba, csak a teszt-adat mértéke. A lényeg a képlet helyessége, nem a szám előjele.)

- [ ] **Step 6: Commit**

```bash
git add backend/interface/fuvarInterface.php
git commit -m "feat(fuvar): add fleet-wide monthly profit calculation to getStatisztikak"
```

---

### Task 8: Frontend — Fuvarozási profit-riport UI (`StatisztikaDashboard.js`)

**Files:**
- Modify: `src/components/Fuvarok/StatisztikaDashboard.js`

**Interfaces:**
- Consumes: `getFuvarStatisztikak` action válaszának `haviStatisztika[].kiadasOsszesen/profit/atlagNapiProfit` és `fuvarozasiProfit` mezői (Task 7).
- Produces: nincs — ez a lánc utolsó, UI-szintű láncszeme.

- [ ] **Step 1: Ikon-import bővítése**

A meglévő `react-icons/pi` import-listába kerül: `PiTrendDownLight` (a negatív profit KPI-hoz — a `PiChartLineUpLight` már importálva van a pozitív esethez).

- [ ] **Step 2: Új KPI-sor a lap tetején (üres-állapot védelemmel)**

A meglévő `<div className="grid grid-cols-2 gap-3 md:grid-cols-4">...</div>` (Kintlévőség/Lejárt/Fizetésre vár/Várható bevétel) blokk UTÁN, a "Havi alakulás" `Szekcio`-kat tartalmazó `<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">` ELŐTT. Az egész blokk `adatok.fuvarozasiProfit.honap` ellen védve — ha `null` (nincs egyetlen teljesített fuvar sem), a `haviCimke()` hívása (ami `honap.split("-")`-ot hív) hibázna, ezért a teljes KPI-sor csak akkor renderelődik, ha van érdemi hónap:

```jsx
      {adatok.fuvarozasiProfit.honap && (
        <div>
          <p className="mb-2 text-xs text-ink-400 dark:text-ink-500">
            Fuvarozási profit ({haviCimke(adatok.fuvarozasiProfit.honap)}) — csak a
            fuvarokból számított bevétel/kiadás, nem egyezik meg a Pénzforgalom fő Nettó
            eredményével.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CardStats
              layout="row"
              tone="neutral"
              statIcon={PiCoinsLight}
              statTitle={forint(adatok.fuvarozasiProfit.bevetel)}
              statSubtitle="Bevétel (fuvarokból)"
            />
            <CardStats
              layout="row"
              tone="neutral"
              statIcon={PiGasPumpLight}
              statTitle={forint(adatok.fuvarozasiProfit.kiadas)}
              statSubtitle="Kiadás (üzemanyag+útdíj+bér)"
            />
            <CardStats
              layout="row"
              tone={adatok.fuvarozasiProfit.profit >= 0 ? "positive" : "danger"}
              statIcon={adatok.fuvarozasiProfit.profit >= 0 ? PiChartLineUpLight : PiTrendDownLight}
              statTitle={forint(adatok.fuvarozasiProfit.profit)}
              statSubtitle="Profit"
            />
          </div>
        </div>
      )}
```

(`PiGasPumpLight` importálandó, ha még nincs — ellenőrizd a fájl import-listáját; ha hiányzik, add hozzá.)

- [ ] **Step 3: "Havi alakulás" táblázat — 3 új oszlop**

```jsx
        <Szekcio
          cim="Havi alakulás (utolsó 12 hónap)"
          icon={PiCalendarBlankLight}
          ures="Nincs teljesített fuvar."
          oszlopok={[
            { key: "honap", label: "Hónap", render: (s) => haviCimke(s.honap) },
            { key: "fuvarokSzama", label: "Fuvarok", align: "right" },
            { key: "bevetelOsszesen", label: "Bevétel", align: "right", render: (s) => forint(s.bevetelOsszesen) },
            { key: "kiadasOsszesen", label: "Kiadás", align: "right", render: (s) => forint(s.kiadasOsszesen) },
            {
              key: "profit",
              label: "Profit",
              align: "right",
              render: (s) => (
                <span className={s.profit < 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                  {forint(s.profit)}
                </span>
              ),
            },
            { key: "atlagNapiProfit", label: "Átlag napi profit", align: "right", render: (s) => forint(s.atlagNapiProfit) },
            { key: "atlagFuvardij", label: "Átlag díj", align: "right", render: (s) => forint(s.atlagFuvardij) },
            { key: "atlagKmPerFuvar", label: "Átlag km/fuvar", align: "right" },
          ]}
          sorok={adatok.haviStatisztika}
        />
```

- [ ] **Step 4: Élő ellenőrzés (Playwright)**

1. Nyisd meg `/admin/fuvarok` "Statisztikák" fülét egy olyan admin-munkamenettel, ahol van legalább 1 teljesített fuvar és legalább 1 üzemanyag/útdíj/bér-kiadás — ellenőrizd, hogy a KPI-sor és a Havi alakulás táblázat új oszlopai megjelennek, helyes (nem `NaN`/`undefined`) értékekkel.
2. Egy ideiglenes, teljesen üres teszt-cégen (0 fuvar) ellenőrizd, hogy a KPI-sor nem jelenik meg és nem dob JS-hibát (konzol ellenőrzése).
3. Világos és sötét módban is nézd meg.

Expected: mindhárom pont hibaüzenet/vizuális törés nélkül.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fuvarok/StatisztikaDashboard.js
git commit -m "feat(fuvar): show fleet-wide monthly profit report on Fuvarok Statisztikák tab"
```

---

### Task 9: Teljes regressziós ellenőrzés és lezárás

**Files:** nincs módosítás — csak ellenőrzés.

- [ ] **Step 1: A meglévő Pénzforgalom-oldal nem tört el**

Nyisd meg `/admin/koltsegek`-et egy valós (nem teszt-) admin-munkamenettel — a KPI-sor (Bevétel/Kiadás/Nettó), a kategória-összetétel rács, a Havi alakulás grafikon (`CashflowChart`) és a Jármű szerinti bontás tábla mind ugyanazokat a számokat mutatja, mint a Task 4/5 előtt (az útdíj hozzáadása nem torzíthatja el a MEGLÉVŐ kategóriák összegét — csak egy 5. bucketet ad hozzá).

- [ ] **Step 2: A meglévő jármű-adatlapok nem törtek el**

Nyiss meg egy meglévő kamiont/furgont/pótkocsit `/admin/kamionok` (stb.) listából — minden korábbi mező (rendszám, méret, lejárati dátumok, biztosítás) helyesen betöltődik és menthető, a teherbírás mező üresen jelenik meg (ha korábban nem lett kitöltve).

- [ ] **Step 3: Élő ellenőrzés — teljes golden path egy ideiglenes teszt-cégen**

Egy új, csak erre a célra létrehozott ideiglenes teszt-cégen, admin-munkamenettel, Playwright-tal:
1. Vegyél fel egy kamiont teherbírással.
2. Vegyél fel egy útdíj-tételt a Pénzforgalomban.
3. Vegyél fel (vagy már meglévő OCR-alapú Fuvar-folyamattal hozz létre) 1-2 fuvart, állítsd `teljesitve`-re.
4. Nyisd meg a Fuvarok "Statisztikák" fülét — a profit-KPI-sor és a Havi alakulás tábla helyes, a bevétel/kiadás/profit szám kézzel is visszaszámolható.
5. Töröld a teszt-adatokat (fuvarok, egyeb_koltsegek, kamion, a teszt-cég maga).

- [ ] **Step 4: `docs/superpowers/specs/2026-07-26-fuvar-profit-teherbiras-utdij-design.md` frissítése**

Ha az implementáció során bármi eltért a specifikációtól (pl. egy mezőnév, egy UI-elhelyezés), frissítsd a design-dokumentumot, hogy tükrözze a tényleges végállapotot.

- [ ] **Step 5: `CLAUDE.md` frissítése**

A projekt konvenciója szerint (ld. CLAUDE.md "CLAUDE.md karbantartása minden nagyobb módosítás után") vegyél fel egy rövid, új szakaszt a `CLAUDE.md`-be: mi készült el (teherbírás mező, útdíj kategória, fuvarozási profit-riport), és — ha van — milyen gotcha-t/tanulságot érdemes megjegyezni a jövőre (pl. ha a `munkanapokHonapban()` vagy a wrapper-metódusok kódolása közben bármi meglepő derült ki).

- [ ] **Step 6: Végső commit (ha a fenti lépések bármelyike módosítást igényelt)**

```bash
git add docs/superpowers/specs/2026-07-26-fuvar-profit-teherbiras-utdij-design.md CLAUDE.md
git commit -m "docs: update spec and CLAUDE.md after fuvar profit/útdíj/teherbírás implementation"
```
