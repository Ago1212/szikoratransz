-- Tachográf kártya (.ddd) import és vezetési/pihenő idő riport (2026-07-23).
--
-- A sofőr saját digitális tachográf-kártyájának letöltött (.ddd) fájlját az
-- admin tölti fel — ugyanaz a "digest, admin dönt" kétlépéses import-minta,
-- mint a NAV/Bank/MOL importoknál (ld. TachografInterface::elemezDdd()/
-- alkalmazImport()). `tachograf_kartyaszam` a kártyaszám alapján automatikus
-- sofőr-felismerést tesz lehetővé egy második/ismételt feltöltésnél.
ALTER TABLE user ADD COLUMN IF NOT EXISTS tachograf_kartyaszam VARCHAR(20) NULL;
ALTER TABLE user ADD INDEX IF NOT EXISTS idx_tachograf_kartyaszam (admin, tachograf_kartyaszam);

-- A perc-pontos állapotváltás-lista (`aktivitas_json`) és az aznap használt
-- jármű(vek) listája (`jarmuvek_json`) JSON-oszlopban él, nem külön,
-- soronkénti táblában — a napi bontás már önmagában elég granularitás egy
-- lista/riport nézethez, egy driverenként/naponta akár 30+ soros percadat
-- feleslegesen normalizált lenne egy olyan funkcióhoz, ahol csak a
-- napi-részlet-modál nézi meg egyben.
CREATE TABLE IF NOT EXISTS tachograf_napi_aktivitas (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    sofor_id INT NOT NULL,
    kartyaszam VARCHAR(20) NOT NULL,
    datum DATE NOT NULL,
    tavolsag_km INT NULL,
    vezetes_perc INT NOT NULL DEFAULT 0,
    munka_perc INT NOT NULL DEFAULT 0,
    rendelkezesre_allas_perc INT NOT NULL DEFAULT 0,
    piheno_perc INT NOT NULL DEFAULT 0,
    aktivitas_json TEXT NULL,
    jarmuvek_json TEXT NULL,
    forras_fajlnev VARCHAR(191) NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_kartya_datum (admin, kartyaszam, datum),
    INDEX idx_admin_sofor (admin, sofor_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tachograf_esemenyek (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    sofor_id INT NOT NULL,
    kartyaszam VARCHAR(20) NOT NULL,
    tipus VARCHAR(60) NOT NULL,
    kezdet DATETIME NOT NULL,
    veg DATETIME NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_dedup (admin, sofor_id, tipus, kezdet),
    INDEX idx_admin_sofor (admin, sofor_id)
) ENGINE=InnoDB;

-- Fájlok — központi fájlkezelővé bővítés (2026-07-23). A `fajlok` tábla ma
-- is minden domain-modul feltöltését gyűjti (`getFiles(tabla="admin", ...)`
-- a teljes céges állományt adja vissza, nem csak a `tabla='admin'` sorokat)
-- — ez a bővítés a hiányzó feltöltő-nyomon követést, a fájltípus-alapú
-- kategorizálást és a szabad címkézést adja hozzá, plusz 3 új `tabla`
-- értéket a korábban csak memóriában dekódolt, el nem mentett import-
-- fájloknak (Bank CSV, MOL PDF, Tachográf .ddd — ld. FilesInterface).
ALTER TABLE fajlok
  ADD COLUMN feltolto_tipus ENUM('admin','sofor') NULL AFTER feltoltve,
  ADD COLUMN feltolto_id INT NULL AFTER feltolto_tipus,
  ADD COLUMN feltolto_nev VARCHAR(191) NULL AFTER feltolto_id,
  ADD COLUMN fajl_kategoria VARCHAR(20) NULL AFTER feltolto_nev,
  ADD COLUMN cimkek TEXT NULL AFTER fajl_kategoria;

ALTER TABLE fajlok MODIFY COLUMN tabla ENUM(
  'kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek',
  'dokumentum','tankolas','helyszin','furgon',
  'bank_import','mol_import','tachograf_import'
) NOT NULL;

-- Meglévő sorok `fajl_kategoria`-jának visszamenőleges kitöltése a fájlnév
-- kiterjesztése alapján — `feltolto_*` szándékosan marad NULL ezeken (nem
-- tudjuk utólag, ki töltötte fel, nem gyártunk hozzá kitalált adatot; a
-- felület "Ismeretlen"-t mutat NULL esetén).
UPDATE fajlok SET fajl_kategoria = 'kep' WHERE filename REGEXP '\\.(jpg|jpeg|png|gif|webp|heic|heif)$';
UPDATE fajlok SET fajl_kategoria = 'pdf' WHERE filename REGEXP '\\.pdf$';
UPDATE fajlok SET fajl_kategoria = 'dokumentum' WHERE filename REGEXP '\\.(doc|docx|txt)$';
UPDATE fajlok SET fajl_kategoria = 'tablazat' WHERE filename REGEXP '\\.(xls|xlsx|csv)$';
UPDATE fajlok SET fajl_kategoria = 'egyeb' WHERE fajl_kategoria IS NULL;

-- UX-audit (2026-07-23): a Kamion- és Furgon-modul is kapott egy "Méret"
-- mezőt (`kamion_meret`/`furgon_meret` admin-bővíthető lista), a Pótkocsi
-- modulból ez a párhuzamos fejlesztés kihagyta, holott a pótkocsi
-- méret/kapacitás legalább annyira releváns adat, mint a vontatóé. Külön
-- `potkocsi_meret` lista, nem a `kamion_meret` újrafelhasználása — ugyanaz
-- az indoklás, mint a `furgon_meret`-nél (eltérő méretkategóriák).
ALTER TABLE potkocsi ADD COLUMN meret VARCHAR(20) NULL AFTER tipus;

-- UX-audit (2026-07-23): a "Rögzített események/hibák" táblázat a
-- DddParser.php::parseEventsOrFaults() által ténylegesen kinyert `rendszam`
-- mezőt eddig sosem mentette el (csak `tipus`/`kezdet`/`veg` került az
-- INSERT-be) — pedig épp ez lenne a legfontosabb infó (melyik jármű
-- érintett), ha egyszer lesz kitöltött esemény/hiba adat.
ALTER TABLE tachograf_esemenyek ADD COLUMN rendszam VARCHAR(20) NULL AFTER veg;

-- Tachográf modul UX-újratervezés (2026-07-24) — import-audit napló. Minden
-- alkalmazTachografImport() hívás (fájlonként egy) egy sort ír ide, hogy az
-- "Import előzmények" fülön visszakereshető legyen ki mit töltött fel és mi
-- lett belőle — ezt korábban semmi nem naplózta.
CREATE TABLE IF NOT EXISTS tachograf_import_naplo (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    sofor_id INT NOT NULL,
    kartyaszam VARCHAR(20) NOT NULL,
    fajlnev VARCHAR(191) NULL,
    feltolto_tipus ENUM('admin','sofor') NULL,
    feltolto_id INT NULL,
    feltolto_nev VARCHAR(191) NULL,
    uj_nap INT NOT NULL DEFAULT 0,
    kihagyott_nap INT NOT NULL DEFAULT 0,
    esemeny_szam INT NOT NULL DEFAULT 0,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_admin_datum (admin, letrehozva)
) ENGINE=InnoDB;
