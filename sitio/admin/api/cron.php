<?php
// Tarea programada de Hostinger, cada 5 minutos: anota si el servidor respondió y cuántos jugadores había,
// y borra lo viejo: muestras de más de 90 días, métricas de más de 30, tareas e intentos de más de un día,
// sesiones y códigos vencidos, y la consola pasada de 3000 líneas.
// Solo corre desde la línea de comandos; por la web cae en index.php (ver .htaccess).
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    exit;
}
require __DIR__ . '/lib.php';
require __DIR__ . '/../../privado/mc.php';

try {
    $e = revisar();
    q('INSERT IGNORE INTO muestras (momento, en_linea, jugadores, max) VALUES (UTC_TIMESTAMP(), ?, ?, ?)', [
        $e['en_linea'] ? 1 : 0,
        $e['en_linea'] ? (int) $e['jugadores'] : null,
        $e['en_linea'] ? (int) $e['max'] : null,
    ]);
    q('DELETE FROM muestras WHERE momento < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)');
    q('DELETE FROM sesiones WHERE expira < UTC_TIMESTAMP()');
    q('DELETE FROM retos WHERE expira < UTC_TIMESTAMP()');
    q('DELETE FROM intentos WHERE momento < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)');
    q('DELETE FROM emparejamientos WHERE expira < UTC_TIMESTAMP()');
    q('DELETE FROM tareas WHERE creada < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)');
    q('DELETE FROM metricas WHERE momento < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)');
    // La consola guarda las últimas 3000 líneas.
    $corte = q('SELECT id FROM consola ORDER BY id DESC LIMIT 1 OFFSET 3000')->fetchColumn();
    if ($corte !== false) {
        q('DELETE FROM consola WHERE id <= ?', [$corte]);
    }
} catch (Throwable $err) {
    anotar_error($err);
    exit(1);
}
