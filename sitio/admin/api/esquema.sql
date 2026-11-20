-- Tablas del panel de SyntaaxMC. index.php las crea solas la primera vez (sin punto y coma dentro de los comentarios)
CREATE TABLE IF NOT EXISTS passkeys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  credencial VARBINARY(255) NOT NULL UNIQUE,
  clave_publica TEXT NOT NULL,
  contador INT UNSIGNED NOT NULL DEFAULT 0,
  nombre VARCHAR(80) NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash CHAR(64) PRIMARY KEY,
  passkey_id INT NOT NULL,
  expira DATETIME NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passkey_id) REFERENCES passkeys(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS retos (
  reto VARCHAR(64) PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL,
  expira DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS intentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  accion VARCHAR(20) NOT NULL,
  momento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (ip, accion, momento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ajustes (
  clave VARCHAR(40) PRIMARY KEY,
  valor TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Una fila cada 5 minutos (cron.php): si el servidor respondió y cuántos jugadores había. Sin nombres
CREATE TABLE IF NOT EXISTS muestras (
  momento DATETIME PRIMARY KEY,
  en_linea TINYINT(1) NOT NULL,
  jugadores SMALLINT UNSIGNED NULL,
  max SMALLINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
