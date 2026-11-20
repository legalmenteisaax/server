<?php
// Estado del servidor de Minecraft para la página pública: en línea o apagado, y cuántos jugadores.
// Pregunta como lo hace el menú «Multijugador» de Java (Server List Ping) y guarda la respuesta 30 segundos,
// así el PC recibe como mucho dos consultas por minuto. No devuelve nombres de jugadores.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: https://isaacyepez.com');  // la tarjeta de SyntaaxMC en isaacyepez.com muestra el estado

const DOMINIO = 'syntaaxmc.isaacyepez.com';
const RESPALDO = ['molecule-darkness.tun.ply.gg', 44997];  // por si falla la consulta del registro SRV
const PROTOCOLO = 776;                                      // Java 26.2; para el estado sirve cualquiera
const VIGENCIA = 30;      // segundos que se guarda una respuesta
const GRACIA = 180;       // si el túnel corta una consulta suelta, se sigue mostrando «en línea» este tiempo
const INTENTOS = 2;
const ESPERA = 2.5;

$cache = sys_get_temp_dir() . '/syntaaxmc-estado.json';
$previo = is_file($cache) ? json_decode((string) file_get_contents($cache), true) : null;
if (is_array($previo) && time() - (int) ($previo['revisado'] ?? 0) < VIGENCIA) {
    echo json_encode(publico($previo));
    exit;
}

[$host, $puerto] = destino();
$estado = ['en_linea' => false];
$ips = direcciones($host);
for ($i = 0; $i < INTENTOS && $ips; $i++) {
    // Si una conexión falla, se reintenta por la otra versión de IP (IPv4 o IPv6).
    $estado = consultar($ips[$i % count($ips)], $host, $puerto);
    if ($estado['en_linea']) {
        break;
    }
    usleep(300000);
}
$ahora = time();
if ($estado['en_linea']) {
    $estado['visto'] = $ahora;
} elseif (is_array($previo) && !empty($previo['visto']) && $ahora - (int) $previo['visto'] < GRACIA) {
    $estado = ['en_linea' => true, 'jugadores' => $previo['jugadores'] ?? 0, 'max' => $previo['max'] ?? 0, 'visto' => $previo['visto']];
}
$estado['revisado'] = $ahora;
@file_put_contents($cache, json_encode($estado), LOCK_EX);
echo json_encode(publico($estado));

/** Lo que ve la página: sin datos internos. */
function publico(array $e): array
{
    return $e['en_linea'] ?? false
        ? ['en_linea' => true, 'jugadores' => (int) ($e['jugadores'] ?? 0), 'max' => (int) ($e['max'] ?? 0)]
        : ['en_linea' => false];
}

/** Las IP del túnel: primero IPv4 y después IPv6. */
function direcciones(string $host): array
{
    $ips = gethostbynamel($host) ?: [];
    foreach (@dns_get_record($host, DNS_AAAA) ?: [] as $r) {
        if (!empty($r['ipv6'])) {
            $ips[] = '[' . $r['ipv6'] . ']';
        }
    }
    return array_values(array_unique($ips));
}

/** Dónde está el servidor según el registro SRV que usa Java. */
function destino(): array
{
    $srv = @dns_get_record('_minecraft._tcp.' . DOMINIO, DNS_SRV);
    if (is_array($srv) && isset($srv[0]['target'], $srv[0]['port'])) {
        return [(string) $srv[0]['target'], (int) $srv[0]['port']];
    }
    return RESPALDO;
}

/**
 * Saluda como lo hace Minecraft Java cuando sigue el registro SRV: con el nombre y el puerto del túnel.
 * playit mira ese nombre y cierra la conexión si no es el suyo (con syntaaxmc.isaacyepez.com la corta).
 */
function consultar(string $ip, string $host, int $puerto): array
{
    $f = @fsockopen($ip, $puerto, $errno, $error, ESPERA);
    if (!$f) {
        return ['en_linea' => false];
    }
    stream_set_timeout($f, 3);
    try {
        $saludo = "\x00" . varint(PROTOCOLO) . varint(strlen($host)) . $host . pack('n', $puerto) . varint(1);
        fwrite($f, paquete($saludo) . paquete("\x00"));
        leer_varint($f);                       // largo del paquete
        if (leer_varint($f) !== 0) {           // id del paquete de estado
            return ['en_linea' => false];
        }
        $largo = leer_varint($f);
        if ($largo <= 0 || $largo > 65536) {
            return ['en_linea' => false];
        }
        $texto = '';
        while (strlen($texto) < $largo) {
            $parte = fread($f, $largo - strlen($texto));
            if ($parte === false || $parte === '') {
                return ['en_linea' => false];
            }
            $texto .= $parte;
        }
        $datos = json_decode($texto, true);
        if (!is_array($datos)) {
            return ['en_linea' => false];
        }
        return [
            'en_linea' => true,
            'jugadores' => (int) ($datos['players']['online'] ?? 0),
            'max' => (int) ($datos['players']['max'] ?? 0),
        ];
    } catch (Throwable $e) {
        return ['en_linea' => false];
    } finally {
        fclose($f);
    }
}

function varint(int $n): string
{
    $s = '';
    do {
        $b = $n & 0x7F;
        $n >>= 7;
        if ($n !== 0) {
            $b |= 0x80;
        }
        $s .= chr($b);
    } while ($n !== 0);
    return $s;
}

function paquete(string $datos): string
{
    return varint(strlen($datos)) . $datos;
}

/** @param resource $f */
function leer_varint($f): int
{
    $n = 0;
    for ($i = 0; $i < 5; $i++) {
        $c = fread($f, 1);
        if ($c === false || $c === '') {
            throw new RuntimeException('Se cortó la respuesta');
        }
        $b = ord($c);
        $n |= ($b & 0x7F) << (7 * $i);
        if (($b & 0x80) === 0) {
            return $n;
        }
    }
    throw new RuntimeException('Número mal formado');
}
