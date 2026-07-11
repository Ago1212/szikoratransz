-- 4.sql
-- A sofőr-oldal mobil újratervezéséhez szükséges séma-bővítések
-- (ld. a sofőr UX/UI terv 06. pontját). A Fuvarok és az indulás előtti
-- ellenőrző lista funkció nem kell, ezért azokhoz nincs itt tábla.

-- Aktív pótkocsi-kijelölés — a user.kamion mező már létezik (kamion
-- kiválasztásához), ez a pótkocsi-párja.
ALTER TABLE `user`
  ADD `aktiv_potkocsi` INT(11) DEFAULT NULL AFTER `kamion`;

-- Bejelentés típusa (műszaki hiba / sérülés / baleset / stb.) és a
-- bejelentés helyszíne (böngésző Geolocation API-ból).
ALTER TABLE `bejelentesek`
  ADD `tipus` ENUM('muszaki','serules','baleset','gumi','szerviz','felszereles','rakomany','egyeb') NOT NULL DEFAULT 'egyeb' AFTER `sofor_id`,
  ADD `lat` DECIMAL(9,6) DEFAULT NULL AFTER `tipus`,
  ADD `lng` DECIMAL(9,6) DEFAULT NULL AFTER `lat`;

-- A generikus fajlok tábla bővítése a Dokumentumok modulhoz: új
-- 'dokumentum' tabla-érték + kategória (fuvarlevél/CMR/számla/POD/
-- tankolási bizonylat/autópályadíj/egyéb), illetve 'tankolas', hogy a
-- tankolási blokk-fotó is ugyanezen a mechanizmuson menjen fel.
ALTER TABLE `fajlok`
  MODIFY `tabla` ENUM('kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek','dokumentum','tankolas') NOT NULL,
  ADD `kategoria` VARCHAR(30) DEFAULT NULL AFTER `tabla`;

-- Tankolások — liter, egységár, km-óraállás, helyszín; a blokk fotója a
-- fajlok táblán keresztül (tabla='tankolas', rowid=tankolasok.id).
CREATE TABLE `tankolasok` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin` INT(11) NOT NULL,
  `sofor_id` INT(11) NOT NULL,
  `kamion_id` INT(11) DEFAULT NULL,
  `datum` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `liter` DECIMAL(8,2) NOT NULL,
  `egysegar` DECIMAL(8,2) DEFAULT NULL,
  `osszeg` DECIMAL(10,2) DEFAULT NULL,
  `km_oraallas` INT(11) DEFAULT NULL,
  `helyszin` VARCHAR(200) DEFAULT NULL,
  `torolt` ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  INDEX `tankolasok_admin_idx` (`admin`),
  INDEX `tankolasok_sofor_idx` (`sofor_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
