-- Bank-egyeztetés fuvar/számla-szinten (2026-07-26): egy beérkező utalás
-- immár nem csak egy `egyeb_koltsegek` tételhez párosítható, hanem
-- (a "közlemény" mezőben szereplő fuvarok.szamlaszam alapján) egy vagy
-- több fuvarhoz is, amelyeket ilyenkor Teljesítve állapotba léptet.
ALTER TABLE bank_import_tetelek
  MODIFY COLUMN akcio ENUM('parositva','uj_tetel','kihagyva','fuvar_teljesitve') NOT NULL;
