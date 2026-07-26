-- backend/sql/40.sql
-- Pénzforgalom tétel: teljesítés dátuma + fizetési határidő (a NAV Online
-- Számla digest már korábban is szolgáltatja ezt a két mezőt — ld.
-- NavSzamlaClient::digestSorFeldolgozas — de eddig csak az import review-
-- táblázatában jelent meg, nem került perzisztálásra).

ALTER TABLE egyeb_koltsegek ADD COLUMN teljesites_datum DATE NULL AFTER datum;
ALTER TABLE egyeb_koltsegek ADD COLUMN fizetesi_hatarido DATE NULL AFTER teljesites_datum;
