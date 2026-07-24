-- Jármű-egység (VU) import — jármű-központú párja a sofőrkártya-alapú
-- tachograf_napi_aktivitas/tachograf_import_naplo tábláknak (ld. 31.sql).
-- Külön tábla, nem ugyanaz, mert a kulcs jármű (jarmu_tipus+jarmu_id), nem
-- sofor_id, és a forrás-adat (VIN, km-óraállás) is más jellegű. A dekódolást
-- a Go `traconiq/tachoparser` nyílt forráskódú, statikusan linkelt binárisa
-- végzi (backend/bin/dddparser), amit a backend exec()-kel hív meg — ugyanaz
-- az elv, mint a MOL PDF-importnál a rendszer-szintű `pdftotext` binárisnál:
-- egy már megoldott, bonyolult bináris formátum (EU tachográf VU Gen1/Gen2/
-- Gen2v2) újraimplementálása feleslegesen nagy kockázat lett volna egy
-- létező, működő eszközhöz képest.
CREATE TABLE IF NOT EXISTS tachograf_vu_napi_aktivitas (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    jarmu_tipus ENUM('kamion','furgon') NOT NULL,
    jarmu_id INT NOT NULL,
    vin VARCHAR(20) NOT NULL,
    rendszam VARCHAR(20) NOT NULL,
    datum DATE NOT NULL,
    km_zaro INT NULL,
    vezetes_perc INT NOT NULL DEFAULT 0,
    aktivitas_json TEXT NULL,
    kartya_referenciak_json TEXT NULL,
    generacio TINYINT NOT NULL DEFAULT 2,
    forras_fajlnev VARCHAR(191) NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_jarmu_datum (admin, jarmu_tipus, jarmu_id, datum),
    INDEX idx_admin_jarmu (admin, jarmu_tipus, jarmu_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tachograf_vu_import_naplo (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    jarmu_tipus ENUM('kamion','furgon') NOT NULL,
    jarmu_id INT NOT NULL,
    vin VARCHAR(20) NOT NULL,
    rendszam VARCHAR(20) NOT NULL,
    fajlnev VARCHAR(191) NULL,
    feltolto_tipus ENUM('admin','sofor') NULL,
    feltolto_id INT NULL,
    feltolto_nev VARCHAR(191) NULL,
    uj_nap INT NOT NULL DEFAULT 0,
    kihagyott_nap INT NOT NULL DEFAULT 0,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_admin_datum (admin, letrehozva)
) ENGINE=InnoDB;
