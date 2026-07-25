-- Fuvar "számlaszám" kézi rögzítése (2026-07-26). Nincs Számlázz.hu API-
-- integráció (ld. project memory) — az admin saját maga állítja ki a
-- számlát a Számlázz.hu felületén, ez az oszlop csak a szám utólagos,
-- kézi rögzítését szolgálja, tömegesen kijelölt fuvarokra egyszerre
-- (N:1 kapcsolat: egy számlaszám több fuvar sorra is rákerülhet).
ALTER TABLE fuvarok ADD COLUMN szamlaszam VARCHAR(50) NULL AFTER fuvarlevel_szam;
