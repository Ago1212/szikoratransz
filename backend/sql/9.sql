-- Helyszínek egyszerűsítése: cím/település/leírás elhagyása, helyette
-- több, időbélyeggel és szerzővel ellátott megjegyzés.
ALTER TABLE helyszinek
  DROP COLUMN varos,
  DROP COLUMN cim,
  DROP COLUMN leiras;

CREATE TABLE helyszin_megjegyzesek (
  id INT NOT NULL AUTO_INCREMENT,
  helyszin_id INT NOT NULL,
  szerzo_tipus ENUM('admin','sofor') NOT NULL,
  szerzo_id INT NOT NULL,
  szerzo_nev VARCHAR(255) NOT NULL,
  szoveg TEXT NOT NULL,
  letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  torolt ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (id),
  KEY helyszin_megjegyzesek_helyszin_id (helyszin_id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
