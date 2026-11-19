<?php
// Estado del servidor de Minecraft para la página pública: en línea o apagado, y cuántos jugadores.
// Pregunta como lo hace el menú «Multijugador» de Java (Server List Ping) y guarda la respuesta 30 segundos,
// así el PC recibe como mucho dos consultas por minuto. No devuelve nombres de jugadores.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const DOMINIO = 'syntaaxmc.isaacyepez.com';
const RESPALDO = ['molecule-darkness.tun.ply.gg', 44997];  // por si falla la consulta del registro SRV
const PROTOCOLO = 776;                                      // Java 1.21.11; para el estado sirve cualquiera
const VIGENCIA = 30;
const ESPERA = 3.0;

$cache = sys_get_temp_dir() . '/syntaaxmc-estado.json';
if (is_file($cache) && time() - (int) filemtime($cache) < VIGENCIA) {
    readfile($cache);
    exit;
}

[$host, $puerto] = destino();
$json = json_encode(consultar($host, $puerto) + ['revisado' => time()]);
@file_put_contents($cache, $json, LOCK_EX);
echo $json;

/** Dónde está el servidor según el registro SRV que usa Java. */
function destino(): array
{
    $srv = @dns_get_record('_minecraft._tcp.' . DOMINIO, DNS_SRV);
    if (is_array($srv) && isset($srv[0]['target'], $srv[0]['port'])) {
        return [(string) $srv[0]['target'], (int) $srv[0]['port']];
    }
    return RESPALDO;
}

function consultar(string $host, int $puerto): array
{
    $f = @fsockopen($host, $puerto, $errno, $error, ESPERA);
    if (!$f) {
        return ['en_linea' => false];
    }
    stream_set_timeout($f, (int) ESPERA);
    try {
        $saludo = "\x00" . varint(PROTOCOLO) . varint(strlen(DOMINIO)) . DOMINIO . pack('n', 25565) . varint(1);
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
