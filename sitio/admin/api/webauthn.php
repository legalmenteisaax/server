<?php
// Passkeys (WebAuthn): entrar al panel con Face ID en el iPhone o Windows Hello en el PC, sin contraseñas.
// Adaptado de ¡platax (app/api/webauthn.php): aquí hay un solo dueño y no hay usuarios.
// Se aceptan llaves ES256 (iPhone, Android, la mayoría) y RS256 (algunos Windows Hello). No se verifica la "atestación"
// del fabricante (se pide attestation = none): basta con que la llave firme correctamente cada inicio de sesión.
declare(strict_types=1);

const ALG_ES256 = -7;
const ALG_RS256 = -257;

/** Decodifica CBOR (formato binario que usan las passkeys). Solo lo necesario: enteros, bytes, texto, listas, mapas y true/false/null. */
function cbor(string $d, int &$p = 0): mixed
{
    if ($p >= strlen($d)) throw new ErrorApi('Respuesta de la passkey incompleta.', 400);
    $b = ord($d[$p++]);
    $tipo = $b >> 5;
    $info = $b & 31;
    $largo = match (true) {
        $info < 24 => $info,
        $info === 24 => ord($d[$p++]),
        $info === 25 => unpack('n', $d, ($p += 2) - 2)[1],
        $info === 26 => unpack('N', $d, ($p += 4) - 4)[1],
        $info === 27 => unpack('J', $d, ($p += 8) - 8)[1],
        default => throw new ErrorApi('Formato de passkey no soportado.', 400),
    };
    switch ($tipo) {
        case 0: return $largo;
        case 1: return -1 - $largo;
        case 2:
        case 3:
            $s = substr($d, $p, $largo);
            if (strlen($s) !== $largo) throw new ErrorApi('Respuesta de la passkey incompleta.', 400);
            $p += $largo;
            return $s;
        case 4:
            $lista = [];
            for ($i = 0; $i < $largo; $i++) $lista[] = cbor($d, $p);
            return $lista;
        case 5:
            $mapa = [];
            for ($i = 0; $i < $largo; $i++) {
                $k = cbor($d, $p);
                $mapa[$k] = cbor($d, $p);
            }
            return $mapa;
        case 7:
            return match ($info) { 20 => false, 21 => true, 22 => null, default => throw new ErrorApi('Formato de passkey no soportado.', 400) };
    }
    throw new ErrorApi('Formato de passkey no soportado.', 400);
}

// --- Llave pública: de COSE (formato de la passkey) a PEM (formato que entiende OpenSSL) ---

function der(int $etiqueta, string $contenido): string
{
    $n = strlen($contenido);
    $largo = $n < 128 ? chr($n) : (function () use ($n) {
        $s = ltrim(pack('N', $n), "\0");
        return chr(0x80 | strlen($s)) . $s;
    })();
    return chr($etiqueta) . $largo . $contenido;
}

function der_entero(string $bytes): string
{
    $bytes = ltrim($bytes, "\0");
    if ($bytes === '' || ord($bytes[0]) & 0x80) $bytes = "\0" . $bytes;
    return der(0x02, $bytes);
}

function cose_a_pem(array $k): string
{
    if (($k[1] ?? null) === 2 && ($k[3] ?? null) === ALG_ES256 && ($k[-1] ?? null) === 1 && strlen($k[-2] ?? '') === 32 && strlen($k[-3] ?? '') === 32) {
        $algoritmo = der(0x30, der(0x06, hex2bin('2a8648ce3d0201')) . der(0x06, hex2bin('2a8648ce3d030107')));
        $spki = der(0x30, $algoritmo . der(0x03, "\0\x04" . $k[-2] . $k[-3]));
    } elseif (($k[1] ?? null) === 3 && ($k[3] ?? null) === ALG_RS256 && is_string($k[-1] ?? null) && is_string($k[-2] ?? null)) {
        $algoritmo = der(0x30, der(0x06, hex2bin('2a864886f70d010101')) . der(0x05, ''));
        $spki = der(0x30, $algoritmo . der(0x03, "\0" . der(0x30, der_entero($k[-1]) . der_entero($k[-2]))));
    } else {
        throw new ErrorApi('Este dispositivo usa un tipo de llave que el panel todavía no acepta.', 400);
    }
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    if (!openssl_pkey_get_public($pem)) throw new ErrorApi('La llave del dispositivo no es válida.', 400);
    return $pem;
}

// --- Retos: números al azar que el dispositivo debe firmar; se usan una sola vez y vencen en 5 minutos ---

function crear_reto(string $tipo): string
{
    q('DELETE FROM retos WHERE expira < UTC_TIMESTAMP()');
    $reto = b64u(random_bytes(32));
    q('INSERT INTO retos (reto, tipo, expira) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE))', [$reto, $tipo]);
    return $reto;
}

function consumir_reto(string $reto, string $tipo): void
{
    if (q('DELETE FROM retos WHERE reto = ? AND tipo = ? AND expira > UTC_TIMESTAMP()', [$reto, $tipo])->rowCount() !== 1) {
        throw new ErrorApi('La solicitud venció. Intenta de nuevo.', 400);
    }
}

/** Revisa clientDataJSON: tipo de operación, reto y que venga de syntaaxmc.isaacyepez.com. */
function revisar_datos_cliente(string $clientDataJSON, string $tipo): void
{
    $c = json_decode($clientDataJSON, true);
    if (!is_array($c) || ($c['type'] ?? '') !== $tipo) throw new ErrorApi('Respuesta de la passkey inválida.', 400);
    if (($c['origin'] ?? '') !== config()['origen']) throw new ErrorApi('La passkey se usó desde otra dirección.', 400);
    consumir_reto((string) ($c['challenge'] ?? ''), $tipo === 'webauthn.create' ? 'registro' : 'entrar');
}

