-- Egyéb (nem karbantartás, nem üzemanyag) költségek manuális rögzítése —
-- pl. parkolás, bírság, matrica/útdíj, mosatás, egyéb adminisztratív
-- tétel. A jármű-hozzárendelés opcionális (lehet cég-szintű, jármühöz
-- nem köthető költség is), ezért mindkét FK nullázható.
CREATE TABLE egyeb_koltsegek (
  id INT NOT NULL AUTO_INCREMENT,
  admin INT NOT NULL,
  kamion_id INT NULL,
  potkocsi_id INT NULL,
  datum DATE NOT NULL,
  megnevezes VARCHAR(200) NOT NULL,
  osszeg DECIMAL(10,2) NOT NULL,
  megjegyzes VARCHAR(255) NULL,
  torolt ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
