-- 6.sql
-- Több admin-fiók egy céghez — a `user` (sofőr) tábla mintáját követve
-- (ahol több sofőr-sor tartozik egy admin.id-hez), most az `admin`
-- táblán belül is lehet több bejelentkezés ugyanahhoz a céghez:
-- `tulajdonos_admin_id` NULL = ez a fiók a cég "gyökere" (az eredeti,
-- adatot birtokló admin), nem NULL = csapattag, akinek az effektív
-- cég-azonosítója (`ceg_id`) a tulajdonos_admin_id.
--
-- Szándékosan nincs külön szerepkör/jogosultság-szint a csapattagok
-- között — mindenki, aki egy céghez tartozik, ugyanazt látja/szerkeszti,
-- amit ma egyetlen admin-fiók lát. Minden meglévő kamion/potkocsi/user/
-- bejelentesek/stb. tábla `admin` oszlopa változatlanul a cég gyökér-
-- admin id-jára mutat — ott nincs migráció, csak a lekérdezéseknek kell
-- ezt a ceg_id-t kapniuk `id` helyett (ld. ApiHandler::getUser()).
ALTER TABLE `admin`
  ADD `tulajdonos_admin_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD INDEX `admin_tulajdonos_idx` (`tulajdonos_admin_id`);

-- A csapattag-fiók létrehozásához nem életszerű minden személyes profil-
-- mezőt (jogosítvány lejárat, lakcím stb.) kötelezővé tenni — ezek eddig
-- NOT NULL-ok voltak, mert egyetlen admin = egyetlen cégtulajdonos volt.
ALTER TABLE `admin`
  MODIFY `phone` VARCHAR(191) DEFAULT NULL,
  MODIFY `szul_datum` DATE DEFAULT NULL,
  MODIFY `irsz` VARCHAR(200) DEFAULT NULL,
  MODIFY `varos` VARCHAR(200) DEFAULT NULL,
  MODIFY `cim` VARCHAR(200) DEFAULT NULL,
  MODIFY `lakcim` VARCHAR(191) DEFAULT NULL,
  MODIFY `szemelyi` VARCHAR(191) DEFAULT NULL,
  MODIFY `szemelyi_lejarat` DATE DEFAULT NULL,
  MODIFY `jogsi_lejarat` DATE DEFAULT NULL,
  MODIFY `gki_lejarat` DATE DEFAULT NULL,
  MODIFY `adr_lejarat` DATE DEFAULT NULL;
