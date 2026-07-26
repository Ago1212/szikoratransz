-- Fuvarok / Beérkezett dokumentumok UX-redesign (docs/superpowers/specs/
-- 2026-07-25-fuvarok-ux-redesign-design.md, 7. pont). Additív oszlop —
-- fordított irányú kereszthivatkozás: a beerkezett_dokumentumok.fuvar_id
-- már létezik (33.sql), ez a fordított irány, hogy a Fuvar-form/lista is
-- meg tudja mutatni "ebből a dokumentumból készült". Nem hard FK
-- constraint — a projekt egyetlen táblája sem definiál valódi FOREIGN
-- KEY-t, a referenciális integritás mindenhol konvenció-alapú.
ALTER TABLE fuvarok ADD COLUMN beerkezett_dokumentum_id INT NULL AFTER fuvarlevel_szam;
ALTER TABLE fuvarok ADD INDEX idx_beerkezett_dokumentum (beerkezett_dokumentum_id);
