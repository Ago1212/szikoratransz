-- GPSmart flottakövetés — a cég GPSmart (flottanavigacio.gpsmart.eu) fiókjának
-- belépési adatai, hogy a szerver saját maga tudjon bejelentkezni és lekérni a
-- kamionok aktuális pozícióját (nincs hosszú élettartamú API-kulcs, a
-- GPSmart oldala munkamenet-cookie-val működik, amit be- és kijelentkezéssel
-- kell mindig frissen szerezni — ld. GpsmartClient.php). Cégenként (nem
-- bejelentkezésenként) egy fiók van, ugyanúgy, mint a NAV-beállításoknál.
CREATE TABLE IF NOT EXISTS `gpsmart_beallitasok` (
  `admin` int(11) NOT NULL,
  `felhasznalonev` varchar(100) NOT NULL,
  `jelszo_titkositva` text NOT NULL,
  `userid` varchar(50) NOT NULL,
  `frissitve` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`admin`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
