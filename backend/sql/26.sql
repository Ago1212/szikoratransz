-- Brute-force elleni védelem a bejelentkezéshez (login rate limiting).
ALTER TABLE `admin`
  ADD COLUMN `sikertelen_probalkozasok` INT(11) NOT NULL DEFAULT 0 AFTER `password`,
  ADD COLUMN `zarolva_eddig` DATETIME NULL AFTER `sikertelen_probalkozasok`;

ALTER TABLE `user`
  ADD COLUMN `sikertelen_probalkozasok` INT(11) NOT NULL DEFAULT 0 AFTER `password`,
  ADD COLUMN `zarolva_eddig` DATETIME NULL AFTER `sikertelen_probalkozasok`;
