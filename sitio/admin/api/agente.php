<?php
// Conexión con el plugin SyntaaxPanel del PC: emparejar, latidos (métricas, consola y tareas) y resultados.
// El plugin solo hace salidas HTTPS a este archivo; el PC nunca queda abierto a internet.
declare(strict_types=1);

const TIPOS_TAREA = ['comando', 'jugadores', 'jugador', 'grupos', 'grupo', 'plugins', 'archivos_listar', 'archivo_leer', 'archivo_guardar', 'servidor'];
const PANEL_ACTIVO = 120;   // segundos desde la última visita al panel en que el plugin pregunta seguido
const SIN_LATIDO = 45;      // segundos sin latido para dar el plugin por desconectado

// ---------- del lado del plugin ----------

/** El plugin manda su token en X-Syntaax-Token; aquí solo está su SHA-256. */
function exigir_agente(): void
{
    $token = (string) ($_SERVER['HTTP_X_SYNTAAX_TOKEN'] ?? '');
    $guardado = q('SELECT token_hash FROM agente WHERE id = 1')->fetchColumn();
    if ($token === '' || $guardado === false || !hash_equals((string) $guardado, hash('sha256', $token))) {
        limitar('agente', 30);
        registrar_fallo('agente');
        throw new ErrorApi('El plugin no está conectado a este panel. Escribe «panel conectar CÓDIGO» en la consola.', 401);
    }
}

/** «panel conectar CÓDIGO»: el código lo dio el panel a alguien con sesión, y vale 10 minutos y una sola vez. */
function emparejar(): array
{
    limitar('emparejar', 10);
    $e = entrada();
    $codigo = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', is_string($e['codigo'] ?? null) ? $e['codigo'] : ''));
    $token = is_string($e['token'] ?? null) ? $e['token'] : '';
    if (strlen($token) < 32 || strlen($token) > 200) {
        throw new ErrorApi('Token del plugin inválido.', 422);
    }
    $borrado = q('DELETE FROM emparejamientos WHERE codigo_hash = ? AND expira > UTC_TIMESTAMP()', [hash('sha256', $codigo)])->rowCount();
    if ($codigo === '' || $borrado !== 1) {
        registrar_fallo('emparejar');
        throw new ErrorApi('El código no es correcto o ya venció. Pide uno nuevo en el panel, en «Conexión».', 403);
    }
    q('REPLACE INTO agente (id, token_hash, conectado, version) VALUES (1, ?, UTC_TIMESTAMP(), ?)', [hash('sha256', $token), substr((string) ($e['version'] ?? ''), 0, 20)]);
    return ['ok' => true];
}

