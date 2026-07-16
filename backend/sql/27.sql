-- Feature: Piaci árak (EUR/USD árfolyam + benzinár) a sidebarban — nem
-- cégenként kulcsolt tábla, mert az árfolyam/üzemanyagár minden cégre
-- azonos, közös, gyorsítótárazott adat (ld. piaciArakInterface.php).
CREATE TABLE `piaci_arak` (
  `kulcs` VARCHAR(20) NOT NULL,
  `ertek` DECIMAL(12,4) NOT NULL,
  `elozo_ertek` DECIMAL(12,4) NULL,
  `frissitve` DATETIME NOT NULL,
  PRIMARY KEY (`kulcs`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feature: napi km-gyorsítótár GPSmart-ból (Ft/km fajlagos mutató a
-- Pénzforgalom jármű-bontásához). Csak LEZÁRT (tegnapi vagy korábbi)
-- napok kerülnek ide, véglegesként — a mai nap sosem, azt mindig élőben
-- kérdezi le, aki éppen arra a napra vonatkozó adatot akar (ld.
-- gpsmartInterface.php komment). `admin` = ceg_id, ugyanaz a minta, mint
-- a többi cégenkénti táblánál. `frissitve` azt jelzi, mikor sikerült
-- utoljára ténylegesen lekérdezni ezt a napot — nem azt, mikor PRÓBÁLTUK,
-- egy sikertelen lekérdezés nem hoz létre sort (ld. cron komment).
CREATE TABLE `gpsmart_napi_km` (
  `admin` INT(11) NOT NULL,
  `kamion_id` INT(11) NOT NULL,
  `datum` DATE NOT NULL,
  `km` DECIMAL(8,2) NOT NULL,
  `frissitve` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`kamion_id`, `datum`),
  KEY `admin_datum` (`admin`, `datum`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feature: deviza kezelés. `egyeb_koltsegek.osszeg` MARAD az egyetlen
-- forrás, amit a Pénzforgalom összes riportja/aggregálása (getKoltsegOsszesito
-- stb.) összegez — mindig HUF, a rögzítés PILLANATÁBAN érvényes árfolyamon
-- átszámolva és MEGFAGYASZTVA. `deviza`/`eredeti_osszeg`/`arfolyam` csak
-- kiegészítő, tájékoztató adat ("mit írtak be ténylegesen, milyen
-- árfolyamon") — SOSEM kerülnek újraszámításra egy későbbi, aktuális
-- árfolyammal, különben egy régi tétel HUF-értéke a riportban az idővel
-- csúszna, holott a könyvelés a rögzítéskori összeget rögzítette.
ALTER TABLE `egyeb_koltsegek`
  ADD COLUMN `deviza` VARCHAR(3) NOT NULL DEFAULT 'HUF' AFTER `osszeg`,
  ADD COLUMN `eredeti_osszeg` DECIMAL(12,2) NULL AFTER `deviza`,
  ADD COLUMN `arfolyam` DECIMAL(12,4) NULL AFTER `eredeti_osszeg`;

-- Cégenként (admin = ceg_id) szerkeszthető devizalista — ugyanaz a mintázat,
-- mint a listaInterface.php többi listatípusa (ld. 12.sql), a `deviza`
-- típussal bővítve. A HUF mindig `vedett` (alap/bázisdeviza, sosem törölhető),
-- az EUR/USD alapból fel van véve (élő MNB-árfolyammal már úgyis rendelkezik
-- a Piaci árak widget), de nem védett — ha egy cégnek sosincs rá szüksége,
-- törölheti.
INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend, vedett)
SELECT a.id, 'deviza', v.kulcs, v.nev, v.sorrend, v.vedett
FROM admin a
CROSS JOIN (
  SELECT 'HUF' AS kulcs, 'Forint' AS nev, 1 AS sorrend, 'I' AS vedett
  UNION ALL SELECT 'EUR', 'Euró', 2, 'N'
  UNION ALL SELECT 'USD', 'Amerikai dollár', 3, 'N'
) v
WHERE a.tulajdonos_admin_id IS NULL AND a.torolt <> 'I';

-- Feature: Piaci árak "market intelligence" bővítés (UX-audit alapján) —
-- napi előzmény-sor a sparkline-hoz és a valódi (nem csak "előző
-- lekérdezéshez képesti") %-os változáshoz. Egy sor NAPONTA legfeljebb
-- egyszer íródik (ON DUPLICATE KEY UPDATE ugyanarra a napra) — nem minden
-- 5 perces frontend-pollra, különben a "trend" hamis, túl sűrű pontokból
-- állna. Nem cégenként kulcsolt, ugyanazon okból, mint a `piaci_arak`
-- tábla maga.
CREATE TABLE `piaci_arak_elozmeny` (
  `kulcs` VARCHAR(20) NOT NULL,
  `datum` DATE NOT NULL,
  `ertek` DECIMAL(12,4) NOT NULL,
  PRIMARY KEY (`kulcs`, `datum`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
