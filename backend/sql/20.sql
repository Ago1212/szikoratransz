-- NAV Online Számla technikai felhasználó adatai cégenként (admin = a cég
-- tulajdonos-admin id-je, ugyanaz a "ceg_id", amit a jogosultsagok/
-- egyeb_koltsegek/listaelemek táblák is használnak — NEM az aktuálisan
-- bejelentkezett admin.id, mert egy cégnek több bejelentkezése is lehet
-- (csapattagok), a NAV-hitelesítés viszont cégszintű, egy sor cégenként).
-- A jelszo/alairo_kulcs/csere_kulcs mezők titkosítva (openssl_encrypt,
-- AES-256-CBC, config.php navEncryptionKey) kerülnek be — ezek valódi NAV
-- Online Számla portál hozzáférést adnak, ezért nem nyílt szövegként
-- tároljuk, szemben a projekt eddigi (app-saját-titkokra vonatkozó)
-- konvenciójával.
CREATE TABLE IF NOT EXISTS `nav_szamla_beallitasok` (
  `admin` int(11) NOT NULL,
  `adoszam` varchar(20) NOT NULL,
  `login` varchar(100) NOT NULL,
  `jelszo_titkositva` text NOT NULL,
  `alairo_kulcs_titkositva` text NOT NULL,
  `csere_kulcs_titkositva` text NOT NULL,
  `kornyezet` enum('eles','teszt') NOT NULL DEFAULT 'eles',
  `frissitve` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`admin`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
