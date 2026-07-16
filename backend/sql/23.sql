-- A Napló eddig csak a `admin_id`-t tárolta (ami valójában a CÉG-et
-- azonosítja, ld. logAudit() minden hívása `ceg_id`/`request['admin']`-t ad
-- át, sosem a ténylegesen belépett `kerelmezo_id`-t) — több csapattagos
-- cégnél emiatt a napló sosem tudta megmondani, KI (melyik admin-táblás
-- bejelentkezés) végezte a módosítást, csak azt, melyik céghez tartozik.
-- Ez a mező a ténylegesen aktív munkamenet `kerelmezo_id`-ját tárolja —
-- NULL a mostantól visszamenőleg, mert a régi sorokhoz nincs honnan
-- pótolni ezt az adatot.
ALTER TABLE `audit_log`
  ADD COLUMN `kerelmezo_id` INT(11) NULL AFTER `admin_id`;
