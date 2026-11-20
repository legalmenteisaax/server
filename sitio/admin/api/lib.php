<?php
// Piezas comunes del panel: configuración, base de datos, respuestas, sesiones y límite de intentos.
// Hay un solo dueño (Isaac): no hay usuarios, solo sus dispositivos (passkeys).
declare(strict_types=1);

final class ErrorApi extends Exception {}

const COOKIE = '__Host-syntaax';
const DIAS_SESION = 30;

function config(): array
{
    static $c;
    return $c ??= require __DIR__ . '/config.php';
}

function db(): PDO
{
    static $pdo;
    if ($pdo) {
        return $pdo;
    }
    $c = config()['db'];
    $pdo = new PDO("mysql:host={$c['host']};dbname={$c['nombre']};charset=utf8mb4", $c['usuario'], $c['clave'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");  // todo se guarda en UTC; el navegador lo muestra en hora de Colombia
    asegurar_esquema($pdo);
    return $pdo;
}

/** La primera vez crea las tablas de esquema.sql. */
function asegurar_esquema(PDO $pdo): void
{
    if ($pdo->query("SHOW TABLES LIKE 'muestras'")->fetchColumn()) {
        return;
    }
    $sql = preg_replace('/^--.*$/m', '', (string) file_get_contents(__DIR__ . '/esquema.sql'));
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $orden) {
        $pdo->exec($orden);
    }
}

function q(string $sql, array $params = []): PDOStatement
{
    $s = db()->prepare($sql);
    $s->execute($params);
    return $s;
}

function ajuste(string $clave): ?string
{
    $v = q('SELECT valor FROM ajustes WHERE clave = ?', [$clave])->fetchColumn();
    return $v === false ? null : (string) $v;
}

function guardar_ajuste(string $clave, string $valor): void
{
    q('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [$clave, $valor]);
}

function responder(mixed $datos, int $codigo = 200): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** El cuerpo JSON de la solicitud; lo que no sea un objeto cuenta como vacío. */
function entrada(): array
{
    static $e;
    return $e ??= (is_array($d = json_decode(file_get_contents('php://input') ?: '[]', true)) ? $d : []);
}

function v_texto(mixed $v, string $campo, int $max): string
{
    $v = trim(is_scalar($v) ? (string) $v : '');
    if ($v === '') {
        throw new ErrorApi("Falta «{$campo}».", 422);
    }
    if (mb_strlen($v) > $max) {
        throw new ErrorApi("«{$campo}» admite máximo {$max} caracteres.", 422);
    }
    return $v;
}

function b64u(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function de_b64u(mixed $s): string
{
    $r = is_string($s) ? base64_decode(strtr($s, '-_', '+/'), true) : false;
    if ($r === false) {
        throw new ErrorApi('Llegó un dato mal codificado.', 400);
    }
    return $r;
}

// ---------- Sesiones ----------

function nombre_cookie(): string
{
    return config()['cookie'] ?? COOKIE;
}

function crear_sesion(int $passkey): void
{
    $token = b64u(random_bytes(32));
    q('INSERT INTO sesiones (token_hash, passkey_id, expira) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))', [hash('sha256', $token), $passkey, DIAS_SESION]);
    setcookie(nombre_cookie(), $token, ['expires' => time() + DIAS_SESION * 86400, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
}

/** La passkey de la sesión abierta, o null si no hay una válida. */
function sesion_passkey(): ?int
{
    static $id = false;
    if ($id !== false) {
        return $id;
    }
    $token = $_COOKIE[nombre_cookie()] ?? '';
    if (!is_string($token) || $token === '') {
        return $id = null;
    }
    $p = q('SELECT passkey_id FROM sesiones WHERE token_hash = ? AND expira > UTC_TIMESTAMP()', [hash('sha256', $token)])->fetchColumn();
    return $id = ($p === false ? null : (int) $p);
}

function cerrar_sesion(): void
{
    $token = $_COOKIE[nombre_cookie()] ?? '';
    if (is_string($token) && $token !== '') {
        q('DELETE FROM sesiones WHERE token_hash = ?', [hash('sha256', $token)]);
    }
    setcookie(nombre_cookie(), '', ['expires' => 1, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
}

function hay_passkeys(): bool
{
    return (bool) q('SELECT 1 FROM passkeys LIMIT 1')->fetchColumn();
}

/** Solo se aceptan cambios que vengan de la propia página del panel. */
function exigir_mismo_origen(): void
{
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== config()['origen']) {
        throw new ErrorApi('Solicitud rechazada: origen no permitido.', 403);
    }
}

// ---------- Límite de intentos ----------

function ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function limitar(string $accion, int $maximo, int $minutos = 15): void
{
    $n = (int) q('SELECT COUNT(*) FROM intentos WHERE ip = ? AND accion = ? AND momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)', [ip(), $accion, $minutos])->fetchColumn();
    if ($n >= $maximo) {
        throw new ErrorApi('Demasiados intentos fallidos. Espera unos minutos.', 429);
    }
}

function registrar_fallo(string $accion): void
{
    q('INSERT INTO intentos (ip, accion, momento) VALUES (?, ?, UTC_TIMESTAMP())', [ip(), $accion]);
}

/** Los errores inesperados quedan en registro/errores.log (index.php no deja descargarlo). */
function anotar_error(Throwable $e): void
{
    $dir = __DIR__ . '/registro';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700);
    }
    @file_put_contents($dir . '/errores.log', gmdate('c') . ' ' . get_class($e) . ': ' . $e->getMessage() . ' en ' . basename($e->getFile()) . ':' . $e->getLine() . "\n", FILE_APPEND | LOCK_EX);
}
