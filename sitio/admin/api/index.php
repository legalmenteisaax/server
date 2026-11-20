<?php
// Puerta de entrada de la API del panel: toda solicitud a /admin/api/... llega aquí (ver .htaccess), se busca su ruta
// en rutas.php, se comprueba el acceso y se responde en JSON. Los errores inesperados quedan en registro/errores.log.
declare(strict_types=1);
ini_set('display_errors', '0');
require __DIR__ . '/lib.php';
require __DIR__ . '/webauthn.php';
require __DIR__ . '/rutas.php';
require __DIR__ . '/../../privado/mc.php';

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
$metodo = $_SERVER['REQUEST_METHOD'];
$ruta = trim(substr((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), strlen('/admin/api/')), '/');

try {
    foreach (rutas() as [$m, $patron, $acceso, $fn]) {
        if ($m !== $metodo || !preg_match('#^' . str_replace('{id}', '(\d+)', $patron) . '$#', $ruta, $p)) {
            continue;
        }
        if ($metodo !== 'GET') {
            exigir_mismo_origen();
        }
        if ($acceso === 'sesion' && sesion_passkey() === null) {
            throw new ErrorApi('Tu sesión terminó. Entra de nuevo.', 401);
        }
        responder($fn(...array_map('intval', array_slice($p, 1))));
    }
    throw new ErrorApi('Esa dirección no existe.', 404);
} catch (ErrorApi $e) {
    responder(['error' => $e->getMessage()], $e->getCode() ?: 400);
} catch (Throwable $e) {
    anotar_error($e);
    responder(['error' => 'Algo falló en el servidor. Quedó anotado para revisarlo.'], 500);
}
