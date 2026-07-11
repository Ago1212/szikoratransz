-- 7.sql
-- A csapattag-szerepkörök leegyszerűsítve két értékre: Adminisztrátor és
-- Fuvarszervező (a korábbi diszpécser/könyvelő/flottafelelős értékek
-- megszűnnek — a meglévő sorok "admin"-ra állnak vissza, mielőtt az
-- enum szűkül, hogy ne maradjon érvénytelen érték).
UPDATE `admin` SET `szerepkor` = 'admin' WHERE `szerepkor` NOT IN ('admin', 'fuvarszervezo');

ALTER TABLE `admin`
  MODIFY `szerepkor` ENUM('admin','fuvarszervezo') NOT NULL DEFAULT 'admin';
