# Fuvar profit-riport, útdíj-nyilvántartás, jármű teherbírás

Dátum: 2026-07-26

## Háttér

A felhasználó egy heti excel-táblázatban (`Weboldal.xlsx`) vezette a fuvarozás
teljes P&L-jét: egyetlen sofőr+autó kombóra vetítve, hetente, bevétel
(fuvarok) mínusz kiadás (üzemanyag, magyar/külföldi útdíj, sofőr napi bére) =
profit. A cél, hogy ezt a rendszer (a most már meglévő OCR-alapú Fuvar modul
+ Pénzforgalom) teljesen kiváltsa, és az excel elhagyható legyen.

Az elemzés (a Fuvar modul + a Pénzforgalom/Sofőrök/Jármű modulok mai
állapotának áttekintése) 3, egymástól nagyrészt független hiányosságot
azonosított:

1. **Jármű teherbírása (tonna)** — sehol nincs tárolva.
2. **Útdíj-nyilvántartás** (hazai/külföldi, bruttó/nettó) — nincs dedikált
   kategória, csak kézzel, kategória nélkül rögzíthető.
3. **Fuvarozási profit-riport** (bevétel mínusz üzemanyag+útdíj+bér, heti/havi
   bontásban) — a Fuvar Statisztikák fül ma csak a bevétel oldalt követi.

Az "átlagos üzemanyagár/fogyasztás" excel-mező **tudatosan nem kerül át** —
a rendszer már ma is a VALÓS tankolási adatból (tankolás napló + MOL-import)
számol, ami pontosabb egy előre becsült átlagnál. Ez a spec ezt a mezőt nem
valósítja meg.

## Célok

- Jármű adatlapokon (kamion/furgon/pótkocsi) egy teherbírás (tonna) mező.
- A Pénzforgalomban egy önálló "Útdíj" kategória, hazai/külföldi (a meglévő
  `deviza` mezőre építve) és bruttó/nettó megkülönböztetéssel.
- A Fuvarok "Statisztikák" fülén egy flotta-szintű, havi bontású
  "Fuvarozási profit" riport (bevétel − üzemanyag − útdíj − bér), a meglévő
  bér/üzemanyag/biztosítás-számítási logika újrafelhasználásával.

## Nem célok (explicit kizárva)

- Nincs sofőrönkénti/járművenkénti profit-bontás (csak flotta-összesített).
- Nincs egyedi (ad hoc) dátumtartomány-választó a profit-riporthoz — a
  meglévő "Havi statisztika (utolsó 12 hónap)" minta bővül, nem kap saját
  `PeriodControl`-t.
- Nincs "átlagos üzemanyagár/fogyasztás" beállítási mező.
- A Fuvar-bevétel (fuvarok.fuvardij+egyeb_koltseg) **nem** folyik be
  automatikusan a Pénzforgalom fő `egyeb_koltsegek` bevétel-táblájába — ez a
  profit-riport egy ÖNÁLLÓ, csak-a-fuvarozásból nézet, nem a cég teljes P&L-je.
  Ezt a UI-n (tooltip/magyarázó szöveg) is jelezni kell, nehogy összekeveredjen
  a Pénzforgalom fő "Nettó eredmény" számával.

## 1. Jármű teherbírása

### Adatbázis

`backend/sql/39.sql` (új fájl — a legutóbbi, `38.sql`, már commitolva van):

```sql
ALTER TABLE kamion ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE furgon ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE potkocsi ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
```

Tonna, 2 tizedesjegy (pl. 7.50, 40.00). Nincs lista (`listaInterface.php`
`TIPUSOK`), mert ez jármű-specifikus műszaki adat, nem kategorikus érték
(ld. a korábbi döntés a teherbírás mezőtípusáról).

### Backend

`backend/interface/kamionInterface.php`, `furgonInterface.php`,
`potkocsiInterface.php` — mindhárom `newX()`/`updateX()` INSERT/UPDATE
lekérdezése bővül `teherbiras`-szal, ugyanúgy, mint a `meret` mezőnél
(bind: üres string esetén NULL, egyébként `(float)`).

