-- Biztonsági/megbízhatósági audit (2026-07-19) nyomán:
--
-- `lejarat_emlekezteto_log` — a napi lejárat-emlékeztető cron
-- (backend/cron/lejarat_emlekezteto.php) de-duplikációja. A script eddig
-- minden futtatáskor feltétel nélkül újraküldte az összefoglaló emailt, ha
-- volt találat — duplán regisztrált cron, manuális újrafuttatás vagy egy
-- DST-váltás miatti dupla lefutás emiatt ugyanazt a napot többször is
-- elküldhette ugyanannak az adminnak. Az `admin_id + datum` összetett
-- elsődleges kulcs biztosítja, hogy egy adott admin egy adott napra csak
-- egyszer kapjon emlékeztetőt.
CREATE TABLE IF NOT EXISTS lejarat_emlekezteto_log (
    admin_id INT NOT NULL,
    datum DATE NOT NULL,
    kuldve DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id, datum)
) ENGINE=MyISAM;

-- Fejlesztési audit (2026-07-19) R25 + R26:
--
-- R25 — minden tábla eddig MyISAM volt: nincs sor-szintű zárolás, nincs
-- valódi FK-kényszer (a Prisma-stílusú indexnevek, pl. `CarNaplo_carId_fkey`,
-- csak névleg constraint-szerűek). Táblaszintű zárolás mellett egy hosszabb
-- írás (pl. a GPSmart km-cache cron) blokkolhatja az egyidejű olvasást —
-- flottabővüléssel ez egyre inkább fájna. InnoDB-re állítva mindegyik.
-- Az alkalmazás saját `kamion` DB-felhasználója (ld. backend/db.php) csak
-- SELECT/INSERT/UPDATE/DELETE/LOCK TABLES jogot kap — ezt a migrációt egy
-- ALTER/INDEX jogosultsággal rendelkező felhasználóval (pl. root/DBA) kell
-- lefuttatni, nem a futásidejű alkalmazás-felhasználóval.
ALTER TABLE admin ENGINE=InnoDB;
ALTER TABLE ajanlatkeresek ENGINE=InnoDB;
ALTER TABLE audit_log ENGINE=InnoDB;
ALTER TABLE bejelentesek ENGINE=InnoDB;
ALTER TABLE egyeb_koltsegek ENGINE=InnoDB;
ALTER TABLE egyedi_hataridok ENGINE=InnoDB;
ALTER TABLE ertesites_torles ENGINE=InnoDB;
ALTER TABLE fajlok ENGINE=InnoDB;
ALTER TABLE furgon ENGINE=InnoDB;
ALTER TABLE furgon_karbantartars ENGINE=InnoDB;
ALTER TABLE fuvarok ENGINE=InnoDB;
ALTER TABLE gpsmart_beallitasok ENGINE=InnoDB;
ALTER TABLE gpsmart_napi_km ENGINE=InnoDB;
ALTER TABLE gpsmart_vezetesi_javaslat ENGINE=InnoDB;
ALTER TABLE helyszinek ENGINE=InnoDB;
ALTER TABLE helyszin_megjegyzesek ENGINE=InnoDB;
ALTER TABLE jarmu_valtas_kerelmek ENGINE=InnoDB;
ALTER TABLE jelszo_visszaallitas ENGINE=InnoDB;
ALTER TABLE jogosultsagok ENGINE=InnoDB;
ALTER TABLE kamion ENGINE=InnoDB;
ALTER TABLE kamion_fajlok ENGINE=InnoDB;
ALTER TABLE kamion_karbantartars ENGINE=InnoDB;
ALTER TABLE lejarat_emlekezteto_log ENGINE=InnoDB;
ALTER TABLE listaelemek ENGINE=InnoDB;
ALTER TABLE nav_szamla_beallitasok ENGINE=InnoDB;
ALTER TABLE piaci_arak ENGINE=InnoDB;
ALTER TABLE piaci_arak_elozmeny ENGINE=InnoDB;
ALTER TABLE potkocsi ENGINE=InnoDB;
ALTER TABLE potkocsi_fajlok ENGINE=InnoDB;
ALTER TABLE potkocsi_karbantartars ENGINE=InnoDB;
ALTER TABLE sessions ENGINE=InnoDB;
ALTER TABLE sofor_szabadsag ENGINE=InnoDB;
ALTER TABLE szerepkorok ENGINE=InnoDB;
ALTER TABLE tankolasok ENGINE=InnoDB;
ALTER TABLE ugyfelek ENGINE=InnoDB;
ALTER TABLE user ENGINE=InnoDB;
ALTER TABLE vezetesi_naplo ENGINE=InnoDB;

