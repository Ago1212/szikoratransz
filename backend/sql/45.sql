-- Díj mező visszabontása: a 44.sql-ben egyetlen `dij` oszlopba vont
-- fuvardíj+egyéb költség helyett ismét külön mező kell mindkettőnek,
-- PLUSZ egy harmadik, csak megjelenített (nem tárolt) "Összesen" —
-- ugyanaz a minta, mint a Fuvar mezőátalakítás előtt (`getFuvar()`/
-- `getFuvarok()` `(fuvardij + IFNULL(egyeb_koltseg,0)) AS osszesen`
-- számítása). A `dij` oszlop TÖRLŐDIK — a jövőben mindig SQL-szinten,
-- `AS dij` aliasként számoljuk ugyanezt, hogy a rá épülő frontend-kód
-- (Táblázat/Kanban/Sofőr-lista/statisztikák, mind `row.dij`-t olvas)
-- változtatás nélkül működjön tovább.
ALTER TABLE fuvarok ADD COLUMN fuvardij DECIMAL(10,2) NULL AFTER megjegyzes;
ALTER TABLE fuvarok ADD COLUMN egyeb_koltseg DECIMAL(10,2) NULL AFTER fuvardij;
UPDATE fuvarok SET fuvardij = dij WHERE dij IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN dij;