### Frontend

- `src/components/Cards/CardJarmuAdatokForm.js` (kamion),
  `CardFurgonAdatokForm.js`, `CardPotkocsiAdatokForm.js` — egy új szám
  mező ("Teherbírás (t)") a "Méret" mező mellett/után, `type="number"`,
  `step="0.1"`.
- `src/components/Table/CardTableForKamionok.js`,
  `CardTableForFurgonok.js`, `CardTableForPotkocsi.js` — egy opcionális
  "Teherbírás" oszlop (csak akkor releváns, ha a lista amúgy sem
  zsúfolt — ha az audit-tapasztalat szerint helyszűke van, `mobileHidden:
  true`-val).

## 2. Útdíj-nyilvántartás

### Adatbázis

Ugyanabban a `39.sql`-ben:

```sql
ALTER TABLE egyeb_koltsegek ADD COLUMN netto_osszeg DECIMAL(10,2) NULL AFTER eredeti_osszeg;
```

`netto_osszeg` — informális, **soha nem összesített/aggregált** mező
(ugyanaz az elv, mint `eredeti_osszeg`/`arfolyam` a deviza-párnál): csak
megjelenítésre, az `osszeg` (bruttó) marad az egyetlen forrás, amit minden
riport összesít. Nem kategória-specifikus a sémában (bármely tételnél
kitölthető), de a form UI-n csak Útdíj kategóriánál jelenik meg mezőként.

A hazai/külföldi megkülönböztetéshez **nincs új oszlop** — a meglévő
`deviza` mező adja (HUF = hazai, EUR/más = külföldi), ugyanaz az
infrastruktúra, mint a többi devizás tételnél.

### Backend (`backend/interface/koltsegInterface.php`)

- `KATEGORIAK` bővül: `['uzemanyag', 'karbantartas', 'biztositas', 'ber',
  'utdij']`.
- `normalizKategoria()` — az `'utdij'` bármely szerepkörnek megengedett
  (nincs admin-only megszorítás rajta, szemben `'ber'`-rel).
- `getKoltsegOsszesito()` — egy új `$utdijHavonta = $this->egyebHavonta('kiado',
  $datumTol, $datumIg, $ceg_id, 'utdij');` bucket, PONTOSAN úgy bekötve a
  `$havi[]` tömbbe és a `$kiadasOsszesen` összegzésbe, mint `uzemanyag`
  (mert az útdíjnak — a karbantartás/biztosítás/bérrel szemben — nincs
  másik, on-the-fly forrása, tisztán kézi/importált `egyeb_koltsegek`
  tétel). Hasonlóan a jármű-szerinti bontásban (`egyebJarmuvenkent(...,
  'utdij')`) is megjelenik, ha a tételhez van jármű rendelve.
- `newEgyebKoltseg()`/`updateEgyebKoltseg()` — a `netto_osszeg` mező
  bind-olása (üres esetén NULL, egyébként `(float)`), ugyanolyan mintával,
  mint `eredeti_osszeg`.
- `getEgyebKoltsegek()` — a `netto_osszeg` mező bekerül a SELECT-be és a
  visszaadott sorokba (semmilyen aggregációba NEM).

### Frontend (`src/views/admin/Koltsegek.js`)

- `KATEGORIA_BADGE` bővül: `utdij: { label: "Útdíj", className: "bg-sky-50
  text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" }` (a meglévő
  kategóriáktól eltérő szín, hogy vizuálisan is megkülönböztethető legyen).
- Kategória-szűrő `<select>` (a Tételek fülön) — új, **NEM letiltott**
  opció: `<option value="utdij">Útdíj</option>` (mert — az uzemanyag-hoz
  hasonlóan — ez tisztán erről a listáról szűrhető vissza, nincs másik
  adatforrása).
- "+ Új tétel" modal kategória-select — új `<option value="utdij">Útdíj
  </option>`. Ha `ujTetel.kategoria === "utdij"`, megjelenik egy "Nettó
  összeg (opcionális)" `FormField` (csak akkor van értelme, ha a bruttó
  összeget is megadta).
