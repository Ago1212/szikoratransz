CREATE TABLE vezetesi_naplo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin INT NOT NULL,
  sofor_id INT NOT NULL,
  datum DATE NOT NULL,
  vezetes_ora DECIMAL(4,2) NOT NULL,
  pihenes_ora DECIMAL(4,2) NOT NULL,
  megjegyzes VARCHAR(255) NULL,
  letrehozva DATETIME DEFAULT CURRENT_TIMESTAMP,
  torolt ENUM('I','N') NOT NULL DEFAULT 'N',
  UNIQUE KEY ux_sofor_datum (sofor_id, datum)
) ENGINE=MyISAM;
