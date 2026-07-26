-- backend/sql/39.sql
-- Jármű teherbírás (tonna) + Pénzforgalom útdíj-tétel nettó összege
-- (informális, sosem összesített mező — ld. eredeti_osszeg/arfolyam minta).

ALTER TABLE kamion ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE furgon ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE potkocsi ADD COLUMN teherbiras DECIMAL(6,2) NULL AFTER meret;
ALTER TABLE egyeb_koltsegek ADD COLUMN netto_osszeg DECIMAL(10,2) NULL AFTER eredeti_osszeg;
