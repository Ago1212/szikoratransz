-- Feature: Furgon — új, önálló flotta-jármű-kategória, teljes párhuzam a
-- kamionnal (saját adatlap, karbantartás-történet, GPS-követés, tankolás-
-- napló, pénzforgalmi kapcsolat, sofőr-hozzárendelés). A furgon önhajtó
-- jármű, mint a kamion (nem vontatmány, mint a pótkocsi) — ezért a `furgon`
-- tábla a `kamion` tábla pontos mása, DE a `potkocsi` FK-oszlop nélkül
-- (egy furgon nem vontat nyerges-pótkocsit). Nincs valódi FK-constraint,
-- a projekt teljes sémájában sehol — MyISAM engine, alkalmazás-szinten
-- érvényesített referenciális integritás, ugyanaz a minta, mint a
-- `kamion`/`potkocsi` táblák.
CREATE TABLE `furgon` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `rendszam` varchar(191) NOT NULL,
  `tipus` varchar(200) DEFAULT NULL,
  `allapot` varchar(30) NOT NULL DEFAULT 'szabad',
  `meret` varchar(20) DEFAULT NULL,
  `aktualis_km` int(11) DEFAULT NULL,
  `muszaki_lejarat` date DEFAULT NULL,
  `porolto_lejarat` date DEFAULT NULL,
  `porolto_lejarat_2` date DEFAULT NULL,
  `adr_lejarat` date DEFAULT NULL,
  `taograf_illesztes` date DEFAULT NULL,
  `emelohatfal_vizsga` date DEFAULT NULL,
  `kot_biztositas` date DEFAULT NULL,
  `kot_biz_nev` varchar(200) DEFAULT NULL,
  `kot_biz_dij` varchar(191) DEFAULT NULL,
  `kot_biz_utem` varchar(191) DEFAULT NULL,
  `kaszko_biztositas` date DEFAULT NULL,
  `kaszko_nev` varchar(200) DEFAULT NULL,
  `kaszko_dij` varchar(191) DEFAULT NULL,
  `kaszko_fizetesi_utem` varchar(191) DEFAULT NULL,
  `torolt` enum('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  UNIQUE KEY `furgon_rendszam_key` (`rendszam`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A furgon-karbantartás tábla a `kamion_karbantartars` pontos mása —
-- ugyanaz a minta, mint a `potkocsi_karbantartars` a pótkocsinál: minden
-- jármű-típusnak saját karbantartás-táblája van, nem egy közös, tipus-
-- oszloppal megkülönböztetett tábla (ez a kódbázis meglévő, következetes
-- konvenciója, ld. karbantartasokInterface.php).
CREATE TABLE `furgon_karbantartars` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin` int(11) NOT NULL,
  `furgon_id` int(11) NOT NULL,
  `log` varchar(191) NOT NULL,
  `datum` date NOT NULL,
  `km_oraallas` int(11) DEFAULT NULL,
  `elvegezte` varchar(200) DEFAULT NULL,
  `koltseg` decimal(10,2) DEFAULT NULL,
  `torolt` enum('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  KEY `furgon_karbantartars_furgonId_idx` (`furgon_id`),
  KEY `admin` (`admin`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A generikus, polimorf fájlmelléklet-tábla (`fajlok.tabla`) bővül a
-- 'furgon' értékkel, hogy a furgon-adatlapon is működjön a meglévő
-- getFiles/fileUpload/deleteFile mechanizmus — ez a tábla és a hozzá
-- tartozó backend-logika már eleve típus-agnosztikus, csak az ENUM-ot
-- kellett bővíteni, kódváltozás nélkül.
ALTER TABLE `fajlok`
  MODIFY COLUMN `tabla` enum('kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek','dokumentum','tankolas','helyszin','furgon') NOT NULL;

-- Pénzforgalmi kapcsolat — a `kamion_id`/`potkocsi_id` pár mintájára egy
-- harmadik, ugyanúgy nullázható és a másik kettővel kölcsönösen kizáró
-- oszlop (egy egyeb_koltsegek sor legfeljebb egy járműhöz köthető).
ALTER TABLE `egyeb_koltsegek`
  ADD COLUMN `furgon_id` int(11) DEFAULT NULL AFTER `potkocsi_id`;

-- Tankolás-napló — ez idáig kizárólag kamionra vonatkozott (a pótkocsinak
-- sosem volt saját tankolás-mezője, mert nincs motorja). A furgon önhajtó
-- jármű, mint a kamion, ezért itt egy ÚJ, `kamion_id`-vel kölcsönösen
-- kizáró oszlopot kap, nem egy meglévő pár harmadik tagját.
ALTER TABLE `tankolasok`
  ADD COLUMN `furgon_id` int(11) DEFAULT NULL AFTER `kamion_id`;

-- GPS napi km-gyorsítótár — ugyanígy kamion-only volt eddig (a pótkocsinak
-- nincs GPS-eszköze). ELSŐ NEKIFUTÁSRA egy nullázható `furgon_id` oszlopot
-- próbáltunk hozzáadni a meglévő `kamion_id` mellé (a `kamion_id`/
-- `potkocsi_id` mintáját követve) — ÉLŐBEN, tényleges `INSERT ... ON
-- DUPLICATE KEY UPDATE` hívással tesztelve kiderült, hogy ez HIBÁS: a
-- MySQL/MariaDB egy UNIQUE KEY-ben szereplő NULL-t sosem tekint "egyenlőnek"
-- egy másik NULL-lal, még `ON DUPLICATE KEY UPDATE` szempontjából sem — két
-- egymást követő cache-írás UGYANARRA a kamionra/napra emiatt két KÜLÖN sort
-- hozott volna létre (nem frissítést), ami idővel duplikált, összeadódó
-- `SUM(km)` hibát okozott volna a Ft/km riportban. A working fix: a
-- `kamion_id`/`furgon_id` páros helyett egyetlen, mindig KITÖLTÖTT
-- `jarmu_tipus` ENUM + `jarmu_id` oszlop-pár — mivel egyik oszlop sem
-- nullázható, a UNIQUE KEY (jarmu_tipus, jarmu_id, datum) megbízhatóan
-- detektálja az ismételt írást ugyanarra a járműre/napra.
ALTER TABLE `gpsmart_napi_km`
  DROP PRIMARY KEY,
  ADD COLUMN `id` int(11) NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (`id`),
  ADD COLUMN `jarmu_tipus` enum('kamion','furgon') NOT NULL DEFAULT 'kamion' AFTER `admin`,
  ADD COLUMN `jarmu_id` int(11) NOT NULL DEFAULT 0 AFTER `jarmu_tipus`;
UPDATE `gpsmart_napi_km` SET `jarmu_tipus` = 'kamion', `jarmu_id` = `kamion_id` WHERE `kamion_id` IS NOT NULL AND `kamion_id` > 0;
ALTER TABLE `gpsmart_napi_km`
  DROP COLUMN `kamion_id`,
  ADD UNIQUE KEY `gpsmart_napi_km_jarmu_datum` (`jarmu_tipus`, `jarmu_id`, `datum`);

-- Sofőr-hozzárendelés — a `kamion`/`aktiv_potkocsi` mintájára: melyik
-- furgont vezeti jelenleg az adott sofőr.
ALTER TABLE `user`
  ADD COLUMN `furgon` int(11) DEFAULT NULL AFTER `kamion`;

-- `jarmu_valtas_kerelmek.tipus` — ELSŐ NEKIFUTÁSRA feltételeztük, hogy ez
-- már ma is szabad string (a korábbi kutatás/terv ebből indult ki), ezért
-- ide séma-változás nélkülinek jelöltük. ÉLŐBEN, egy tényleges
-- `requestJarmuValtas(tipus='furgon', ...)` hívással tesztelve kiderült,
-- hogy ez TÉVES: az oszlop valójában `ENUM('kamion','potkocsi')` — egy nem
-- ismert enum-érték (`'furgon'`) beszúrása MySQL nem-strict módban NEM hibát
-- dob, hanem csendben üres string-et tárol, ami a jármű-váltási kérést
-- típus nélkülivé, a rendszám-feloldást pedig némán hibássá tette (ld.
-- jarmuValtasInterface.php `getRendszamok()`-alapú feloldás — üres tipus
-- mellett egyik ág sem illeszkedik, `jarmu_rendszam` mindig null marad).
-- A working fix: az ENUM bővítése a harmadik értékkel.
ALTER TABLE `jarmu_valtas_kerelmek`
  MODIFY COLUMN `tipus` enum('kamion','potkocsi','furgon') NOT NULL;
