ALTER TABLE egyeb_koltsegek
  ADD COLUMN irany ENUM('bevetel','kiado') NOT NULL DEFAULT 'kiado' AFTER admin;
