# Servidor de Minecraft · PC y celular

## Qué es
El servidor de Minecraft de Isaac, alojado en su PC con Windows (IsaacPC). Antes estaba en Tarohosting; la carpeta de ese servidor está en el PC. Se entra desde el PC (Minecraft Java) y desde el celular (Minecraft Bedrock, el de iPhone y Android).

## Cómo está hoy (20 nov 2026)
- **Paper 26.2** (build 135) con **Java 25**: se subió de versión al recuperarlo. ViaVersion deja entrar a versiones de Java cercanas.
- Java entra con `syntaaxmc.isaacyepez.com` (registro SRV → `molecule-darkness.tun.ply.gg:44997`). El celular, con `molecule-hardship.tun.ply.gg`, puerto 19132.
- Página pública: https://syntaaxmc.isaacyepez.com.
- En el PC: bandeja con íconos (`scripts/bandeja.ps1`), watchdog (`scripts/watchdog.ps1`) y copias locales en `C:\MinecraftBackups`. Plugins y sus versiones en `docs/plugins.md`.

## Lo que hay para recuperar (revisado el 16 nov 2026)
El servidor se llamaba **SyntaaxMC**: **Paper 1.21.11** (lo dice el `level.dat` de la copia del End), que pide Java 21. El plugin **DriveBackupV2** subía copias al Google Drive de Isaac, carpeta `backups` («backups SyntaaxMC»). Queda una copia de cada cosa:

| Copia | Fecha | Tamaño |
| --- | --- | --- |
| `world` (mundo principal, con los inventarios en `playerdata`) | 10 ago 2026 | 428 MB |
| `plugins` (los plugins con su configuración y sus datos) | 10 ago 2026 | 245 MB |
| `world_nether` | 3 ago 2026 | 11 MB |
| `world_the_end` | 3 ago 2026 | 0,1 MB |
| `worlds` (dos archivos de paquetes de Bedrock; no se usa) | 10 ago 2026 | 1 KB |

No están en las copias: el `.jar` del servidor (se baja de PaperMC), `server.properties` (se rehace si la carpeta del PC no lo trae) ni las listas de jugadores. El Nether y el End quedaron una semana más viejos que el mundo principal. Isaac ya descargó la copia al PC. Desde la nube solo se pueden bajar archivos de Drive de hasta 10 MB, así que esas copias se abren en el PC.

## Decisiones (16 nov 2026)
- **Paper** como servidor: es el de Java, más rápido que el oficial y acepta plugins. Si la carpeta de Tarohosting trae otro (Vanilla, Spigot, Forge o Fabric), se revisa con Isaac antes de cambiarlo: los mods de Forge y Fabric no se ven en el celular.
- **Geyser** (deja entrar a Minecraft Bedrock) y **Floodgate** (los del celular entran sin cuenta de Java). Si la versión del servidor queda atrás de la del celular, se agrega **ViaVersion**.
- **playit.gg** para que entren amigos desde otras casas: es un túnel gratis, no hay que abrir puertos en el router, sirve aunque el operador de internet use CGNAT (común en Colombia) y no muestra la IP de la casa. Java usa TCP 25565 y Bedrock UDP 19132.
- La versión de Java la pide la de Minecraft (Temurin, instalado con `winget`).
- Copia del mundo antes de cada cambio grande: subir de versión cambia el mundo y no se puede volver atrás.
- El servidor solo está abierto mientras el PC esté prendido y el programa corriendo.

## Dónde se trabaja
Todo lo que toca el servidor se hace en el PC, con la sesión «Recuperación del servidor (PC)» de Claude Code en la carpeta del servidor. Una sesión en la nube no ve el PC, pero desde el 19 nov 2026 puede mandarle mensajes a esa sesión (Isaac lo autorizó). La nube hace la página y el panel en Hostinger.

## Lo que no va a GitHub
El `.gitignore` deja fuera todo menos lo que nombra: el mundo, la conexión de DriveBackupV2 con Google (está dentro de `plugins/DriveBackupV2/`), los `.jar`, los registros, las listas de jugadores (`ops.json`, `whitelist.json`, `usercache.json`, `banned-*.json`) y las claves: la de Floodgate (`plugins/floodgate/key.pem`), la de playit y `rcon.password` de `server.properties`. Para guardar algo nuevo en Git se agrega una excepción con `!` en el `.gitignore`, revisando antes que no lleve claves.

## Orden de trabajo
1. Revisar la carpeta descargada en el PC: la lista de plugins y si hay `server.properties`, con su `online-mode` (`true` = cuentas originales, `false` = no premium). Mantener la versión 1.21.11 mientras se recupera; subir de versión después, con copia. (Hecho: hoy corre 26.2.)
2. Copia completa de la carpeta original, sin tocarla.
3. Java y Paper en la versión que toca.
4. Geyser y Floodgate. Probar en la casa, desde el PC y el celular.
5. playit.gg. Probar desde datos móviles.
6. Iniciar con doble clic y copia automática del mundo.
7. Panel de SyntaaxMC (pedido el 19 nov 2026): bandeja con ícono propio en el PC, página pública con el botón «Agregar a Minecraft» y `/admin/` con estado, gráficas, plugins y configuración. Plan en `docs/plan/panel.md`.

## Estructura
- `docs/bitacora.md` → qué se hizo en cada sesión, errores con su causa y solución, y qué falta.
- `docs/plan/panel.md` → el plan del panel (bandeja, plugin SyntaaxPanel y sitio en Hostinger).
- `scripts/` → lo que se haga para iniciar el servidor y sacar copias. `scripts/subir-sitio.mjs` sube `sitio/` a Hostinger (necesita SUBIR_URL, SUBIR_AUTH y SUBIR_REST de `hosting_files_generate-upload-url`, usuario u810585570, dominio isaacyepez.com; duran unas 6 horas).
- `sitio/` → la página pública https://syntaaxmc.isaacyepez.com (carpeta `public_html/syntaaxmc`), con la identidad de ¡saax: botón «Agregar a Minecraft» para el celular, dirección de Java para copiar y `estado.php` (en línea y cuántos jugadores, sin nombres). `estado.php` saluda al servidor con el nombre y el puerto del túnel que da el SRV, como lo hace Java: playit corta la conexión si recibe otro nombre.
- `recursos/iconos/` → íconos de la bandeja con la identidad de ¡saax: `servidor` (Java) y `tunel` (playit), cada uno en `.svg`, `.png` y `.ico`, con variantes `-ok` (punto verde) y `-error` (punto rojo).
