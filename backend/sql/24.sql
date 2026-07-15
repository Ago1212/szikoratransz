-- Havi bérezés — sofőrökre (`user`) ÉS admin-táblás csapattagokra (pl.
-- fuvarszervező) egyaránt rögzíthető, cégenként/alkalmazottanként egy fix
-- havi összeg. Szándékosan mindkét táblán, nem egy közös polimorf táblán
-- (ld. `fajlok` mintája) — itt egyetlen, egyszerű "aktuális havi bér"
-- értékről van szó, nem idővel változó rekordsorozatról, egy plusz oszlop
-- ehhez elég, nem kell külön tábla/JOIN.
-- Láthatóság/szerkeszthetőség: KIZÁRÓLAG admin szerepkör (ApiHandler oldali
-- ellenőrzés, ld. koltsegInterface.php/soforokInterface.php/
-- csapatInterface.php) — sem a sofőr saját magánál, sem más (pl.
-- fuvarszervező) szerepkör nem láthatja/szerkesztheti.
ALTER TABLE `user`
  ADD COLUMN `ber` DECIMAL(10,2) NULL AFTER `adr_lejarat`;
ALTER TABLE `admin`
  ADD COLUMN `ber` DECIMAL(10,2) NULL AFTER `szerepkor`;
