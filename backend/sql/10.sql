-- Konfigurálható, szerepkör-alapú modul-jogosultságok. Csak a nem-admin
-- szerepkörökhöz (ma: 'fuvarszervezo') tartozik értelmezhető sor — az
-- 'admin' szerepkör mindig teljes hozzáférésű, sosem korlátozható innen.
-- Hiányzó sor egy (ceg_id, szerepkor, modul) kombinációra = alapértelmezett
-- teljes hozzáférés (I/I/I), hogy a meglévő cégek működése ne törjön meg
-- addig, amíg valaki explicit nem korlátoz.
CREATE TABLE jogosultsagok (
  id INT NOT NULL AUTO_INCREMENT,
  admin INT NOT NULL,
  szerepkor VARCHAR(50) NOT NULL,
  modul VARCHAR(50) NOT NULL,
  hozzaferes ENUM('I','N') NOT NULL DEFAULT 'I',
  szerkesztes ENUM('I','N') NOT NULL DEFAULT 'I',
  torles ENUM('I','N') NOT NULL DEFAULT 'I',
  modositva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY jogosultsagok_ceg_szerepkor_modul (admin, szerepkor, modul)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