/** Revisa los datos del autenticador: que sean para este sitio y que hubo verificación (Face ID / huella / PIN). */
function revisar_datos_autenticador(string $authData): array
{
    if (strlen($authData) < 37) throw new ErrorApi('Respuesta de la passkey incompleta.', 400);
    if (!hash_equals(hash('sha256', config()['rp_id'], true), substr($authData, 0, 32))) throw new ErrorApi('La passkey no corresponde a este panel.', 400);
    $banderas = ord($authData[32]);
    if (!($banderas & 0x01) || !($banderas & 0x04)) throw new ErrorApi('Hace falta confirmar con Face ID, huella o PIN.', 400);
    return ['banderas' => $banderas, 'contador' => unpack('N', $authData, 33)[1]];
}

/** Opciones para crear una passkey. Todas las del dueño comparten el mismo identificador WebAuthn. */
function opciones_registro(): array
{
    $usuario = ajuste('usuario_webauthn');
    if ($usuario === null) {
        $usuario = b64u(random_bytes(16));
        guardar_ajuste('usuario_webauthn', $usuario);
    }
    $existentes = array_map(fn($c) => ['type' => 'public-key', 'id' => b64u($c)], q('SELECT credencial FROM passkeys')->fetchAll(PDO::FETCH_COLUMN));
    return [
        'challenge' => crear_reto('registro'),
        'rp' => ['name' => 'SyntaaxMC', 'id' => config()['rp_id']],
        'user' => ['id' => $usuario, 'name' => 'syntaaxmc', 'displayName' => 'Panel de SyntaaxMC'],
        'pubKeyCredParams' => [['type' => 'public-key', 'alg' => ALG_ES256], ['type' => 'public-key', 'alg' => ALG_RS256]],
        'authenticatorSelection' => ['residentKey' => 'required', 'requireResidentKey' => true, 'userVerification' => 'required'],
        'attestation' => 'none',
        'excludeCredentials' => $existentes,
        'timeout' => 120000,
    ];
}

/** Verifica el registro de una passkey nueva y la guarda. Devuelve su id. */
function verificar_registro(mixed $d, string $nombre): int
{
    if (!is_array($d)) {
        throw new ErrorApi('Falta la respuesta de la passkey.', 400);
    }
    $clientDataJSON = de_b64u($d['clientDataJSON'] ?? null);
    revisar_datos_cliente($clientDataJSON, 'webauthn.create');
    $att = cbor(de_b64u($d['attestationObject'] ?? null));
    $authData = is_array($att) ? ($att['authData'] ?? '') : '';
    $info = revisar_datos_autenticador($authData);
    if (!($info['banderas'] & 0x40) || strlen($authData) < 55) {
        throw new ErrorApi('La passkey no envió su llave.', 400);
    }
    $largoId = unpack('n', $authData, 53)[1];
    $credencial = substr($authData, 55, $largoId);
    if (strlen($credencial) !== $largoId || $largoId === 0 || $largoId > 255) {
        throw new ErrorApi('Identificador de passkey inválido.', 400);
    }
    if (!hash_equals($credencial, de_b64u($d['id'] ?? null))) {
        throw new ErrorApi('Identificador de passkey inconsistente.', 400);
    }
    $pos = 55 + $largoId;
    $llave = cbor($authData, $pos);
    if (!is_array($llave)) {
        throw new ErrorApi('La passkey no envió su llave.', 400);
    }
    q('INSERT INTO passkeys (credencial, clave_publica, contador, nombre) VALUES (?, ?, ?, ?)', [$credencial, cose_a_pem($llave), $info['contador'], $nombre]);
    return (int) db()->lastInsertId();
}

function opciones_entrar(): array
{
    return ['challenge' => crear_reto('entrar'), 'rpId' => config()['rp_id'], 'userVerification' => 'required', 'allowCredentials' => [], 'timeout' => 120000];
}

/** Verifica la firma de un inicio de sesión y devuelve el id de la passkey. */
function verificar_entrada(mixed $d): int
{
    if (!is_array($d)) {
        throw new ErrorApi('Falta la respuesta de la passkey.', 400);
    }
    $credencial = de_b64u($d['id'] ?? null);
    $pk = q('SELECT id, clave_publica, contador FROM passkeys WHERE credencial = ?', [$credencial])->fetch();
    if (!$pk) {
        throw new ErrorApi('Este dispositivo no está registrado en el panel.', 401);
    }
    $clientDataJSON = de_b64u($d['clientDataJSON'] ?? null);
    $authData = de_b64u($d['authenticatorData'] ?? null);
    revisar_datos_cliente($clientDataJSON, 'webauthn.get');
    $info = revisar_datos_autenticador($authData);
    $firmado = $authData . hash('sha256', $clientDataJSON, true);
    if (openssl_verify($firmado, de_b64u($d['signature'] ?? null), $pk['clave_publica'], OPENSSL_ALGO_SHA256) !== 1) {
        throw new ErrorApi('La firma de la passkey no es válida.', 401);
    }
    // Un contador que retrocede indica una llave copiada. Los iPhone envían siempre 0, y eso es normal.
    if ($info['contador'] > 0 && $info['contador'] <= (int) $pk['contador']) {
        throw new ErrorApi('Esta passkey parece copiada; se rechazó por seguridad.', 401);
    }
    q('UPDATE passkeys SET contador = ?, ultimo_uso = UTC_TIMESTAMP() WHERE id = ?', [$info['contador'], $pk['id']]);
    return (int) $pk['id'];
}