- `kategoriaChipek` (kategória-összetétel rács) — új chip: `{ key:
  "utdij", label: "Útdíj", icon: PiRoadHorizonLight, dotClass/barClass:
  "bg-sky-500", value: adat.osszesen.utdij }` (`PiRoadHorizonLight` már
  létezik a `react-icons/pi` csomagban, ellenőrizve).
- `exportColumns` (Jármű szerinti bontás export) — új oszlop: `{ key:
  "utdij", label: "Útdíj (Ft)" }`.
- A Tételek lista Összeg-cellájában, ha `row.netto_osszeg` van kitöltve,
  egy kisbetűs "nettó: X Ft" alsó sor (ugyanaz a mintája, mint a devizás
  `eredeti_osszeg` másodlagos sorának).

## 3. Fuvarozási profit-riport

### Backend

**`backend/interface/koltsegInterface.php`** — 3 új, publikus wrapper-
metódus, amik a MEGLÉVŐ, már tesztelt privát segédfüggvényeket hívják (a
`getKoltsegOsszesito()` saját törzsét NEM módosítjuk ezen a ponton, csak
kívülről hívhatóvá tesszük ugyanazt a logikát):

```php
// Havi bontásban, {honap(YYYY-MM) => osszeg} — tankolás + egyeb_koltsegek(uzemanyag)
public function getUzemanyagKiadasHavonta($ceg_id, $datumTol, $datumIg) { ... }

// Havi bontásban — getBerKiadasok() (user.ber/admin.ber, elapsed hónapok) + egyeb_koltsegek(ber)
public function getBerKiadasHavonta($ceg_id, $datumTol, $datumIg) { ... }

// Havi bontásban — tisztán egyeb_koltsegek(utdij)
public function getUtdijKiadasHavonta($ceg_id, $datumTol, $datumIg) { ... }
```

Mindhárom belül ugyanazt csinálja, amit `getKoltsegOsszesito()` már ma is
csinál az adott kategóriára — csak külön, hívható metódusként, hogy a
`FuvarInterface` ne duplikálja a logikát.

**`backend/interface/fuvarInterface.php`** — `getStatisztikak($ceg_id)`
bővül: a meglévő "Havi statisztika" (`$havi[]`) tömb elemei kapnak 3 új
mezőt:

- `kiadasOsszesen` = az adott hónapra eső üzemanyag + útdíj + bér
  (a fenti 3 wrapper hívása `global $koltsegInterface;`-en keresztül,
  ugyanaz a cross-interface minta, mint `ApiHandler::getEsemenyek()`-nél
  a `$fuvarInterface`-re).
- `profit` = `bevetelOsszesen - kiadasOsszesen` (a `bevetelOsszesen` a MÁR
  MEGLÉVŐ, fuvarok-alapú havi bevétel — nem az `egyeb_koltsegek` bevétel).
- `atlagNapiProfit` = `profit / munkanapokHonapban($honap)` — egy új,
  privát `munkanapokHonapban($honapKulcs)` segédfüggvény **a
  `FuvarInterface`-ben** (hétvégék levonva a naptári napokból, ünnepnap-
  lista nélkül). Grep-pel megerősítve, hogy a kódbázisban sehol máshol
  nincs ilyen munkanap-számoló segédfüggvény — ez egy önálló, új helper,
  nem duplikáció.

**Fontos pontosítás a bérköltség-számításhoz** (a korábbi "napi bér
arányosítás" döntés tényleges megvalósítása): a `getBerKiadasok()` (amit
`getBerKiadasHavonta()` becsomagol) MÁR MA IS havi granularitású — egy
teljes, már elkezdődött/lezárult hónapra a teljes havi bért számolja el
(nem néz napi bontást), és a folyamatban lévő hónapot is beleszámítja
(csak a JÖVŐBELI hónapokat zárja ki). Mivel ez a riport kizárólag teljes
naptári hónapokban gondolkodik (nincs egyedi dátumtartomány), a "napi bér
= havi bér / munkanapok" arányosítás a KIADÁS-számításban nem jelenik meg
külön lépésként — a teljes hónapra vetítve ez matematikailag ugyanaz,
mintha simán a havi bért vennénk (napi_bér × a hónap munkanapjai = havi
bér). A "napi bér" gondolat egyetlen ténylegesen látható helye az
`atlagNapiProfit` OSZTÓJA (a fenti `munkanapokHonapban()`), nem a
kiadás-összeg maga.

