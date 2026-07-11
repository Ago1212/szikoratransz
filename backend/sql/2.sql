-- 2.sql
-- Admin rendszer fejlesztési roadmap (2026-07-09-i elemzés) alapján
-- szükséges séma-bővítések. Ugyanazt a konvenciót követi, mint a meglévő
-- séma: ENGINE=MyISAM, utf8mb4/utf8mb4_unicode_ci, `torolt` soft-delete
-- enum, `admin` oszlop a tulajdonos admin fiókra (per-admin adat-elkülönítés).
--
-- Új táblák: bejelentesek (valós, felváltja a
-- bejelentesekInterface.php-ban eddig hardcode-olt fake adatot),
-- ajanlatkeresek, audit_log, sofor_szabadsag, jelszo_visszaallitas.
-- ALTER-ek: allapot + aktualis_km a kamion/potkocsi táblán, koltseg a
-- karbantartás táblákon, szerepkor az admin táblán.
--
-- Megjegyzés: az `ugyfelek` és `fuvarok` táblák (fuvar-nyilvántartás
-- modul) korábban itt szerepeltek, de a funkciót visszavonták — a
-- diszpécserek szóban egyeztetik a fuvarokat, és utólagos rögzítésre
-- nincs idejük. A helyi dev DB-ben a táblák még megvannak (nem lettek
-- eldobva), de az alkalmazás kódja már sehol nem hivatkozik rájuk.

-- ---------------------------------------------------------------------
-- Bejelentések — valós tábla. Eddig a bejelentesekInterface.php
-- hardcode-olt PHP tömböt adott vissza az admin oldalnak, a sofőr oldali
-- Dashboard pedig egy nem is létező `getTruckReports` akciót hívott —
-- a funkció mindkét irányból ténylegesen törött volt.
-- ---------------------------------------------------------------------
CREATE TABLE `bejelentesek` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin` INT(11) NOT NULL,
  `kamion_id` INT(11) DEFAULT NULL,
  `sofor_id` INT(11) DEFAULT NULL,
  `cim` VARCHAR(200) NOT NULL,
  `leiras` TEXT NOT NULL,
  `prioritas` ENUM('alacsony','kozepes','magas') NOT NULL DEFAULT 'kozepes',
  `statusz` ENUM('uj','folyamatban','lezart') NOT NULL DEFAULT 'uj',
  `admin_valasz` TEXT DEFAULT NULL,
  `bejelentve` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lezarva` DATETIME DEFAULT NULL,
  `torolt` ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  INDEX `bejelentesek_admin_idx` (`admin`),
  INDEX `bejelentesek_kamion_idx` (`kamion_id`),
  INDEX `bejelentesek_sofor_idx` (`sofor_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Ajánlatkérések / jelentkezések — a weboldali űrlapok eddig csak egy
-- e-mailt küldtek és utána nyomtalanul eltűntek (sendAjanlatkeres /
-- sendJelentkezes). Mostantól perzisztálva is vannak, hogy legyen lead-
-- lista és követhető státusz.
-- ---------------------------------------------------------------------
CREATE TABLE `ajanlatkeresek` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `tipus` ENUM('ajanlatkeres','jelentkezes') NOT NULL,
  `nev` VARCHAR(200) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `telefon` VARCHAR(60) DEFAULT NULL,
  `uzenet` TEXT DEFAULT NULL,
  `statusz` ENUM('uj','felvette','lezart') NOT NULL DEFAULT 'uj',
  `beerkezett` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `torolt` ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  INDEX `ajanlatkeresek_statusz_idx` (`statusz`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Módosítási előzmény / audit log — kritikus (törlés jellegű) admin
-- műveletekhez. A séma többi táblájának nincs semmilyen történeti nyoma
-- (lásd CLAUDE.md — MyISAM, nincs FK, nincs trigger), ez az első lépés
-- efelé.
-- ---------------------------------------------------------------------
CREATE TABLE `audit_log` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin_id` INT(11) NOT NULL,
  `tabla` VARCHAR(50) NOT NULL,
  `rowid` INT(11) NOT NULL,
  `muvelet` ENUM('letrehozas','modositas','torles') NOT NULL,
  `leiras` VARCHAR(255) DEFAULT NULL,
  `datum` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `audit_log_tabla_rowid_idx` (`tabla`, `rowid`),
  INDEX `audit_log_admin_idx` (`admin_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sofőr szabadság / elérhetőség naptár
-- ---------------------------------------------------------------------
CREATE TABLE `sofor_szabadsag` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin` INT(11) NOT NULL,
  `sofor_id` INT(11) NOT NULL,
  `datum_tol` DATE NOT NULL,
  `datum_ig` DATE NOT NULL,
  `tipus` ENUM('szabadsag','betegszabadsag','egyeb') NOT NULL DEFAULT 'szabadsag',
  `megjegyzes` VARCHAR(255) DEFAULT NULL,
  `torolt` ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  INDEX `sofor_szabadsag_admin_idx` (`admin`),
  INDEX `sofor_szabadsag_sofor_idx` (`sofor_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Jelszó-visszaállítási tokenek — ma nincs semmilyen jelszó-reset flow,
-- csak az egyetlen, kódba írt megosztott authHash titok védi az API-t.
-- ---------------------------------------------------------------------
CREATE TABLE `jelszo_visszaallitas` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `lejarat` DATETIME NOT NULL,
  `felhasznalva` ENUM('I','N') NOT NULL DEFAULT 'N',
  `letrehozva` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jelszo_visszaallitas_token_key` (`token`),
  INDEX `jelszo_visszaallitas_email_idx` (`email`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Meglévő táblák bővítése
-- ---------------------------------------------------------------------

-- Jármű állapot-jelző (szabad / úton / szervizben) + folyamatos
-- km-óraállás (eddig csak karbantartáskori pillanatfelvétel volt).
ALTER TABLE `kamion`
  ADD `allapot` ENUM('szabad','uton','szervizben') NOT NULL DEFAULT 'szabad' AFTER `tipus`,
  ADD `aktualis_km` INT(11) DEFAULT NULL AFTER `meret`;

ALTER TABLE `potkocsi`
  ADD `allapot` ENUM('szabad','uton','szervizben') NOT NULL DEFAULT 'szabad' AFTER `tipus`,
  ADD `aktualis_km` INT(11) DEFAULT NULL AFTER `tipus`;

-- Karbantartási költség — eddig egyetlen mező sem tette lehetővé a
-- flotta fenntartási költségének összesítését.
ALTER TABLE `kamion_karbantartars`
  ADD `koltseg` DECIMAL(10,2) DEFAULT NULL AFTER `elvegezte`;

ALTER TABLE `potkocsi_karbantartars`
  ADD `koltseg` DECIMAL(10,2) DEFAULT NULL AFTER `elvegezte`;

-- Szerepkör-alapú jogosultság alapja — eddig bináris admin/sofőr
-- (admin tábla vs. user tábla) volt az egyetlen megkülönböztetés.
ALTER TABLE `admin`
  ADD `szerepkor` ENUM('admin','diszpecser','konyvelo','flottafelelos') NOT NULL DEFAULT 'admin' AFTER `name`;

-- A generikus fajlok tábla (getFiles/fileUpload/deleteFile) eddig nem
-- tudott bejelentésekhez fájlt (pl. hibáról készült fotót) csatolni —
-- a `tabla` enum bővítve, hogy a Bejelentések szerkesztő is használhassa
-- ugyanazt a meglévő fájlfeltöltő mechanizmust.
ALTER TABLE `fajlok`
  MODIFY `tabla` ENUM('kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek') NOT NULL;
