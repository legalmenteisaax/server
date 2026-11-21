<?php
// Copia de config.php sin claves. El config.php de verdad vive solo en Hostinger (public_html/syntaaxmc/admin/api/)
// y nunca va a GitHub. Para rehacerlo: base nueva con hosting_databases_create y un código de instalación nuevo.
return [
    'origen' => 'https://syntaaxmc.isaacyepez.com',   // de dónde se aceptan solicitudes y passkeys
    'rp_id' => 'syntaaxmc.isaacyepez.com',            // dominio al que quedan atadas las passkeys
    'db' => ['host' => '127.0.0.1', 'nombre' => 'u810585570_syntaaxmc', 'usuario' => 'u810585570_syntaaxmc', 'clave' => '...'],
    // SHA-256 del código de instalación (en mayúsculas, sin guiones). Solo sirve mientras no haya ninguna passkey.
    'codigo_instalacion_sha256' => '...',
    // SHA-256 del token del plugin SyntaaxPanel para la primera conexión (lo genera el PC). Vale mientras no haya uno conectado.
    'agente_token_sha256' => '',
];
