-- A szerepkör eddig fix ENUM('admin','fuvarszervezo') volt — mostantól
-- cégenként tetszőleges egyéni szerepkör létrehozható (ld. szerepkorok
-- tábla), ezért a mezőnek szabad szöveges (VARCHAR) formátumúnak kell
-- lennie, nem korlátozott ENUM-nak.
ALTER TABLE admin MODIFY szerepkor VARCHAR(50) NOT NULL DEFAULT 'admin';

-- Egyéni, cégenkénti (admin = ceg_id) szerepkör-katalógus. Az 'admin'
-- szerepkör szándékosan NEM szerepel itt sorként — az mindig fix, minden
-- cégnél elérhető, teljes hozzáférésű, nem admin-táblás rekord (ld.
-- SzerepkorInterface komment).
CREATE TABLE szerepkorok (
  id INT NOT NULL AUTO_INCREMENT,
  admin INT NOT NULL,
  kulcs VARCHAR(50) NOT NULL,
  nev VARCHAR(100) NOT NULL,
  letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  torolt ENUM('I','N') NOT NULL DEFAULT 'N',
  PRIMARY KEY (id),
  UNIQUE KEY szerepkorok_ceg_kulcs (admin, kulcs)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- A "Fuvarszervező" eddig globálisan, kódba égetve létezett minden
-- cégnél — hogy ez a meglévő cégeknél ne tűnjön el a migráció után,
-- minden jelenlegi gyökér (cégtulajdonos) admin kap egy ilyen egyéni
-- szerepkör-sort.
INSERT INTO szerepkorok (admin, kulcs, nev)
SELECT id, 'fuvarszervezo', 'Fuvarszervező'
FROM admin
WHERE tulajdonos_admin_id IS NULL AND torolt <> 'I';
