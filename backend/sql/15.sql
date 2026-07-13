CREATE TABLE ertesites_torles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  kulcs VARCHAR(100) NOT NULL,
  letrehozva DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_admin_kulcs (admin_id, kulcs)
) ENGINE=MyISAM;