A `getStatisztikak()` visszatérési értéke emellett kap egy `fuvarozasiProfit`
kulcsot is, ami a `$havi` tömb UTOLSÓ (legfrissebb) elemének
bevétel/kiadás/profit hármasát ismétli meg egy dedikált objektumként (a
frontend KPI-sor ezt olvassa, nem kell neki tudnia, melyik a "legutolsó"
elem a tömbben):

```php
'fuvarozasiProfit' => [
    'honap' => $utolsoHonap['honap'] ?? null,
    'bevetel' => $utolsoHonap['bevetelOsszesen'] ?? 0,
    'kiadas' => $utolsoHonap['kiadasOsszesen'] ?? 0,
    'profit' => $utolsoHonap['profit'] ?? 0,
],
```

Ha nincs egyetlen teljesített fuvar sem, minden mező 0/null — a frontend
ezt "Nincs még adat" szöveggel kezeli (ugyanaz a minta, mint az `ures`
propnál a `Szekcio` komponensben).

### Frontend (`src/components/Fuvarok/StatisztikaDashboard.js`)

- Új, 3-elemes `CardStats layout="row"` KPI-sor a lap tetején (a meglévő
  Kintlévőség/Lejárt/Fizetésre vár/Várható bevétel sor ALATT, külön
  csoportban, "Fuvarozási profit (ez a hónap)" mini-címmel): Bevétel
  (neutral), Kiadás (neutral), Profit (`tone` a profit előjele szerint:
  `profit >= 0 ? "positive" : "danger"`).
- A KPI-sor felett/mellett egy rövid, szürke magyarázó szöveg: "Csak a
  fuvarokból számított bevétel/kiadás — nem egyezik meg a Pénzforgalom
  fő Nettó eredményével." (a Nem célok szakaszban leírt félreértés
  megelőzésére).
- A "Havi alakulás (utolsó 12 hónap)" `Szekcio` táblázata 3 új oszloppal
  bővül: `kiadasOsszesen` ("Kiadás", `forint()`-tal formázva),
  `profit` ("Profit", `forint()`-tal, a cella szövegszíne piros, ha
  negatív), `atlagNapiProfit` ("Átlag napi profit").

### Adatfolyam-összefoglaló

```
fuvarok (bevétel, havonta)  ─┐
tankolasok + egyeb_koltsegek  ├─► FuvarInterface::getStatisztikak()
  (uzemanyag, havonta)        │      └─ havi[].kiadasOsszesen/profit/atlagNapiProfit
egyeb_koltsegek (utdij)       │      └─ fuvarozasiProfit (utolsó hónap)
user.ber/admin.ber + egyeb_  ─┘
  koltsegek (ber, havonta)
```

## Tesztelési terv

