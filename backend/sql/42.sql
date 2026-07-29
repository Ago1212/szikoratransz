-- Fuvar-first munkafolyamat: a sofőr "aktív fuvarjaim" listája ettől az
-- oszloptól szűr (NULL = még nincs menetlevél-fotó feltöltve). Szándékosan
-- független a `allapot` munkafolyamattól, ld. docs/superpowers/specs/
-- 2026-07-28-fuvar-first-workflow-design.md 5.3.
ALTER TABLE fuvarok ADD COLUMN dokumentum_feltoltve DATETIME NULL AFTER allapot;

-- Push-feliratkozások admin+sofőr címzettre általánosítva. A meglévő
-- sorok (mind admin-feliratkozások) DEFAULT 'admin'-t kapnak a
-- felhasznalo_tipus oszlopon, tehát a régi admin push továbbra is
-- működik módosítás nélkül.
ALTER TABLE push_feliratkozasok
  ADD COLUMN felhasznalo_tipus ENUM('admin','sofor') NOT NULL DEFAULT 'admin' AFTER id,
  CHANGE COLUMN admin_id felhasznalo_id INT NOT NULL,
  DROP INDEX idx_admin,
  ADD INDEX idx_felhasznalo (felhasznalo_tipus, felhasznalo_id);
