ALTER TABLE `potkocsi_karbantartars` ADD `admin` INT(11) NOT NULL AFTER `id`;
ALTER TABLE `kamion_karbantartars` ADD `admin` INT(11) NOT NULL AFTER `id`;

ALTER TABLE `kamion_karbantartars` ADD INDEX(`admin`);

ALTER TABLE `potkocsi_karbantartars` ADD INDEX(`admin`);
ALTER TABLE `potkocsi_karbantartars` CHANGE `potkocsiId` `potkocsi_id` INT(11) NOT NULL;
ALTER TABLE `kamion_karbantartars` CHANGE `kamionId` `kamion_id` INT(11) NOT NULL;



ALTER TABLE `fajlok`
  DROP `fh`,
  DROP `session_id`,
  DROP `client_id`;
  ALTER TABLE `fajlok` CHANGE `tabla` `tabla` ENUM('kamion','potkocsi','sofor','egyeb','admin','karbantartasok') CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL;


ALTER TABLE `kamion_karbantartars` ADD `km_oraallas` INT(11) NOT NULL AFTER `datum`, ADD `elvegezte` VARCHAR(200) NOT NULL AFTER `km_oraallas`;

ALTER TABLE `potkocsi_karbantartars` ADD `km_oraallas` INT(11) NOT NULL AFTER `datum`, ADD `elvegezte` VARCHAR(200) NOT NULL AFTER `km_oraallas`;

ALTER TABLE `kamion_karbantartars`
  DROP `kesz`;
  ALTER TABLE `potkocsi_karbantartars`
  DROP `kesz`;


ALTER TABLE `kamion_karbantartars` CHANGE `km_oraallas` `km_oraallas` INT(11) NULL, CHANGE `elvegezte` `elvegezte` VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

ALTER TABLE `potkocsi_karbantartars` CHANGE `km_oraallas` `km_oraallas` INT(11) NULL, CHANGE `elvegezte` `elvegezte` VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;