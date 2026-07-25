-- Fix for a schema-drift bug introduced by 33.sql (Task 1 of the
-- Fuvar-dokumentum OCR + Fuvar modul plan, docs/superpowers/specs/
-- 2026-07-25-fuvar-dokumentum-ocr-design.md).
--
-- 33.sql's `CREATE TABLE IF NOT EXISTS fuvarok (...)` intended to create
-- the NEW fuvarok schema (sofor_id/kamion_id/furgon_id/potkocsi_id,
-- teljesites_datuma, felrako/lerako, fuvardij/egyeb_koltseg, allapot, ...)
-- that Task 7's FuvarInterface is built against. But a `fuvarok` table
-- ALREADY existed locally, with a completely different, older schema
-- (ugyfel_id/felrakas_cim/felrakas_datum/lerakas_cim/lerakas_datum/dij/
-- statusz) — a leftover from `19.sql`, itself a repair for a stale,
-- untracked local table from a much earlier, unrelated session (predates
-- this feature entirely: `19.sql`'s own comment says it's patching a
-- "Base table or view not found: fuvarok" error against a table that
-- "only ever existed in the local dev DB, never had a tracked migration").
-- `CREATE TABLE IF NOT EXISTS` silently no-op'd against that pre-existing
-- table, so 33.sql never actually applied the new schema — discovered
-- live while implementing Task 7 (`SHOW CREATE TABLE fuvarok` on the
-- local dev DB still showed the old 19.sql-era columns).
--
-- The 5 existing rows were all old test/leftover data (dated 2026-07-09
-- to 2026-07-15, well before this feature's design doc), 2 of them
-- already soft-deleted — not real business data, safe to discard rather
-- than migrate. Per this project's SQL migration convention, 33.sql is
-- already committed, so this is a new file rather than an edit to it.
DROP TABLE IF EXISTS fuvarok;

CREATE TABLE fuvarok (
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