/** Cada latido trae métricas y consola, y se lleva las tareas pendientes. */
function latido(): array
{
    exigir_agente();
    $e = entrada();
    $m = is_array($e['metricas'] ?? null) ? $e['metricas'] : [];
    $estado = json_encode(['metricas' => $m, 'mundos' => is_array($e['mundos'] ?? null) ? $e['mundos'] : []], JSON_UNESCAPED_UNICODE);
    q('UPDATE agente SET ultimo_latido = UTC_TIMESTAMP(), version = ?, estado = ? WHERE id = 1', [substr((string) ($e['version'] ?? ''), 0, 20), $estado]);
    if ($m) {
        $num = fn($k) => isset($m[$k]) && is_numeric($m[$k]) ? $m[$k] + 0 : null;
        q("INSERT IGNORE INTO metricas (momento, tps, mspt, ram_mb, ram_max_mb, cpu, jugadores)
           VALUES (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:00'), ?, ?, ?, ?, ?, ?)",
          [$num('tps'), $num('mspt'), $num('ram_mb'), $num('ram_max_mb'), $num('cpu'), is_array($m['en_linea'] ?? null) ? count($m['en_linea']) : null]);
    }
    $lineas = array_slice(array_filter(is_array($e['consola'] ?? null) ? $e['consola'] : [], 'is_string'), -500);
    foreach ($lineas as $l) {
        q('INSERT INTO consola (momento, texto) VALUES (UTC_TIMESTAMP(), ?)', [mb_substr($l, 0, 4000)]);
    }
    $tareas = q("SELECT id, tipo, datos FROM tareas WHERE estado = 'pendiente' ORDER BY id LIMIT 10")->fetchAll();
    foreach ($tareas as $t) {
        q("UPDATE tareas SET estado = 'enviada', enviada = UTC_TIMESTAMP() WHERE id = ?", [$t['id']]);
    }
    $visto = (int) (ajuste('panel_visto') ?? 0);
    return [
        'activo' => time() - $visto < PANEL_ACTIVO,
        'tareas' => array_map(fn($t) => ['id' => (int) $t['id'], 'tipo' => $t['tipo'], 'datos' => json_decode($t['datos'], true)], $tareas),
    ];
}

function resultado_tarea(): array
{
    exigir_agente();
    $e = entrada();
    $id = (int) ($e['id'] ?? 0);
    $ok = ($e['ok'] ?? false) === true;
    $res = json_encode($ok ? ['datos' => $e['datos'] ?? null] : ['error' => mb_substr((string) ($e['error'] ?? 'Falló.'), 0, 500)], JSON_UNESCAPED_UNICODE);
    q("UPDATE tareas SET estado = ?, terminada = UTC_TIMESTAMP(), resultado = ? WHERE id = ? AND estado = 'enviada'", [$ok ? 'hecha' : 'error', $res, $id]);
    return ['ok' => true];
}

// ---------- del lado del panel (con sesión) ----------

function codigo_conexion(): array
{
    $signos = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $c = '';
    for ($i = 0; $i < 8; $i++) {
        $c .= $signos[random_int(0, strlen($signos) - 1)];
    }
    q('DELETE FROM emparejamientos WHERE expira < UTC_TIMESTAMP()');
    q('INSERT INTO emparejamientos (codigo_hash, expira) VALUES (?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))', [hash('sha256', $c)]);
    return ['codigo' => substr($c, 0, 4) . '-' . substr($c, 4), 'minutos' => 10];
}

function servidor(): array
{
    $a = q('SELECT UNIX_TIMESTAMP(conectado) AS conectado, UNIX_TIMESTAMP(ultimo_latido) AS latido, version, estado FROM agente WHERE id = 1')->fetch();
    if (!$a) {
        return ['conectado' => false];
    }
    $latido = $a['latido'] !== null ? (int) $a['latido'] : null;
    return [
        'conectado' => true,
        'en_linea' => $latido !== null && time() - $latido < SIN_LATIDO,
        'latido' => $latido,
        'version' => $a['version'],
        'estado' => $a['estado'] ? json_decode($a['estado'], true) : null,
    ];
}

function nueva_tarea(): array
{
    $e = entrada();
    $tipo = (string) ($e['tipo'] ?? '');
    if (!in_array($tipo, TIPOS_TAREA, true)) {
        throw new ErrorApi('Ese tipo de tarea no existe.', 422);
    }
    $datos = json_encode(is_array($e['datos'] ?? null) ? $e['datos'] : new stdClass(), JSON_UNESCAPED_UNICODE);
    if (strlen($datos) > 3 * 1024 * 1024) {
        throw new ErrorApi('Es demasiado grande para mandarlo al servidor (máximo 3 MB).', 413);
    }
    $s = servidor();
    if (empty($s['en_linea'])) {
        throw new ErrorApi('El servidor no está conectado al panel ahora. Revisa que esté prendido.', 409);
    }
    q("INSERT INTO tareas (tipo, datos, creada) VALUES (?, ?, UTC_TIMESTAMP())", [$tipo, $datos]);
    return ['id' => (int) db()->lastInsertId()];
}

function ver_tarea(int $id): array
{
    $t = q('SELECT estado, resultado, UNIX_TIMESTAMP(creada) AS creada FROM tareas WHERE id = ?', [$id])->fetch();
    if (!$t) {
        throw new ErrorApi('Esa tarea no existe.', 404);
    }
    if (in_array($t['estado'], ['pendiente', 'enviada'], true) && time() - (int) $t['creada'] > 60) {
        q("UPDATE tareas SET estado = 'error', resultado = ? WHERE id = ?", [json_encode(['error' => 'El servidor no respondió a tiempo.']), $id]);
        return ['estado' => 'error', 'error' => 'El servidor no respondió a tiempo.'];
    }
    $r = $t['resultado'] ? json_decode($t['resultado'], true) : [];
    return ['estado' => $t['estado']] + (is_array($r) ? $r : []);
}

function metricas(): array
{
    $rango = in_array($_GET['rango'] ?? '', ['1h', '24h', '7d'], true) ? $_GET['rango'] : '1h';
    $horas = ['1h' => 1, '24h' => 24, '7d' => 168][$rango];
    if ($rango === '7d') {
        $filas = q("SELECT UNIX_TIMESTAMP(DATE_FORMAT(momento, '%Y-%m-%d %H:00:00')) AS t, AVG(tps) AS tps, AVG(mspt) AS mspt,
                           AVG(ram_mb) AS ram_mb, MAX(ram_max_mb) AS ram_max_mb, AVG(cpu) AS cpu, MAX(jugadores) AS jugadores
                    FROM metricas WHERE momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 168 HOUR) GROUP BY t ORDER BY t")->fetchAll();
    } else {
        $filas = q('SELECT UNIX_TIMESTAMP(momento) AS t, tps, mspt, ram_mb, ram_max_mb, cpu, jugadores FROM metricas
                    WHERE momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR) ORDER BY momento', [$horas])->fetchAll();
    }
    $n = fn($v, $d = 1) => $v === null ? null : round((float) $v, $d);
    return [
        'rango' => $rango,
        'hasta' => time(),
        'paso' => $rango === '7d' ? 3600 : 60,
        'serie' => array_map(fn($f) => [(int) $f['t'], $n($f['tps']), $n($f['mspt']), $n($f['ram_mb'], 0), $n($f['ram_max_mb'], 0), $n($f['cpu']), $f['jugadores'] === null ? null : (int) $f['jugadores']], $filas),
    ];
}

function consola(): array
{
    $desde = max(0, (int) ($_GET['desde'] ?? 0));
    $filas = $desde > 0
        ? q('SELECT id, UNIX_TIMESTAMP(momento) AS t, texto FROM consola WHERE id > ? ORDER BY id LIMIT 500', [$desde])->fetchAll()
        : array_reverse(q('SELECT id, UNIX_TIMESTAMP(momento) AS t, texto FROM consola ORDER BY id DESC LIMIT 300')->fetchAll());
    return array_map(fn($f) => ['id' => (int) $f['id'], 't' => (int) $f['t'], 'texto' => $f['texto']], $filas);
}

/** El plugin para instalar en el PC. Solo con sesión. */
function descargar_plugin(): never
{
    $jar = __DIR__ . '/archivos/SyntaaxPanel.jar';
    if (!is_file($jar)) {
        throw new ErrorApi('El archivo del plugin todavía no está en el servidor.', 404);
    }
    header('Content-Type: application/java-archive');
    header('Content-Disposition: attachment; filename="SyntaaxPanel.jar"');
    header('Content-Length: ' . filesize($jar));
    readfile($jar);
    exit;
}

// ---------- sugerencias ----------

const SUGERENCIAS = [
    ['copias', 'Copias del mundo desde el panel', 'Ver las copias de C:\\MinecraftBackups, sacar una al momento y restaurar una con confirmación.'],
    ['encender', 'Encender el servidor desde el panel', 'Hoy el panel puede apagarlo o reiniciarlo. Para prenderlo cuando está apagado, la bandeja del PC revisaría una orden en Hostinger cada minuto.'],
    ['avisos', 'Avisos al celular', 'Notificación cuando el servidor se apague, el túnel falle o alguien entre por primera vez.'],
    ['historial', 'Historial de cada jugador', 'Cuándo entra, cuánto tiempo juega y desde qué plataforma, en una gráfica por jugador.'],
    ['chat', 'Chat del juego en el panel', 'Leer el chat y escribir mensajes como «Servidor» sin entrar al juego.'],
    ['mapa', 'Mapa del mundo', 'Instalar BlueMap y verlo dentro del panel, con la ubicación de los jugadores conectados.'],
    ['programar', 'Tareas programadas', 'Reinicio diario a una hora fija, mensajes automáticos y copias nocturnas, configurables desde el panel.'],
    ['actualizar', 'Actualizar plugins con un botón', 'Revisar en Modrinth y Hangar si hay versión nueva para Paper 26.2 y actualizar con copia previa.'],
    ['formularios', 'Configuración con formularios', 'Editar los YAML de los plugins con campos (interruptores, números, listas) en vez de texto.'],
    ['registro', 'Registro de cambios', 'Quién hizo qué desde el panel y cuándo: operadores dados, rangos cambiados, archivos editados.'],
];

function sugerencias(): array
{
    $votos = q('SELECT sugerencia, voto FROM votos')->fetchAll(PDO::FETCH_KEY_PAIR);
    return array_map(fn($s) => ['id' => $s[0], 'titulo' => $s[1], 'texto' => $s[2], 'voto' => $votos[$s[0]] ?? null], SUGERENCIAS);
}

function votar(): array
{
    $e = entrada();
    $id = (string) ($e['id'] ?? '');
    $voto = (string) ($e['voto'] ?? '');
    if (!in_array($id, array_column(SUGERENCIAS, 0), true) || !in_array($voto, ['si', 'no', ''], true)) {
        throw new ErrorApi('Voto inválido.', 422);
    }
    if ($voto === '') {
        q('DELETE FROM votos WHERE sugerencia = ?', [$id]);
    } else {
        q('REPLACE INTO votos (sugerencia, voto, momento) VALUES (?, ?, UTC_TIMESTAMP())', [$id, $voto]);
    }
    return ['ok' => true];
}
