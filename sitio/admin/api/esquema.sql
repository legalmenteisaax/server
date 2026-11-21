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
;

-- Desde el 21 nov 2026: el plugin SyntaaxPanel del PC (una sola fila, id = 1). Solo se guarda el SHA-256 de su token
CREATE TABLE IF NOT EXISTS agente (
  id TINYINT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  conectado DATETIME NOT NULL,
  ultimo_latido DATETIME NULL,
  version VARCHAR(20) NULL,
  estado MEDIUMTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emparejamientos (
  codigo_hash CHAR(64) PRIMARY KEY,
  expira DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lo que el panel le pide al plugin y lo que el plugin responde
CREATE TABLE IF NOT EXISTS tareas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL,
  datos MEDIUMTEXT NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'pendiente',
  creada DATETIME NOT NULL,
  enviada DATETIME NULL,
  terminada DATETIME NULL,
  resultado MEDIUMTEXT NULL,
  INDEX (estado, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rendimiento, una fila por minuto
CREATE TABLE IF NOT EXISTS metricas (
  momento DATETIME PRIMARY KEY,
  tps DECIMAL(4,1) NULL,
  mspt DECIMAL(7,1) NULL,
  ram_mb INT NULL,
  ram_max_mb INT NULL,
  cpu DECIMAL(5,1) NULL,
  jugadores SMALLINT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Las últimas líneas de la consola (las IP ya llegan tapadas desde el plugin)
CREATE TABLE IF NOT EXISTS consola (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  momento DATETIME NOT NULL,
  texto TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lo que Isaac opina de cada sugerencia del apartado «Sugerencias»
CREATE TABLE IF NOT EXISTS votos (
  sugerencia VARCHAR(40) PRIMARY KEY,
  voto VARCHAR(10) NOT NULL,
  momento DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
