-- Valódi, szerver-oldali munkamenet-tábla. Eddig `ApiHandler::resolveKerelmezo()`
-- a kliens által küldött `kerelmezo_id`-t feltétel nélkül elhitte — bárki,
-- aki ismert egy másik felhasználó id-ját, kiadhatta magát annak. Mostantól
-- bejelentkezéskor egy véletlen token kerül ide, és minden további kérésnél
-- ebből (nem a kliens állításából) vezetjük le, ki a hívó.
CREATE TABLE sessions (
  id INT NOT NULL AUTO_INCREMENT,
  token CHAR(64) NOT NULL,
  felhasznalo_tipus ENUM('admin','sofor') NOT NULL,
  felhasznalo_id INT NOT NULL,
  letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lejarat DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sessions_token (token)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
