-- Beérkezett dokumentumok — kézi sofőr-hozzárendelés (felhasználói kérés,
-- 2026-07-26). A meglévő feltolto_tipus/feltolto_id azt jelzi, KI TÖLTÖTTE
-- FEL a dokumentumot (lehet admin is) — ez egy tényadat, nem szabad
-- felülírni. Ez az új, önálló oszlop azt tárolja, hogy az admin melyik
-- sofőrhöz rendelte a dokumentumot (a fuvarlevél kinek a fuvarja),
-- függetlenül attól, ki töltötte fel — nullable, admin bármikor
-- módosíthatja/törölheti.
ALTER TABLE beerkezett_dokumentumok ADD COLUMN hozzarendelt_sofor_id INT NULL AFTER feltolto_nev;
ALTER TABLE beerkezett_dokumentumok ADD INDEX idx_hozzarendelt_sofor (hozzarendelt_sofor_id);
