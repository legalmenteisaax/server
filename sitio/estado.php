<?php
// Estado del servidor de Minecraft para la página pública y la tarjeta de isaacyepez.com:
// en línea o apagado, y cuántos jugadores. La consulta está en privado/mc.php.
declare(strict_types=1);
require __DIR__ . '/privado/mc.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: https://isaacyepez.com');  // la tarjeta de SyntaaxMC en isaacyepez.com muestra el estado

echo json_encode(publico(estado_actual()));
