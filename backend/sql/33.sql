-- Fuvar-dokumentum OCR + Fuvar modul core (docs/superpowers/specs/2026-07-25-fuvar-dokumentum-ocr-design.md).
-- Első alrendszer egy nagyobb, 7 részes fuvarozási-ügyviteli felújításból:
-- OCR-alapú dokumentum-beérkeztetés ("Beérkezett dokumentumok" inbox) és egy
-- új Fuvar modul (a korábban tudatosan kivezetett `fuvarok` tábla
-- újraépítése, most OCR-alapú, nem szóbeli/kézi adatforrással).

-- `fajlok.tabla` bővítése két új értékkel: 'beerkezett_dokumentum' (az OCR-
-- inbox átmeneti tárolási helye) és 'fuvar' (a fuvarhoz véglegesen
-- hozzárendelt melléklet, ld. FuvarInterface::letrehozFuvarDokumentumbol()).
-- MySQL-ben nincs "ADD VALUE TO ENUM" szintaxis, ezért a teljes, jelenleg
-- érvényes listát újra fel kell sorolni (ld. 31.sql).
ALTER TABLE fajlok MODIFY COLUMN tabla ENUM(
  'kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek',
  'dokumentum','tankolas','helyszin','furgon',
  'bank_import','mol_import','tachograf_import',
  'beerkezett_dokumentum','fuvar'
) NOT NULL;

-- A dokumentum-OCR promptjának dinamikusan tudnia kell, melyik cég a MI
-- SAJÁT cégünk (a fuvarozó), hogy meg tudja különböztetni a tényleges
-- megbízótól — élő teszttel megerősítve, hogy enélkül a modell összekeveri
-- a kettőt (ld. a design spec 4.5/5.4 pontja). Csak a root/tulajdonos admin
-- során töltendő ki.
ALTER TABLE admin ADD COLUMN cegnev VARCHAR(200) NULL AFTER name;

-- A Fuvar modul "megbízó kiválasztásakor automatikus fizetési határidő"
-- követelményéhez — ez a mező korábban létezett, a Fuvarok-modul kivezetése
-- során lett törölve, most a design spec alapján tudatosan visszakerül.
ALTER TABLE ugyfelek ADD COLUMN fizetesi_hatarido_nap INT NULL AFTER kapcsolattarto_telefon;

CREATE TABLE IF NOT EXISTS beerkezett_dokumentumok (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    fajl_id INT NOT NULL,
    tipus ENUM('fuvarlevel','szallitolevel','ismeretlen') NOT NULL DEFAULT 'ismeretlen',
    ocr_allapot ENUM('feldolgozatlan','kesz','hiba') NOT NULL DEFAULT 'feldolgozatlan',
    ocr_adatok TEXT NULL,
    feltolto_tipus ENUM('admin','sofor') NULL,
    feltolto_id INT NULL,
    feltolto_nev VARCHAR(191) NULL,
    fuvar_id INT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    torolt ENUM('I','N') NOT NULL DEFAULT 'N',
    PRIMARY KEY (id),
    INDEX idx_admin_torolt (admin, torolt),
    INDEX idx_admin_ocr_allapot (admin, ocr_allapot),
    INDEX idx_admin_fuvar (admin, fuvar_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fuvarok (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    sofor_id INT NULL,
    kamion_id INT NULL,
    furgon_id INT NULL,
    potkocsi_id INT NULL,
    teljesites_datuma DATE NULL,
    felrako VARCHAR(250) NULL,
    lerako VARCHAR(250) NULL,
    tavolsag_km INT NULL,
    megbizo_id INT NULL,
    aru_megnevezese VARCHAR(250) NULL,
    megjegyzes TEXT NULL,
    fuvardij DECIMAL(10,2) NULL,
    egyeb_koltseg DECIMAL(10,2) NULL,
    fuvarlevel_szam VARCHAR(100) NULL,
    allapot ENUM('rogzitett','szamlazasra_var','szamlazva','fizetesre_var','teljesitve') NOT NULL DEFAULT 'rogzitett',
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    torolt ENUM('I','N') NOT NULL DEFAULT 'N',
    PRIMARY KEY (id),
    INDEX idx_admin_torolt (admin, torolt),
    INDEX idx_admin_allapot (admin, allapot),
    INDEX idx_admin_teljesites (admin, teljesites_datuma),
    INDEX idx_admin_megbizo (admin, megbizo_id)
) ENGINE=InnoDB;
