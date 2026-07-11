-- 8.sql
-- Helyszínek — egy megosztott tudásbázis a gyakori fel-/lerakóhelyekről
-- (pl. "Tatabánya Praktiker", "Solymár Tesco"), fotókkal/videókkal és
-- leírással, hogy a sofőrök könnyebben eligazodjanak egy adott helyen.
-- Admin oldalon szerkeszthető, sofőr oldalon csak megtekinthető.
CREATE TABLE `helyszinek` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin` INT(11) NOT NULL,
  `nev` VARCHAR(200) NOT NULL,
  `varos` VARCHAR(120) DEFAULT NULL,
  `cim` VARCHAR(250) DEFAULT NULL,
  `leiras` TEXT DEFAULT NULL,
  `letrehozva` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `torolt` ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  INDEX `helyszinek_admin_idx` (`admin`),
  INDEX `helyszinek_nev_idx` (`nev`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A meglévő generikus fájltábla bővítése — a helyszín fotói/videói
-- ugyanazon a mechanizmuson mennek fel, mint a többi domain fájlja.
ALTER TABLE `fajlok`
  MODIFY `tabla` ENUM('kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek','dokumentum','tankolas','helyszin') NOT NULL;
