-- A `fuvarok` tábla egy korábban (a jelen munkameneteket megelőzően) már
-- megépített, majd visszavont modul maradványa volt — csak a helyi
-- fejlesztői adatbázisban létezett, sosem volt hozzá tracked migráció,
-- ezért az éles adatbázisból hiányzott (ld. "Base table or view not
-- found: fuvarok" hiba). Ez a migráció pótolja, pontosan a helyi séma
-- szerint (ld. `SHOW CREATE TABLE fuvarok` a helyi dev DB-n).
CREATE TABLE IF NOT EXISTS `fuvarok` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin` int(11) NOT NULL,
  `ugyfel_id` int(11) DEFAULT NULL,
  `kamion_id` int(11) DEFAULT NULL,
  `potkocsi_id` int(11) DEFAULT NULL,
  `sofor_id` int(11) DEFAULT NULL,
  `felrakas_cim` varchar(250) DEFAULT NULL,
  `felrakas_datum` date DEFAULT NULL,
  `lerakas_cim` varchar(250) DEFAULT NULL,
  `lerakas_datum` date DEFAULT NULL,
  `rakomany_leiras` varchar(250) DEFAULT NULL,
  `suly_kg` int(11) DEFAULT NULL,
  `dij` decimal(12,2) DEFAULT NULL,
  `devizanem` varchar(10) NOT NULL DEFAULT 'HUF',
  `statusz` enum('tervezett','folyamatban','lezart','storno') NOT NULL DEFAULT 'tervezett',
  `megjegyzes` text DEFAULT NULL,
  `letrehozva` datetime NOT NULL DEFAULT current_timestamp(),
  `torolt` enum('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  KEY `fuvarok_admin_idx` (`admin`),
  KEY `fuvarok_kamion_idx` (`kamion_id`),
  KEY `fuvarok_sofor_idx` (`sofor_id`),
  KEY `fuvarok_ugyfel_idx` (`ugyfel_id`),
  KEY `fuvarok_statusz_idx` (`statusz`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
