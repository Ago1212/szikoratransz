-- 5.sql
-- Jármű-váltási kérés/jóváhagyás flow — a sofőr nem válthat szabadon
-- kamiont/pótkocsit, csak kérheti; az admin hagyja jóvá vagy utasítja
-- el. Az elsődleges párost (user.kamion / user.aktiv_potkocsi) továbbra
-- is közvetlenül az admin állítja be a sofőr-szerkesztőn, jóváhagyás
-- nélkül — ott az admin maga a jóváhagyó fél.

CREATE TABLE `jarmu_valtas_kerelmek` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin` INT(11) NOT NULL,
  `sofor_id` INT(11) NOT NULL,
  `tipus` ENUM('kamion','potkocsi') NOT NULL,
  `jarmu_id` INT(11) NOT NULL,
  `indoklas` VARCHAR(255) DEFAULT NULL,
  `allapot` ENUM('fuggoben','jovahagyva','elutasitva','visszavonva') NOT NULL DEFAULT 'fuggoben',
  `kerelmezve` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `elbiralva` DATETIME DEFAULT NULL,
  `torolt` ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  INDEX `jarmu_valtas_kerelmek_admin_idx` (`admin`),
  INDEX `jarmu_valtas_kerelmek_sofor_idx` (`sofor_id`),
  INDEX `jarmu_valtas_kerelmek_allapot_idx` (`allapot`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