A projekt szabálya szerint (CLAUDE.md: "Szerver oldali módosítások
kritikus tesztelése") minden backend-változást élőben, a helyi DB-n kell
futtatni, nem csak statikus átolvasással:

1. `39.sql` lefuttatása a helyi `kamion` adatbázison (`mysql -uroot
   kamion < backend/sql/39.sql`), `SHOW COLUMNS` ellenőrzéssel mindhárom
   táblán + `egyeb_koltsegek`-en.
2. `php8.2 -l` minden módosított PHP fájlon.
3. Egy ideiglenes teszt-cégen (nem az éles `admin=1` fiókon): teherbírás
   mentése egy kamionon/furgonon/pótkocsin, listában megjelenés
   ellenőrzése.
4. Egy útdíj-tétel felvétele HUF-ban (hazai) és EUR-ban (külföldi),
   nettó összeggel — ellenőrzés, hogy megjelenik a Tételek listán, a
   kategória-összetétel rácson, és beleszámít a `getKoltsegOsszesito()`
   `kiadasOsszesen`/`netto` értékébe.
5. Legalább 2 hónapra szóló teszt-fuvar (`fuvardij`, `teljesites_datuma`)
   + hozzá tartozó üzemanyag/útdíj/bér tétel felvétele, majd a
   `getFuvarStatisztikak` válaszának manuális, kalkulátoros
   visszaellenőrzése (bevétel−kiadás=profit, profit/munkanapok=napi
   profit) legalább egy hónapra.
6. Playwright: mindhárom jármű-form + Pénzforgalom "+ Új tétel" (útdíj
   ággal) + Fuvarok "Statisztikák" fül vizuális ellenőrzése, világos és
   sötét módban is.
7. Teszt-adatok törlése/visszaállítása a futtatás után.

## Végrehajtás utáni eltérések a tervtől (Task 9 lezárás, 2026-07-26)

A teljes implementáció (Task 1-8) és a Task 9 regressziós ellenőrzés lefutása
után az alábbi, a tényleges végállapotot érintő pontosítás szükséges — minden
más rész (DB-séma, `KATEGORIAK` sorrend, wrapper-metódusok, `getStatisztikak()`
mezői) **byte-pontosan** a fenti tervnek megfelelően valósult meg, eltérés
nélkül.

- **A "Statisztikák" nézet-fület a Task 8 implementációja során explicit
  vissza kellett állítani** `src/views/admin/Fuvarok.js`-ben, mert egy ettől
  a tervtől és design-dokumentumtól **független, korábbi** commit
  (`53fc262`, "group Fuvarok and Beérkezett dokumentumok by sofőr")
  már a terv megírása ELŐTT lecserélte a régi "Statisztikák" fület egy
  "Sofőr szerint" nézetre, és emiatt `StatisztikaDashboard.js` (amit ez a
  terv módosít) egy ideig egyetlen route-ból sem volt elérhető (`getActions`
  szinten a backend helyesen működött, csak a UI nem hivatkozott rá). A
  végleges állapot: `Fuvarok.js` `nezetMod` állapota 4 értéket vesz fel
  (`tablazat`/`kanban`/`sofor`/`statisztika`), mind a 4 `localStorage`-ban
  perzisztálva, egymás mellett, semelyik korábbi nézet nem veszett el. Ha
  ez a terv-dokumentum vagy egy jövőbeli kapcsolódó terv újra feltételezi,
  hogy a Statisztikák fül "már ott van" a Fuvarok oldalon — 2026-07-26 óta
  ez ismét igaz, de a feltételezés önmagában korábban egyszer már tévesnek
  bizonyult egy közbeékelődő, nem kapcsolódó commit miatt, érdemes élőben
  (nem csak grep-pel) újra ellenőrizni, mielőtt egy jövőbeli módosítás erre
  épít.
- **A `fuvarozasiProfit` magyarázó felirat pontos szövege** a végleges
  kódban: "Fuvarozási profit ({hónap}) — csak a fuvarokból számított
  bevétel/kiadás, nem egyezik meg a Pénzforgalom fő Nettó eredményével."
  (`StatisztikaDashboard.js`) — a tervben vázolt szöveg tartalmilag azonos,
  csak a pontos tördelés/szórend tér el minimálisan; nincs funkcionális
  különbség.
- **Task 9 élő, kézi visszaszámolással (nem csak API-válasz-olvasással)
  megerősítette** a `munkanapokHonapban()` helyes működését: 2026 július
  23 munkanapot tartalmaz, egy 200 000 Ft profitú, 45 000 Ft kiadású (csak
  útdíj, üzemanyag/bér nélkül), 245 000 Ft bevételű (2 teljesített fuvar)
  ideiglenes teszt-cégen az `atlagNapiProfit` a backend válaszában
  `8695.65` volt — ez egyezik a `200000/23 = 8695.652...` kézi számítással,
  kerekítési eltérés nélkül.