-- R26 — minden kézzel írt lista-lekérdezés kötelező belépő feltétele
-- `WHERE admin = :ceg_id AND torolt <> 'I'` (ld. CLAUDE.md "Database schema").
-- A táblák egy része már rendelkezett egyoszlopos `admin`-indexszel
-- (bejelentesek, fuvarok, helyszinek, jarmu_valtas_kerelmek, *_karbantartars,
-- sofor_szabadsag, tankolasok, ugyfelek) — ott egy újabb, redundáns index
-- hozzáadása nem indokolt. Az alábbi 7 tábla viszont — a leggyakrabban
-- olvasott, legnagyobb sorszámú táblák (jármű-törzsek, fájlok, sofőrök,
-- pénzügyi tételek) — eddig SEMMILYEN `admin`-t tartalmazó indexszel nem
-- rendelkezett, csak a PRIMARY KEY-jel.
ALTER TABLE kamion ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);
ALTER TABLE potkocsi ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);
ALTER TABLE furgon ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);
ALTER TABLE user ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);
ALTER TABLE fajlok ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);
ALTER TABLE egyeb_koltsegek ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);
ALTER TABLE egyedi_hataridok ADD INDEX IF NOT EXISTS idx_admin_torolt (admin, torolt);

-- R12 (fejlesztési audit, 2026-07-19): a haranG-értesítések (jármű-váltási
-- kérelem, nyitott bejelentés) eddig mindig ÉLŐ számításból jöttek, a
-- `ertesites_torles` csak azt jegyezte, mit rejtsen el — magáról a
-- korábban valaha megjelent értesítésről nem maradt semmilyen nyom, ha a
-- forrás-sor időközben lezárult/törlődött. Ez a tábla egy könnyűsúlyú,
-- kizárólag ÍRÓDÓ előzmény-napló — az admin-onkénti `kulcs` (pl.
-- "bejelentes-42") első felbukkanásának időpontját rögzíti (`INSERT
-- IGNORE`, ld. ErtesitesInterface::logErtesitesek()), sosem íródik felül.
CREATE TABLE IF NOT EXISTS ertesites_naplo (
    admin_id INT NOT NULL,
    kulcs VARCHAR(191) NOT NULL,
    szoveg VARCHAR(500) NOT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id, kulcs)
) ENGINE=InnoDB;

-- R11 (fejlesztési audit, 2026-07-19): Web Push feliratkozások — egy admin
-- több eszközön/böngészőben is feliratkozhat (ezért nincs admin_id-n
-- egyedi kulcs, csak az endpoint-on, ami böngészőnként/eszközönként egyedi).
CREATE TABLE IF NOT EXISTS push_feliratkozasok (
    id INT NOT NULL AUTO_INCREMENT,
    admin_id INT NOT NULL,
    endpoint VARCHAR(512) NOT NULL,
    p256dh VARCHAR(191) NOT NULL,
    auth_kulcs VARCHAR(191) NOT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_endpoint (endpoint(255)),
    INDEX idx_admin (admin_id)
) ENGINE=InnoDB;

-- R52 (fejlesztési audit, 2026-07-19): WebAuthn gyors-bejelentkezés a
-- sofőr PWA-hoz — a sofőr egyszeri jelszavas belépés UTÁN regisztrálhat
-- egy platform-hitelesítőt (ujjlenyomat/arcfelismerés/PIN, a
-- navigator.credentials.create() böngésző-API-n keresztül), majd ezután
-- jelszó nélkül, csak a hitelesítővel léphet be ugyanarra a fiókra.
-- Sofőrönként (nem eszközönként) egyetlen hitelesítő — ha újra
-- regisztrál, a régi lecserélődik (ON DUPLICATE KEY UPDATE).
CREATE TABLE IF NOT EXISTS webauthn_hitelesitok (
    sofor_id INT NOT NULL,
    credential_id VARCHAR(512) NOT NULL,
    public_key_pem TEXT NOT NULL,
    sign_count INT NOT NULL DEFAULT 0,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sofor_id),
    UNIQUE KEY idx_credential (credential_id(255))
) ENGINE=InnoDB;

-- A regisztráció/bejelentkezés két lépésből áll (kihívás kiadása, majd az
-- aláírt válasz ellenőrzése) — a kihívást rövid életű, egyszer-használatos
-- tokenként tároljuk, mert a bejelentkezési kihívás igénylésekor a sofőr
-- MÉG NINCS hitelesítve (ezért nem tehető munkamenet-táblába).
CREATE TABLE IF NOT EXISTS webauthn_kihivasok (
    token CHAR(64) NOT NULL,
    sofor_id INT NOT NULL,
    tipus ENUM('regisztracio','bejelentkezes') NOT NULL,
    challenge VARCHAR(255) NOT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token)
) ENGINE=InnoDB;
