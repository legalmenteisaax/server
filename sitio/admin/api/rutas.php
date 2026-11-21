<?php
// Las direcciones de la API del panel. Acceso: «publico» (sin sesión), «sesion» (entraste con tu passkey)
// o «abierto» (el plugin del PC, que no manda origen; se identifica con su token).
declare(strict_types=1);

function rutas(): array
{
    return [
        ['GET', 'estado', 'publico', fn() => ['instalado' => hay_passkeys(), 'sesion' => sesion_passkey() !== null]],
        ['POST', 'registro/opciones', 'publico', function () {
            permiso_registro();
            return opciones_registro();
        }],
        ['POST', 'registro/verificar', 'publico', 'registrar'],
        ['POST', 'entrar/opciones', 'publico', fn() => opciones_entrar()],
        ['POST', 'entrar/verificar', 'publico', 'entrar'],
        ['POST', 'salir', 'sesion', function () {
            cerrar_sesion();
            return ['ok' => true];
        }],
        ['GET', 'resumen', 'sesion', 'resumen'],
        ['GET', 'dispositivos', 'sesion', 'dispositivos'],
        ['DELETE', 'dispositivos/{id}', 'sesion', 'borrar_dispositivo'],
        // Plugin SyntaaxPanel (agente.php): «abierto» = sin sesión ni origen; el latido y el resultado exigen su token.
        ['POST', 'agente/emparejar', 'abierto', 'emparejar'],
        ['POST', 'agente/latido', 'abierto', 'latido'],
        ['POST', 'agente/resultado', 'abierto', 'resultado_tarea'],
        ['POST', 'conexion/codigo', 'sesion', 'codigo_conexion'],
        ['GET', 'servidor', 'sesion', 'servidor'],
        ['POST', 'tareas', 'sesion', 'nueva_tarea'],
        ['GET', 'tareas/{id}', 'sesion', 'ver_tarea'],
        ['GET', 'metricas', 'sesion', 'metricas'],
        ['GET', 'consola', 'sesion', 'consola'],
        ['GET', 'descargar/plugin', 'abierto', 'descargar_plugin'],
        ['GET', 'sugerencias', 'sesion', 'sugerencias'],
        ['POST', 'sugerencias/voto', 'sesion', 'votar'],
    ];
}

/**
 * Quién puede registrar una passkey: con sesión abierta, siempre (agregar otro dispositivo).
 * Sin sesión, solo el primer dispositivo y con el código de instalación, que se ve en la pantalla del PC.
 */
function permiso_registro(): void
{
    if (sesion_passkey() !== null) {
        return;
    }
    if (hay_passkeys()) {
        throw new ErrorApi('Para agregar otro dispositivo, entra primero con uno que ya esté registrado.', 403);
    }
    limitar('instalar', 5);
    $codigo = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', is_string($c = entrada()['codigo'] ?? '') ? $c : ''));
    if ($codigo === '' || !hash_equals((string) config()['codigo_instalacion_sha256'], hash('sha256', $codigo))) {
        registrar_fallo('instalar');
        throw new ErrorApi('El código de instalación no es correcto.', 403);
    }
}

function registrar(): array
{
    permiso_registro();
    $nombre = v_texto(entrada()['nombre'] ?? '', 'nombre del dispositivo', 80);
    $id = verificar_registro(entrada()['credencial'] ?? null, $nombre);
    if (sesion_passkey() === null) {
        crear_sesion($id);
    }
    return ['ok' => true];
}

function entrar(): array
{
    limitar('entrar', 20);
    try {
        $id = verificar_entrada(entrada()['credencial'] ?? null);
    } catch (ErrorApi $e) {
        registrar_fallo('entrar');
        throw $e;
    }
    crear_sesion($id);
    return ['ok' => true];
}

/**
 * Lo que muestra el panel: el estado de ahora y la serie de jugadores.
 * 24 horas: cada muestra (una cada 5 minutos). 7 días: por hora, con el máximo de jugadores de esa hora.
 * Un punto sin valor (null) es un rato en que el servidor no respondió.
 */
function resumen(): array
{
    $rango = ($_GET['rango'] ?? '') === '7d' ? '7d' : '24h';
    $horas = $rango === '7d' ? 168 : 24;
    if ($rango === '24h') {
        $filas = q('SELECT UNIX_TIMESTAMP(momento) AS t, en_linea, jugadores FROM muestras
                    WHERE momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) ORDER BY momento')->fetchAll();
        $serie = array_map(fn($f) => [(int) $f['t'], $f['en_linea'] ? (int) $f['jugadores'] : null], $filas);
    } else {
        $filas = q("SELECT UNIX_TIMESTAMP(DATE_FORMAT(momento, '%Y-%m-%d %H:00:00')) AS t,
                           MAX(CASE WHEN en_linea = 1 THEN jugadores END) AS j, MAX(en_linea) AS en_linea
                    FROM muestras WHERE momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 168 HOUR)
                    GROUP BY t ORDER BY t")->fetchAll();
        $serie = array_map(fn($f) => [(int) $f['t'], $f['en_linea'] ? (int) $f['j'] : null], $filas);
    }
    $totales = q('SELECT COUNT(*) AS n, COALESCE(SUM(en_linea), 0) AS en_linea, UNIX_TIMESTAMP(MIN(momento)) AS desde
                  FROM muestras WHERE momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [$horas])->fetch();
    $pico = q('SELECT jugadores, UNIX_TIMESTAMP(momento) AS t FROM muestras
               WHERE en_linea = 1 AND momento > DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
               ORDER BY jugadores DESC, momento DESC LIMIT 1', [$horas])->fetch();
    $ahora = estado_actual();
    return [
        'ahora' => publico($ahora) + ['revisado' => (int) ($ahora['revisado'] ?? time())],
        'rango' => $rango,
        'hasta' => time(),
        'serie' => $serie,
        'muestras' => (int) $totales['n'],
        'en_linea_pct' => $totales['n'] ? round(100 * $totales['en_linea'] / $totales['n'], 1) : null,
        'desde' => $totales['desde'] !== null ? (int) $totales['desde'] : null,
        'pico' => $pico ? ['jugadores' => (int) $pico['jugadores'], 't' => (int) $pico['t']] : null,
    ];
}

function dispositivos(): array
{
    $actual = sesion_passkey();
    return array_map(fn($f) => [
        'id' => (int) $f['id'],
        'nombre' => $f['nombre'],
        'creada' => (int) $f['creada'],
        'ultimo_uso' => $f['ultimo_uso'] !== null ? (int) $f['ultimo_uso'] : null,
        'este' => (int) $f['id'] === $actual,
    ], q('SELECT id, nombre, UNIX_TIMESTAMP(creada) AS creada, UNIX_TIMESTAMP(ultimo_uso) AS ultimo_uso FROM passkeys ORDER BY id')->fetchAll());
}

/** Quita un dispositivo y cierra sus sesiones. El último no se puede quitar: el panel quedaría sin dueño. */
function borrar_dispositivo(int $id): array
{
    if ((int) q('SELECT COUNT(*) FROM passkeys')->fetchColumn() <= 1) {
        throw new ErrorApi('Es tu único dispositivo. Agrega otro antes de quitar este.', 409);
    }
    if (q('DELETE FROM passkeys WHERE id = ?', [$id])->rowCount() !== 1) {
        throw new ErrorApi('Ese dispositivo ya no existe.', 404);
    }
    return ['ok' => true];
}
