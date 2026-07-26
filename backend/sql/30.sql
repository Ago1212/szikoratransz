-- Fejlesztési kör (2026-07-20) — Teendők akció-központ, valódi
-- sofőr-admin üzenetküldés, bankszámla-kivonat import.
--
-- Sofőr-admin üzenetküldés: a Bejelentések admin-felület korábban egy
-- teljesen frontend-mock üzenetfolyamot rajzolt ki (ld. CardBejelentesek.js
-- komment) — sosem volt hozzá backend. Ez a tábla egy adott bejelentéshez
-- tartozó, kétirányú (admin <-> sofőr) beszélgetést tárol, ugyanabban a
-- mintában, mint a `helyszin_megjegyzesek` (szerző típus/id/név
-- denormalizálva, mert a szerző lehet az `admin` VAGY a `user` táblából,
-- amiket a projekt konvenciója szerint sosem JOIN-olunk).
CREATE TABLE IF NOT EXISTS bejelentes_uzenetek (
    id INT NOT NULL AUTO_INCREMENT,
    bejelentes_id INT NOT NULL,
    szerzo_tipus ENUM('admin','sofor') NOT NULL,
    szerzo_id INT NOT NULL,
    szerzo_nev VARCHAR(191) NOT NULL,
    szoveg TEXT NOT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    torolt ENUM('I','N') NOT NULL DEFAULT 'N',
    PRIMARY KEY (id),
    INDEX idx_bejelentes (bejelentes_id)
) ENGINE=InnoDB;

-- Bankszámla-kivonat import: `bank_parositva` jelzi az `egyeb_koltsegek`
-- soron, hogy tényleges banki tranzakcióval igazolva van-e (akár mert egy
-- CSV-sor összepárosítva lett vele, akár mert magából egy CSV-sorból
-- keletkezett) — ez egy VALÓDI, a Tételek listán is megjeleníthető jelzés,
-- nem csak import-időszaki könyvelés.
ALTER TABLE egyeb_koltsegek ADD COLUMN IF NOT EXISTS bank_parositva ENUM('I','N') NOT NULL DEFAULT 'N';

-- `bank_import_tetelek` — minden egyszer már feldolgozott banki sor
-- lenyomata (`tetel_hash` = dátum+összeg+közlemény alapján, ld.
-- BankImportInterface::elemezCsv). Ugyanaz a de-duplikációs elv, mint a
-- NAV Online Számla importnál (ott `szamlaszam` alapján) — egy átfedő
-- időszakú, újra feltöltött CSV-ben a korábban már döntött sorok nem
-- jelennek meg újra a review-listában.
CREATE TABLE IF NOT EXISTS bank_import_tetelek (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    datum DATE NOT NULL,
    osszeg DECIMAL(12,2) NOT NULL,
    kozlemeny VARCHAR(500) NULL,
    tetel_hash CHAR(64) NOT NULL,
    akcio ENUM('parositva','uj_tetel','kihagyva') NOT NULL,
    egyeb_koltseg_id INT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_admin_hash (admin, tetel_hash)
) ENGINE=InnoDB;

-- `user.email` NOT NULL + globálisan UNIQUE volt, miközben az email cím
-- a sofőr-felvételi formon (CardSoforAdatokForm.js) sosem `required`, és
-- az ApiHandler::validation() is explicit szándékkal engedi üresen (ld.
-- ottani komment) — a backend `newSofor()`/`saveSoforData()` viszont eddig
-- üres stringet ('') írt a mezőbe email megadása nélkül is. Az első ilyen
-- sofőr felvétele még lement, de a MÁSODIK, szintén email nélküli sofőr
-- felvétele a UNIQUE KEY-be ütközött ('' már foglalt volt) — ez okozta az
-- élőben jelentett "az email cím már foglalt" hibát egy második,
-- email nélküli sofőr rögzítésekor. A mezőt NULL-ozhatóvá tesszük, a
-- backend (ld. soforokInterface.php) pedig mostantól NULL-t ír üres email
-- esetén, nem ''-t — MySQL/InnoDB a UNIQUE indexben több NULL-t egymástól
-- függetlennek tekint, tehát tetszőlegesen sok email nélküli sofőr
-- felvehető. A jelenlegi éles adatokban nincs '' értékű email (ellenőrizve),
-- az UPDATE csak védekező jelleggel szerepel egy esetleges jövőbeli/másik
-- környezetbeli maradvány ellen.
ALTER TABLE user MODIFY email VARCHAR(191) NULL;
UPDATE user SET email = NULL WHERE email = '';

-- MOL üzemanyagkártya-tranzakció PDF-import (a "Számla melléklet" nevű
-- részletező, nem maga a számla) — a tankolasInterface.php-beli
-- newTankolas() eddig kizárólag sofőr-önkiszolgáló bejegyzést ismert
-- (`sofor_id` NOT NULL), a MOL-import viszont jármű/kártya-szinten dolgozik,
-- sofőr-hozzárendelés nélkül (a MOL-adat nem tudja, ki vezetett) — ezt
-- kitalálni/kikövetkeztetni tiltott (ld. "no fake data" konvenció), ezért a
-- mezőt NULL-ozhatóvá tesszük ahelyett, hogy egy hamis sofor_id-t írnánk be.
-- A driver-oldali `getTankolasok($sofor_id)` lista emiatt változatlanul csak
-- a sofőr saját, kézzel rögzített tételeit mutatja — ez szándékos, nem hiba.
ALTER TABLE `tankolasok` MODIFY `sofor_id` INT(11) NULL;

-- `mol_slip_id` — a MOL melléklet "Slip ID" oszlopa, tranzakciónként
-- egyedi. Ez a tényleges de-duplikációs kulcs egy PDF véletlen kétszeri
-- feltöltése ellen (a `szamlaszam` önmagában csak a SZÁMLÁT azonosítja,
-- nem az egyes tranzakciókat — ld. MolTankolasInterface). NULL a kézzel
-- (sofőr-önkiszolgáló) rögzített tételeknél, ott a UNIQUE KEY több NULL-t
-- egymástól függetlennek tekint (ld. fenti user.email-fix ugyanezen elve).
ALTER TABLE `tankolasok` ADD COLUMN IF NOT EXISTS `mol_slip_id` VARCHAR(30) NULL AFTER `szamlaszam`;
ALTER TABLE `tankolasok` ADD UNIQUE KEY IF NOT EXISTS `idx_admin_mol_slip` (`admin`, `mol_slip_id`);
