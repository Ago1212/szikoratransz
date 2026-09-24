CREATE TABLE IF NOT EXISTS `sofor_lejarat_ertesites_log` (
  `sofor_id` int(11) NOT NULL,
  `mezo` varchar(32) NOT NULL,
  `lejarat` date NOT NULL,
  `merfoldko` smallint(6) NOT NULL,
  `kuldve` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`sofor_id`, `mezo`, `lejarat`, `merfoldko`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE fajlok ADD COLUMN karbantartas_jarmu_tipus ENUM('kamion','potkocsi','furgon') NULL AFTER rowid;
UPDATE fajlok SET karbantartas_jarmu_tipus = 'kamion' WHERE tabla = 'karbantartasok' AND rowid IN (SELECT id FROM kamion_karbantartars) AND rowid NOT IN (SELECT id FROM potkocsi_karbantartars) AND rowid NOT IN (SELECT id FROM furgon_karbantartars);
UPDATE fajlok SET karbantartas_jarmu_tipus = 'potkocsi' WHERE tabla = 'karbantartasok' AND rowid IN (SELECT id FROM potkocsi_karbantartars) AND rowid NOT IN (SELECT id FROM kamion_karbantartars) AND rowid NOT IN (SELECT id FROM furgon_karbantartars);
UPDATE fajlok SET karbantartas_jarmu_tipus = 'furgon' WHERE tabla = 'karbantartasok' AND rowid IN (SELECT id FROM furgon_karbantartars) AND rowid NOT IN (SELECT id FROM kamion_karbantartars) AND rowid NOT IN (SELECT id FROM potkocsi_karbantartars);
