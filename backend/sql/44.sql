-- Fuvar mezők átalakítása (docs/superpowers/specs/2026-07-30-fuvar-
-- mezok-atalakitas-design.md): teljesítés dátuma helyett felrakás+
-- lerakás dátum, fuvarlevél szám helyett raklapszám, tömeg tonnában,
-- egyetlen összesített díj, strukturált (cég+cím) felrakó/lerakó a
-- fuvaron ÉS a megbízónál. Root MySQL felhasználóval futtatandó (ld.
-- 29.sql óta az app saját usere nem jogosult ALTER TABLE-re).

-- 1. Teljesítés dátuma -> Lerakás dátuma (adat megmarad), + új Felrakás
--    dátuma oszlop, közvetlenül a Lerakás dátuma elé pozicionálva.
ALTER TABLE fuvarok CHANGE COLUMN teljesites_datuma lerakas_datuma DATE NULL;
ALTER TABLE fuvarok ADD COLUMN felrakas_datuma DATE NULL AFTER potkocsi_id;

-- 2. Felrakó/lerakó: szabad szöveg -> cég + cím. A régi szöveg a "cég"
--    mezőbe kerül át (ez volt az egyetlen adat, ami korábban is ott
--    állt), majd a régi oszlopok törlődnek.
ALTER TABLE fuvarok ADD COLUMN felrako_ceg VARCHAR(250) NULL AFTER felrako;
ALTER TABLE fuvarok ADD COLUMN felrako_cim VARCHAR(250) NULL AFTER felrako_ceg;
ALTER TABLE fuvarok ADD COLUMN lerako_ceg VARCHAR(250) NULL AFTER lerako;
ALTER TABLE fuvarok ADD COLUMN lerako_cim VARCHAR(250) NULL AFTER lerako_ceg;
UPDATE fuvarok SET felrako_ceg = felrako WHERE felrako IS NOT NULL;
UPDATE fuvarok SET lerako_ceg = lerako WHERE lerako IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN felrako;
ALTER TABLE fuvarok DROP COLUMN lerako;

-- 3. Tömeg kg -> tonna (érték átszámolva, nem csak átnevezve).
ALTER TABLE fuvarok ADD COLUMN tomeg_tonna DECIMAL(6,2) NULL AFTER tavolsag_km;
UPDATE fuvarok SET tomeg_tonna = tomeg_kg / 1000 WHERE tomeg_kg IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN tomeg_kg;

-- 4. Fuvarlevél szám (szöveg) -> Raklapszám (egész szám). Fogalmilag
--    más adat, nincs érdemi konverzió — a régi oszlop törlődik.
ALTER TABLE fuvarok ADD COLUMN raklapszam INT NULL AFTER fuvarlevel_szam;
ALTER TABLE fuvarok DROP COLUMN fuvarlevel_szam;

-- 5. Fuvardíj + Egyéb költség -> egyetlen összesített Díj.
ALTER TABLE fuvarok ADD COLUMN dij DECIMAL(10,2) NULL AFTER egyeb_koltseg;
UPDATE fuvarok SET dij = COALESCE(fuvardij, 0) + COALESCE(egyeb_koltseg, 0)
    WHERE fuvardij IS NOT NULL OR egyeb_koltseg IS NOT NULL;
ALTER TABLE fuvarok DROP COLUMN fuvardij;
ALTER TABLE fuvarok DROP COLUMN egyeb_koltseg;

-- 6. Megbízó (ugyfelek) alapértelmezett felrakó/lerakó helyszíne —
--    egy-egy érték megbízónként, nem lista. Az automatikus ajánlás/
--    visszamentés logikája (FuvarInterface) ezekre épül.
ALTER TABLE ugyfelek ADD COLUMN felrako_ceg VARCHAR(250) NULL;
ALTER TABLE ugyfelek ADD COLUMN felrako_cim VARCHAR(250) NULL;
ALTER TABLE ugyfelek ADD COLUMN lerako_ceg VARCHAR(250) NULL;
ALTER TABLE ugyfelek ADD COLUMN lerako_cim VARCHAR(250) NULL;
