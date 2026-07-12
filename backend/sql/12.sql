-- Több "segéd" mező eddig fix ENUM volt (kamion mérete/állapota, bejelentés
-- típusa, szabadság típusa) — mostantól cégenként egyénileg bővíthető
-- listák (ld. listaInterface.php), ezért VARCHAR-ra váltanak, az eddigi
-- ENUM-értékek és alapértelmezések megtartásával.
ALTER TABLE kamion MODIFY meret VARCHAR(20) NULL;
ALTER TABLE kamion MODIFY allapot VARCHAR(30) NOT NULL DEFAULT 'szabad';
ALTER TABLE potkocsi MODIFY allapot VARCHAR(30) NOT NULL DEFAULT 'szabad';
ALTER TABLE bejelentesek MODIFY tipus VARCHAR(30) NOT NULL DEFAULT 'egyeb';
ALTER TABLE sofor_szabadsag MODIFY tipus VARCHAR(30) NOT NULL DEFAULT 'szabadsag';

-- Cégenkénti (admin = ceg_id), típus szerint csoportosított egyéni
-- listaelem-katalógus. A `vedett` = 'I' elemek nem törölhetők, mert
-- tényleges alapértelmezésként/eddigi kódba égetett logikaként
-- (pl. új kamion/pótkocsi `allapot` alapértéke) szerepelnek.
CREATE TABLE listaelemek (
  id INT NOT NULL AUTO_INCREMENT,
  admin INT NOT NULL,
  tipus VARCHAR(50) NOT NULL,
  kulcs VARCHAR(50) NOT NULL,
  nev VARCHAR(100) NOT NULL,
  sorrend INT NOT NULL DEFAULT 0,
  vedett ENUM('I','N') NOT NULL DEFAULT 'N',
  torolt ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (id),
  UNIQUE KEY listaelemek_ceg_tipus_kulcs (admin, tipus, kulcs)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- Minden jelenlegi gyökér (cégtulajdonos) admin megkapja a korábban
-- kódba égetett értékeket induló listaelemként, hogy a migráció ne
-- változtasson semmin a meglévő cégeknél.
INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend, vedett)
SELECT a.id, 'kamion_meret', v.kulcs, v.nev, v.sorrend, 'N'
FROM admin a
CROSS JOIN (
  SELECT '3.5T' AS kulcs, '3.5T' AS nev, 1 AS sorrend
  UNION ALL SELECT '7.5T', '7.5T', 2
  UNION ALL SELECT '12T', '12T', 3
  UNION ALL SELECT '18T', '18T', 4
  UNION ALL SELECT '24T', '24T', 5
) v
WHERE a.tulajdonos_admin_id IS NULL AND a.torolt <> 'I';

INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend, vedett)
SELECT a.id, 'jarmu_allapot', v.kulcs, v.nev, v.sorrend, v.vedett
FROM admin a
CROSS JOIN (
  SELECT 'szabad' AS kulcs, 'Szabad' AS nev, 1 AS sorrend, 'I' AS vedett
  UNION ALL SELECT 'uton', 'Úton', 2, 'N'
  UNION ALL SELECT 'szervizben', 'Szervizben', 3, 'N'
) v
WHERE a.tulajdonos_admin_id IS NULL AND a.torolt <> 'I';

INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend, vedett)
SELECT a.id, 'biztositas_utem', v.kulcs, v.nev, v.sorrend, v.vedett
FROM admin a
CROSS JOIN (
  SELECT 'Nincs' AS kulcs, 'Nincs' AS nev, 1 AS sorrend, 'I' AS vedett
  UNION ALL SELECT 'Negyed év', 'Negyed év', 2, 'N'
  UNION ALL SELECT 'Fél év', 'Fél év', 3, 'N'
  UNION ALL SELECT 'Éves', 'Éves', 4, 'N'
) v
WHERE a.tulajdonos_admin_id IS NULL AND a.torolt <> 'I';

INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend, vedett)
SELECT a.id, 'bejelentes_tipus', v.kulcs, v.nev, v.sorrend, v.vedett
FROM admin a
CROSS JOIN (
  SELECT 'muszaki' AS kulcs, 'Műszaki' AS nev, 1 AS sorrend, 'N' AS vedett
  UNION ALL SELECT 'serules', 'Sérülés', 2, 'N'
  UNION ALL SELECT 'baleset', 'Baleset', 3, 'N'
  UNION ALL SELECT 'gumi', 'Gumi', 4, 'N'
  UNION ALL SELECT 'szerviz', 'Szerviz', 5, 'N'
  UNION ALL SELECT 'felszereles', 'Felszerelés', 6, 'N'
  UNION ALL SELECT 'rakomany', 'Rakomány', 7, 'N'
  UNION ALL SELECT 'egyeb', 'Egyéb', 8, 'I'
) v
WHERE a.tulajdonos_admin_id IS NULL AND a.torolt <> 'I';

INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend, vedett)
SELECT a.id, 'szabadsag_tipus', v.kulcs, v.nev, v.sorrend, v.vedett
FROM admin a
CROSS JOIN (
  SELECT 'szabadsag' AS kulcs, 'Szabadság' AS nev, 1 AS sorrend, 'I' AS vedett
  UNION ALL SELECT 'betegszabadsag', 'Betegszabadság', 2, 'N'
  UNION ALL SELECT 'egyeb', 'Egyéb', 3, 'N'
) v
WHERE a.tulajdonos_admin_id IS NULL AND a.torolt <> 'I';
