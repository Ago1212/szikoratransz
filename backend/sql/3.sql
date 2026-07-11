-- 3.sql
-- Folytatás a 2.sql-ben előkészített, de akkor frontend nélkül hagyott
-- funkciókhoz (sofőr napi fuvarjai, szabadság-naptár UI, audit-log
-- megjelenítő), valamint új funkció: bejelentésből karbantartás
-- generálása.

-- A bejelentés → karbantartás generálás nyomon követéséhez — ha egy
-- bejelentésből már létrehoztak karbantartást, ez mutatja melyiket, és
-- a szerkesztő felület ez alapján dönti el, hogy a gombot vagy a kész
-- állapotot jelenítse-e meg.
ALTER TABLE `bejelentesek`
  ADD `karbantartas_id` INT(11) DEFAULT NULL AFTER `sofor_id`;
