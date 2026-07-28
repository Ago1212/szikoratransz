-- backend/sql/41.sql
-- Fuvar OCR-bővítés: a fuvarlevél/szállítólevél alján gyakran szereplő
-- szállítmány-tömeg (kg) mostantól az OCR-elemzés része (ld.
-- GeminiOcrClient::buildPrompt() "tomeg_kg" mező) és a Fuvar-rekord saját
-- oszlopa — a fuvar távolsága (km) már korábban is `fuvarok.tavolsag_km`-be
-- került (kézi mezőként), most az OCR is kitölti.

ALTER TABLE fuvarok ADD COLUMN tomeg_kg DECIMAL(8,2) NULL AFTER tavolsag_km;
