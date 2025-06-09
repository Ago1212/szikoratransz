ALTER TABLE `potkocsi_karbantartars` ADD `admin` INT(11) NOT NULL AFTER `id`;
ALTER TABLE `kamion_karbantartars` ADD `admin` INT(11) NOT NULL AFTER `id`;

ALTER TABLE `kamion_karbantartars` ADD INDEX(`admin`);

ALTER TABLE `potkocsi_karbantartars` ADD INDEX(`admin`);
ALTER TABLE `potkocsi_karbantartars` CHANGE `potkocsiId` `potkocsi_id` INT(11) NOT NULL;
ALTER TABLE `kamion_karbantartars` CHANGE `kamionId` `kamion_id` INT(11) NOT NULL;